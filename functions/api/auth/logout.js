import {
    obterTokenSessao,
    hashTokenSessao,
    apagarCookieSessao
} from "../../_lib/session.js";


import {
    obterContextoAutenticado
} from "../../_lib/auth.js";


import {
    registrarAuditoria
} from "../../_lib/audit.js";


function respostaJson(
    dados,
    status,
    cookie
) {

    const headers =
        new Headers({
            "Content-Type":
                "application/json; charset=UTF-8"
        });


    headers.set(
        "Set-Cookie",
        cookie
    );


    return new Response(
        JSON.stringify(dados),
        {
            status,
            headers
        }
    );
}


export async function onRequestPost(
    context
) {

    /*
     * O cookie deve ser apagado mesmo
     * se alguma operação de banco falhar.
     */

    const cookie =
        apagarCookieSessao(
            context.request
        );


    try {

        /*
         * 1. Obtemos o contexto ANTES
         * de apagar a sessão.
         */

        const contextoAutenticado =
            await obterContextoAutenticado(
                context
            );


        /*
         * 2. Se a sessão está válida,
         * registramos o logout.
         */

        if (contextoAutenticado) {

            try {

                await registrarAuditoria(
                    context,
                    {
                        evento:
                            "LOGOUT",

                        resultado:
                            "SUCESSO",

                        usuario:
                            contextoAutenticado
                                .usuario,

                        sessao:
                            contextoAutenticado
                                .sessao,

                        dispositivo:
                            contextoAutenticado
                                .dispositivo
                    }
                );

            } catch (erroAuditoria) {

                /*
                 * Uma falha da auditoria
                 * nunca deve impedir o usuário
                 * de encerrar a sessão.
                 */

                console.error(
                    "Erro ao registrar auditoria de logout:",
                    erroAuditoria
                );
            }
        }


        /*
         * 3. Obtém o token da sessão.
         */

        const token =
            obterTokenSessao(
                context.request
            );


        /*
         * 4. Remove a sessão do banco.
         */

        if (token) {

            const tokenHash =
                await hashTokenSessao(
                    token
                );


            await context.env.DB
                .prepare(
                    `
                    DELETE FROM sessoes

                    WHERE token_hash = ?1
                    `
                )
                .bind(
                    tokenHash
                )
                .run();
        }


        /*
         * Mesmo que a sessão já tenha
         * expirado, o logout é idempotente.
         */

        return respostaJson(
            {
                sucesso: true,

                mensagem:
                    "Sessão encerrada com sucesso."
            },
            200,
            cookie
        );


    } catch (erro) {

        console.error(
            "Erro durante logout:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,

                mensagem:
                    "A sessão local foi encerrada, mas ocorreu um erro ao finalizar o logout no servidor."
            },
            500,
            cookie
        );
    }
}