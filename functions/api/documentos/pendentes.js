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
                    "application/json; charset=UTF-8",

                "Cache-Control":
                    "no-store"
            }
        }
    );
}


export async function onRequestGet(
    context
) {

    try {

        const autenticacao =
            await obterContextoAutenticado(
                context
            );


        if (!autenticacao) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Sessão inválida ou expirada."
                },
                401
            );
        }


        const usuarioId =
            autenticacao
                .usuario
                .id;


        /*
         * Mostramos somente atribuições
         * vinculadas a uma versão imutável.
         */

        const resultado =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        du.id
                            AS atribuicao_id,

                        du.status,
                        du.atribuido_em,
                        du.visualizado_em,
                        du.leitura_concluida_em,
                        du.assinado_em,

                        d.id
                            AS documento_id,

                        d.codigo,
                        d.titulo,
                        d.descricao,

                        dv.id
                            AS documento_versao_id,

                        dv.numero_versao,
                        dv.nome_arquivo,
                        dv.tamanho_bytes,
                        dv.sha256,
                        dv.publicado_em

                    FROM documentos_usuarios du

                    INNER JOIN documentos d
                        ON d.id =
                            du.documento_id

                    INNER JOIN documento_versoes dv
                        ON dv.id =
                            du.documento_versao_id

                    WHERE
                        du.usuario_id = ?1

                        AND d.ativo = 1

                        AND du.status !=
                            'ASSINADO'

                    ORDER BY
                        du.atribuido_em DESC
                    `
                )
                .bind(
                    usuarioId
                )
                .all();


        const resumoAssinados =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        COUNT(*) AS quantidade

                    FROM documentos_usuarios du

                    INNER JOIN documentos d
                        ON d.id =
                            du.documento_id

                    WHERE
                        du.usuario_id = ?1

                        AND du.documento_versao_id
                            IS NOT NULL

                        AND du.status =
                            'ASSINADO'

                        AND d.ativo = 1
                    `
                )
                .bind(
                    usuarioId
                )
                .first();


        const documentos =
            (
                resultado.results ||
                []
            ).map(
                item => ({
                    atribuicaoId:
                        item.atribuicao_id,

                    documentoId:
                        item.documento_id,

                    documentoVersaoId:
                        item
                            .documento_versao_id,

                    codigo:
                        item.codigo,

                    titulo:
                        item.titulo,

                    descricao:
                        item.descricao,

                    status:
                        item.status,

                    atribuidoEm:
                        item.atribuido_em,

                    visualizadoEm:
                        item.visualizado_em,

                    leituraConcluidaEm:
                        item
                            .leitura_concluida_em,

                    assinadoEm:
                        item.assinado_em,

                    numeroVersao:
                        item.numero_versao,

                    nomeArquivo:
                        item.nome_arquivo,

                    tamanhoBytes:
                        item.tamanho_bytes,

                    sha256:
                        item.sha256,

                    publicadoEm:
                        item.publicado_em
                })
            );


        return respostaJson(
            {
                sucesso: true,

                resumo: {
                    pendentes:
                        documentos.length,

                    assinados:
                        Number(
                            resumoAssinados
                                ?.quantidade ||
                            0
                        )
                },

                documentos
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao listar documentos:",
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
