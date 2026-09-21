import {
    obterTokenSessao,
    hashTokenSessao
} from "../../_lib/session.js";


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

        const token =
            obterTokenSessao(
                context.request
            );


        if (!token) {

            return respostaJson(
                {
                    autenticado: false
                },
                401
            );
        }


        const tokenHash =
            await hashTokenSessao(token);


        const agora =
            new Date().toISOString();


        const sessao =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        s.id AS sessao_id,
                        s.expira_em,

                        u.id,
                        u.nome,
                        u.usuario,
                        u.setor,
                        u.perfil,
                        u.ativo

                    FROM sessoes s

                    INNER JOIN usuarios u
                        ON u.id = s.usuario_id

                    WHERE
                        s.token_hash = ?1
                        AND s.expira_em > ?2
                        AND u.ativo = 1

                    LIMIT 1
                    `
                )
                .bind(
                    tokenHash,
                    agora
                )
                .first();


        if (!sessao) {

            return respostaJson(
                {
                    autenticado: false
                },
                401
            );
        }


        await context.env.DB
            .prepare(
                `
                UPDATE sessoes

                SET ultimo_acesso_em =
                    CURRENT_TIMESTAMP

                WHERE id = ?1
                `
            )
            .bind(
                sessao.sessao_id
            )
            .run();


        return respostaJson(
            {
                autenticado: true,

                usuario: {
                    id: sessao.id,
                    nome: sessao.nome,
                    usuario: sessao.usuario,
                    setor: sessao.setor,
                    perfil: sessao.perfil
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