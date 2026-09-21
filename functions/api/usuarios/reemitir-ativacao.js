import {
    gerarHashSenha
} from "../../_lib/password.js";


import {
    gerarCodigoAtivacao
} from "../../_lib/activation.js";


const HORAS_VALIDADE_ATIVACAO = 24;


function respostaJson(
    dados,
    status = 200
) {

    return new Response(
        JSON.stringify(dados),
        {
            status,

            headers: {
                "Content-Type":
                    "application/json; charset=UTF-8"
            }
        }
    );
}


export async function onRequestPost(
    context
) {

    try {

        /*
         * Proteção administrativa temporária.
         *
         * Mais adiante substituiremos isso
         * por autorização baseada em perfil.
         */

        const chaveRecebida =
            context.request.headers.get(
                "X-Admin-Key"
            );


        if (
            !chaveRecebida ||
            chaveRecebida !==
                context.env.BOOTSTRAP_ADMIN_KEY
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Não autorizado."
                },
                401
            );
        }


        const dados =
            await context.request.json();


        const usuario =
            String(
                dados.usuario || ""
            )
                .trim()
                .toLowerCase();


        if (!usuario) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Informe o usuário."
                },
                400
            );
        }


        /*
         * Localiza o usuário sem alterar
         * sua identidade funcional.
         */

        const colaborador =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        codigo_funcional,
                        nome,
                        usuario,
                        ativo

                    FROM usuarios

                    WHERE usuario = ?1

                    LIMIT 1
                    `
                )
                .bind(
                    usuario
                )
                .first();


        if (
            !colaborador ||
            colaborador.ativo !== 1
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Usuário não encontrado ou inativo."
                },
                404
            );
        }


        /*
         * Gera novo código temporário.
         */

        const codigoAtivacao =
            gerarCodigoAtivacao();


        const codigoProtegido =
            await gerarHashSenha(
                codigoAtivacao,
                context.env.APP_PEPPER
            );


        const expiraEm =
            new Date(
                Date.now() +
                HORAS_VALIDADE_ATIVACAO *
                60 *
                60 *
                1000
            ).toISOString();


        /*
         * Substitui a credencial antiga
         * pelo código temporário.
         *
         * O PIN final será criado depois
         * pelo próprio colaborador.
         */

        await context.env.DB
            .prepare(
                `
                UPDATE usuarios

                SET
                    senha_hash = ?1,
                    senha_salt = ?2,

                    credencial_ativada = 0,

                    ativacao_expira_em = ?3,

                    tentativas_falhas = 0,
                    bloqueado_ate = NULL,

                    atualizado_em =
                        CURRENT_TIMESTAMP

                WHERE id = ?4
                `
            )
            .bind(
                codigoProtegido.hash,
                codigoProtegido.salt,
                expiraEm,
                colaborador.id
            )
            .run();


        /*
         * Invalida sessões antigas.
         *
         * Uma troca de credencial não deve
         * manter sessões anteriores ativas.
         */

        await context.env.DB
            .prepare(
                `
                DELETE FROM sessoes

                WHERE usuario_id = ?1
                `
            )
            .bind(
                colaborador.id
            )
            .run();


        /*
         * O código original aparece
         * somente nesta resposta.
         */

        return respostaJson(
            {
                sucesso: true,

                mensagem:
                    "Nova ativação emitida com sucesso.",

                usuario: {
                    id:
                        colaborador.id,

                    codigoFuncional:
                        colaborador.codigo_funcional,

                    nome:
                        colaborador.nome,

                    usuario:
                        colaborador.usuario
                },

                ativacao: {
                    codigo:
                        codigoAtivacao,

                    expiraEm
                }
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao reemitir ativação:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,
                mensagem:
                    "Não foi possível reemitir a ativação."
            },
            500
        );
    }
}