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
         * Descobre o usuário através
         * da sessão HttpOnly.
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
         * O [id] do nome do arquivo
         * chega através de context.params.id.
         */
        const documentoId =
            Number(context.params.id);


        if (
            !Number.isInteger(documentoId) ||
            documentoId <= 0
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Documento inválido."
                },
                400
            );
        }


        /*
         * IMPORTANTE:
         *
         * Não procuramos apenas pelo documento.
         *
         * Também exigimos que ele esteja
         * atribuído ao usuário autenticado.
         */
        const documento =
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
                        du.leitura_concluida_em,
                        du.assinado_em

                    FROM documentos_usuarios du

                    INNER JOIN documentos d
                        ON d.id = du.documento_id

                    WHERE
                        d.id = ?1
                        AND du.usuario_id = ?2
                        AND d.ativo = 1

                    LIMIT 1
                    `
                )
                .bind(
                    documentoId,
                    usuario.id
                )
                .first();


        if (!documento) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Documento não encontrado."
                },
                404
            );
        }


        /*
         * Na primeira abertura:
         *
         * PENDENTE -> EM_LEITURA
         */
        if (documento.status === "PENDENTE") {

            await context.env.DB
                .prepare(
                    `
                    UPDATE documentos_usuarios

                    SET
                        status = 'EM_LEITURA',

                        visualizado_em =
                            COALESCE(
                                visualizado_em,
                                CURRENT_TIMESTAMP
                            )

                    WHERE
                        documento_id = ?1
                        AND usuario_id = ?2
                    `
                )
                .bind(
                    documentoId,
                    usuario.id
                )
                .run();


            documento.status =
                "EM_LEITURA";
        }


        return respostaJson(
            {
                sucesso: true,

                documento: {
                    id: documento.id,
                    codigo: documento.codigo,
                    titulo: documento.titulo,
                    descricao:
                        documento.descricao,

                    nomeArquivo:
                        documento.nome_arquivo,

                    versao:
                        documento.versao,

                    status:
                        documento.status,

                    leituraConcluida:
                        Boolean(
                            documento
                                .leitura_concluida_em
                        )
                }
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao carregar documento:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,
                mensagem:
                    "Não foi possível carregar o documento."
            },
            500
        );
    }
}