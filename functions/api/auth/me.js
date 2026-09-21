import {
    obterUsuarioAutenticado
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

        const usuario =
            await obterUsuarioAutenticado(
                context
            );


        if (!usuario) {

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

                usuario: {
                    id:
                        usuario.id,

                    nome:
                        usuario.nome,

                    usuario:
                        usuario.usuario,

                    setor:
                        usuario.setor,

                    perfil:
                        usuario.perfil
                }
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao verificar sessão:",
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