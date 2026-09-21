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

        /*
         * Descobre quem está autenticado
         * através da sessão HttpOnly.
         */

        const usuario =
            await obterUsuarioAutenticado(
                context
            );


        if (!usuario) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Sessão inválida ou expirada."
                },
                401
            );
        }


        /*
         * Busca somente documentos
         * atribuídos àquele usuário.
         */

        const resultado =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        d.id,
                        d.codigo,
                        d.titulo,
                        d.descricao,
                        d.nome_arquivo,
                        d.versao,

                        du.status,
                        du.atribuido_em,
                        du.visualizado_em,
                        du.assinado_em

                    FROM documentos_usuarios du

                    INNER JOIN documentos d
                        ON d.id = du.documento_id

                    WHERE
                        du.usuario_id = ?1
                        AND d.ativo = 1
                        AND du.status != 'ASSINADO'

                    ORDER BY
                        du.atribuido_em DESC
                    `
                )
                .bind(usuario.id)
                .run();


        /*
         * Conta documentos já assinados.
         */

        const assinados =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        COUNT(*) AS total

                    FROM documentos_usuarios du

                    INNER JOIN documentos d
                        ON d.id = du.documento_id

                    WHERE
                        du.usuario_id = ?1
                        AND d.ativo = 1
                        AND du.status = 'ASSINADO'
                    `
                )
                .bind(usuario.id)
                .first();


        const documentos =
            resultado.results || [];


        return respostaJson(
            {
                sucesso: true,

                resumo: {
                    pendentes:
                        documentos.length,

                    assinados:
                        Number(
                            assinados?.total || 0
                        )
                },

                documentos
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao buscar documentos:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,
                mensagem:
                    "Não foi possível carregar os documentos."
            },
            500
        );
    }
}