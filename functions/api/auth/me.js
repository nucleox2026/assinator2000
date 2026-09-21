import {
    obterContextoAutenticado
} from "../../_lib/auth.js";


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


export async function onRequestGet(context) {

    try {

        const contexto =
            await obterContextoAutenticado(
                context
            );


        if (!contexto) {

            return respostaJson(
                {
                    autenticado: false
                },
                401
            );
        }


        return respostaJson(
            {
                autenticado: true,

                usuario:
                    contexto.usuario,

                dispositivo:
                    contexto.dispositivo,

                sessao: {
                    id:
                        contexto.sessao.id,

                    expiraEm:
                        contexto.sessao.expiraEm
                }
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao verificar autenticação:",
            erro
        );


        return respostaJson(
            {
                autenticado: false
            },
            500
        );
    }
}