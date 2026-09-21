import {
    obterTokenSessao,
    hashTokenSessao,
    apagarCookieSessao
} from "../../_lib/session.js";


function respostaJson(
    dados,
    status,
    cookie
) {

    const headers = new Headers({
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


export async function onRequestPost(context) {

    try {

        /*
         * 1. Procura o token no cookie.
         */

        const token =
            obterTokenSessao(
                context.request
            );


        /*
         * 2. Se existe token,
         * calcula seu hash e remove
         * a sessão do banco.
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
                .bind(tokenHash)
                .run();
        }


        /*
         * 3. Remove o cookie do navegador.
         */

        const cookie =
            apagarCookieSessao(
                context.request
            );


        /*
         * Mesmo que a sessão já não exista,
         * consideramos o logout bem-sucedido.
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


        /*
         * Mesmo em caso de erro no banco,
         * tentamos remover o cookie.
         */

        const cookie =
            apagarCookieSessao(
                context.request
            );


        return respostaJson(
            {
                sucesso: false,
                mensagem:
                    "Não foi possível encerrar completamente a sessão."
            },
            500,
            cookie
        );
    }
}