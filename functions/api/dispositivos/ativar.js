import {
    verificarSenha
} from "../../_lib/password.js";


import {
    gerarTokenDispositivo,
    criarCookieDispositivo
} from "../../_lib/device.js";


const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;


function respostaJson(
    dados,
    status = 200,
    cookie = null
) {

    const headers =
        new Headers({
            "Content-Type":
                "application/json; charset=UTF-8"
        });


    if (cookie) {

        headers.set(
            "Set-Cookie",
            cookie
        );
    }


    return new Response(
        JSON.stringify(dados),
        {
            status,
            headers
        }
    );
}


export async function onRequestPost(context) {

    try {

        const dados =
            await context.request.json();


        const codigoDispositivo =
            String(
                dados.codigoDispositivo || ""
            )
                .trim()
                .toUpperCase();


        const codigoAtivacao =
            String(
                dados.codigoAtivacao || ""
            ).trim();


        if (
            !codigoDispositivo ||
            !codigoAtivacao
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Informe o dispositivo e o código de ativação."
                },
                400
            );
        }


        if (
            !/^\d{8}$/.test(
                codigoAtivacao
            )
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "O código de ativação deve conter 8 números."
                },
                400
            );
        }


        const dispositivo =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        codigo,
                        nome,
                        local,
                        token_hash,
                        ativacao_hash,
                        ativacao_salt,
                        ativacao_expira_em,
                        ativo,
                        ativado_em,
                        tentativas_ativacao,
                        bloqueado_ate

                    FROM dispositivos

                    WHERE codigo = ?1

                    LIMIT 1
                    `
                )
                .bind(
                    codigoDispositivo
                )
                .first();


        if (
            !dispositivo ||
            dispositivo.ativo !== 1
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Dados de ativação inválidos."
                },
                401
            );
        }


        if (
            dispositivo.token_hash &&
            dispositivo.ativado_em
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Este dispositivo já está ativado."
                },
                409
            );
        }


        const agora =
            new Date();


        if (dispositivo.bloqueado_ate) {

            const bloqueadoAte =
                new Date(
                    dispositivo.bloqueado_ate
                );


            if (bloqueadoAte > agora) {

                return respostaJson(
                    {
                        sucesso: false,
                        mensagem:
                            "Ativação temporariamente bloqueada."
                    },
                    423
                );
            }
        }


        if (
            !dispositivo.ativacao_hash ||
            !dispositivo.ativacao_salt ||
            !dispositivo.ativacao_expira_em
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Código de ativação indisponível."
                },
                410
            );
        }


        const expiraEm =
            new Date(
                dispositivo
                    .ativacao_expira_em
            );


        if (expiraEm <= agora) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "O código de ativação expirou."
                },
                410
            );
        }


        const codigoValido =
            await verificarSenha(
                codigoAtivacao,
                dispositivo.ativacao_salt,
                dispositivo.ativacao_hash,
                context.env.APP_PEPPER
            );


        if (!codigoValido) {

            const tentativas =
                Number(
                    dispositivo
                        .tentativas_ativacao || 0
                ) + 1;


            if (
                tentativas >=
                MAX_TENTATIVAS
            ) {

                const bloqueadoAte =
                    new Date(
                        Date.now() +
                        MINUTOS_BLOQUEIO *
                        60 *
                        1000
                    ).toISOString();


                await context.env.DB
                    .prepare(
                        `
                        UPDATE dispositivos

                        SET
                            tentativas_ativacao = ?1,
                            bloqueado_ate = ?2,
                            atualizado_em =
                                CURRENT_TIMESTAMP

                        WHERE id = ?3
                        `
                    )
                    .bind(
                        tentativas,
                        bloqueadoAte,
                        dispositivo.id
                    )
                    .run();


                return respostaJson(
                    {
                        sucesso: false,
                        mensagem:
                            "Ativação temporariamente bloqueada."
                    },
                    423
                );
            }


            await context.env.DB
                .prepare(
                    `
                    UPDATE dispositivos

                    SET
                        tentativas_ativacao = ?1,
                        atualizado_em =
                            CURRENT_TIMESTAMP

                    WHERE id = ?2
                    `
                )
                .bind(
                    tentativas,
                    dispositivo.id
                )
                .run();


            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Dados de ativação inválidos."
                },
                401
            );
        }


        /*
         * Código correto.
         * Geramos a identidade persistente
         * do tablet.
         */

        const identidade =
            await gerarTokenDispositivo();


        await context.env.DB
            .prepare(
                `
                UPDATE dispositivos

                SET
                    token_hash = ?1,

                    ativacao_hash = NULL,
                    ativacao_salt = NULL,
                    ativacao_expira_em = NULL,

                    tentativas_ativacao = 0,
                    bloqueado_ate = NULL,

                    ativado_em =
                        CURRENT_TIMESTAMP,

                    ultimo_acesso_em =
                        CURRENT_TIMESTAMP,

                    atualizado_em =
                        CURRENT_TIMESTAMP

                WHERE id = ?2
                `
            )
            .bind(
                identidade.tokenHash,
                dispositivo.id
            )
            .run();


        const cookie =
            criarCookieDispositivo(
                identidade.token,
                context.request
            );


        return respostaJson(
            {
                sucesso: true,

                mensagem:
                    "Tablet corporativo ativado com sucesso.",

                dispositivo: {
                    codigo:
                        dispositivo.codigo,

                    nome:
                        dispositivo.nome,

                    local:
                        dispositivo.local
                }
            },
            200,
            cookie
        );


    } catch (erro) {

        console.error(
            "Erro ao ativar dispositivo:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,
                mensagem:
                    "Não foi possível ativar o dispositivo."
            },
            500
        );
    }
}