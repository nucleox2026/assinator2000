import {
    gerarHashSenha,
    verificarSenha
} from "../../_lib/password.js";


const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;


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


function pinValido(pin) {

    if (!/^\d{6}$/.test(pin)) {
        return false;
    }


    const pinsBloqueados =
        new Set([
            "000000",
            "111111",
            "222222",
            "333333",
            "444444",
            "555555",
            "666666",
            "777777",
            "888888",
            "999999",
            "123456",
            "654321"
        ]);


    return !pinsBloqueados.has(pin);
}


export async function onRequestPost(context) {

    try {

        const dados =
            await context.request.json();


        const usuario =
            String(
                dados.usuario || ""
            )
                .trim()
                .toLowerCase();


        const codigo =
            String(
                dados.codigo || ""
            ).trim();


        const pin =
            String(
                dados.pin || ""
            ).trim();


        const confirmarPin =
            String(
                dados.confirmarPin || ""
            ).trim();


        /*
         * Validação básica.
         */

        if (
            !usuario ||
            !codigo ||
            !pin ||
            !confirmarPin
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Preencha todos os campos."
                },
                400
            );
        }


        if (!/^\d{8}$/.test(codigo)) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "O código de ativação deve conter 8 números."
                },
                400
            );
        }


        if (pin !== confirmarPin) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Os PINs informados não são iguais."
                },
                400
            );
        }


        if (!pinValido(pin)) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Escolha um PIN de 6 dígitos menos previsível."
                },
                400
            );
        }


        /*
         * Procura a conta.
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
                        senha_hash,
                        senha_salt,
                        ativo,
                        credencial_ativada,
                        ativacao_expira_em,
                        tentativas_falhas,
                        bloqueado_ate

                    FROM usuarios

                    WHERE usuario = ?1

                    LIMIT 1
                    `
                )
                .bind(usuario)
                .first();


        if (
            !colaborador ||
            colaborador.ativo !== 1
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


        /*
         * Não permite ativar novamente.
         */

        if (
            colaborador
                .credencial_ativada === 1
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Esta credencial já foi ativada."
                },
                409
            );
        }


        const agora =
            new Date();


        /*
         * Verifica bloqueio temporário.
         */

        if (colaborador.bloqueado_ate) {

            const bloqueadoAte =
                new Date(
                    colaborador.bloqueado_ate
                );


            if (bloqueadoAte > agora) {

                return respostaJson(
                    {
                        sucesso: false,
                        mensagem:
                            "Ativação temporariamente bloqueada. Tente novamente mais tarde."
                    },
                    423
                );
            }
        }


        /*
         * Verifica validade do código.
         */

        if (
            !colaborador
                .ativacao_expira_em
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
                colaborador
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


        /*
         * Compara o código digitado
         * com o hash salvo no banco.
         */

        const codigoValido =
            await verificarSenha(
                codigo,
                colaborador.senha_salt,
                colaborador.senha_hash,
                context.env.APP_PEPPER
            );


        if (!codigoValido) {

            const tentativas =
                Number(
                    colaborador
                        .tentativas_falhas || 0
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
                        UPDATE usuarios

                        SET
                            tentativas_falhas = ?1,
                            bloqueado_ate = ?2,
                            atualizado_em =
                                CURRENT_TIMESTAMP

                        WHERE id = ?3
                        `
                    )
                    .bind(
                        tentativas,
                        bloqueadoAte,
                        colaborador.id
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
                    UPDATE usuarios

                    SET
                        tentativas_falhas = ?1,
                        atualizado_em =
                            CURRENT_TIMESTAMP

                    WHERE id = ?2
                    `
                )
                .bind(
                    tentativas,
                    colaborador.id
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
         *
         * Agora transformamos o PIN pessoal
         * em hash + salt.
         */

        const pinProtegido =
            await gerarHashSenha(
                pin,
                context.env.APP_PEPPER
            );


        /*
         * O hash do código temporário
         * é substituído pelo hash do PIN.
         */

        await context.env.DB
            .prepare(
                `
                UPDATE usuarios

                SET
                    senha_hash = ?1,
                    senha_salt = ?2,

                    credencial_ativada = 1,

                    ativacao_expira_em = NULL,

                    tentativas_falhas = 0,

                    bloqueado_ate = NULL,

                    atualizado_em =
                        CURRENT_TIMESTAMP

                WHERE
                    id = ?3
                    AND credencial_ativada = 0
                `
            )
            .bind(
                pinProtegido.hash,
                pinProtegido.salt,
                colaborador.id
            )
            .run();


        /*
         * Por segurança, qualquer sessão
         * antiga desse usuário é eliminada.
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


        return respostaJson(
            {
                sucesso: true,

                mensagem:
                    "PIN pessoal criado com sucesso.",

                usuario: {
                    codigoFuncional:
                        colaborador
                            .codigo_funcional,

                    nome:
                        colaborador.nome,

                    usuario:
                        colaborador.usuario
                }
            }
        );


    } catch (erro) {

        console.error(
            "Erro durante ativação:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,
                mensagem:
                    "Não foi possível ativar a credencial."
            },
            500
        );
    }
}