import { verificarSenha } from "../../_lib/password.js";


function respostaJson(dados, status = 200) {
    return new Response(
        JSON.stringify(dados),
        {
            status,
            headers: {
                "Content-Type": "application/json; charset=UTF-8"
            }
        }
    );
}


export async function onRequestPost(context) {

    try {

        const dados = await context.request.json();

        const usuario =
            String(dados.usuario || "")
                .trim()
                .toLowerCase();

        const senha =
            String(dados.senha || "").trim();


        if (!usuario || !senha) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem: "Informe usuário e senha."
                },
                400
            );
        }


        const colaborador =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        nome,
                        usuario,
                        senha_hash,
                        senha_salt,
                        setor,
                        perfil,
                        ativo
                    FROM usuarios
                    WHERE usuario = ?1
                    LIMIT 1
                    `
                )
                .bind(usuario)
                .first();


        /*
         * Não revelamos se foi o usuário
         * ou a senha que estava incorreto.
         */

        if (!colaborador || colaborador.ativo !== 1) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem: "Usuário ou senha inválidos."
                },
                401
            );
        }


        const senhaValida =
            await verificarSenha(
                senha,
                colaborador.senha_salt,
                colaborador.senha_hash,
                context.env.APP_PEPPER
            );


        if (!senhaValida) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem: "Usuário ou senha inválidos."
                },
                401
            );
        }


        return respostaJson(
            {
                sucesso: true,

                mensagem: "Autenticação realizada com sucesso.",

                usuario: {
                    id: colaborador.id,
                    nome: colaborador.nome,
                    usuario: colaborador.usuario,
                    setor: colaborador.setor,
                    perfil: colaborador.perfil
                }
            }
        );


    } catch (erro) {

        console.error("Erro durante login:", erro);

        return respostaJson(
            {
                sucesso: false,
                mensagem: "Não foi possível realizar o login."
            },
            500
        );
    }
}