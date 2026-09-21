import {
    obterContextoAutenticado
} from "../../_lib/auth.js";


import {
    registrarAuditoria
} from "../../_lib/audit.js";


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


export async function onRequestGet(
    context
) {

    try {

        /*
         * 1. Confirma:
         *
         * usuário
         * sessão
         * tablet
         */

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


        /*
         * 2. Agora o ID da URL representa
         * uma ATRIBUIÇÃO, não um documento.
         */

        const atribuicaoId =
            Number(
                context.params.id
            );


        if (
            !Number.isInteger(
                atribuicaoId
            ) ||
            atribuicaoId <= 0
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Atribuição inválida."
                },
                400
            );
        }


        /*
         * 3. A atribuição precisa:
         *
         * - pertencer ao usuário logado;
         * - apontar para uma versão publicada;
         * - pertencer a um documento ativo.
         */

        const atribuicao =
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

                        d.codigo
                            AS documento_codigo,

                        d.titulo
                            AS documento_titulo,

                        d.descricao
                            AS documento_descricao,

                        dv.id
                            AS documento_versao_id,

                        dv.numero_versao,
                        dv.nome_arquivo,
                        dv.mime_type,
                        dv.tamanho_bytes,
                        dv.sha256,
                        dv.origem_tipo,
                        dv.publicado_em

                    FROM documentos_usuarios du

                    INNER JOIN documentos d
                        ON d.id =
                            du.documento_id

                    INNER JOIN documento_versoes dv
                        ON dv.id =
                            du.documento_versao_id

                    WHERE
                        du.id = ?1

                        AND du.usuario_id = ?2

                        AND d.ativo = 1

                    LIMIT 1
                    `
                )
                .bind(
                    atribuicaoId,
                    autenticacao
                        .usuario
                        .id
                )
                .first();


        if (!atribuicao) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Atribuição não encontrada."
                },
                404
            );
        }


        /*
         * 4. Guarda o estado existente
         * antes de qualquer atualização.
         */

        const statusAnterior =
            atribuicao.status;


        const primeiraAbertura =
            !atribuicao.visualizado_em;


        /*
         * 5. Primeira abertura:
         *
         * PENDENTE -> EM_LEITURA
         */

        if (
            atribuicao.status ===
            "PENDENTE"
        ) {

            await context.env.DB
                .prepare(
                    `
                    UPDATE documentos_usuarios

                    SET
                        status =
                            'EM_LEITURA',

                        visualizado_em =
                            COALESCE(
                                visualizado_em,
                                CURRENT_TIMESTAMP
                            )

                    WHERE
                        id = ?1

                        AND usuario_id = ?2

                        AND documento_versao_id = ?3
                    `
                )
                .bind(
                    atribuicaoId,

                    autenticacao
                        .usuario
                        .id,

                    atribuicao
                        .documento_versao_id
                )
                .run();


            atribuicao.status =
                "EM_LEITURA";
        }


        /*
         * 6. A auditoria agora registra
         * a VERSÃO EXATA aberta.
         */

        await registrarAuditoria(
            context,
            {
                evento:
                    "DOCUMENTO_ABERTO",

                resultado:
                    "SUCESSO",

                usuario:
                    autenticacao.usuario,

                sessao:
                    autenticacao.sessao,

                dispositivo:
                    autenticacao.dispositivo,

                recursoTipo:
                    "DOCUMENTO_VERSAO",

                recursoId:
                    atribuicao
                        .documento_versao_id,

                detalhes: {
                    atribuicaoId:
                        atribuicao
                            .atribuicao_id,

                    documentoId:
                        atribuicao
                            .documento_id,

                    codigoDocumento:
                        atribuicao
                            .documento_codigo,

                    documentoVersaoId:
                        atribuicao
                            .documento_versao_id,

                    numeroVersao:
                        atribuicao
                            .numero_versao,

                    sha256:
                        atribuicao.sha256,

                    primeiraAbertura,

                    statusAnterior,

                    statusAtual:
                        atribuicao.status
                }
            }
        );


        /*
         * 7. Retorna a versão exata.
         */

        return respostaJson(
            {
                sucesso: true,

                atribuicao: {
                    id:
                        atribuicao
                            .atribuicao_id,

                    status:
                        atribuicao.status,

                    atribuidoEm:
                        atribuicao
                            .atribuido_em,

                    visualizadoEm:
                        atribuicao
                            .visualizado_em,

                    leituraConcluidaEm:
                        atribuicao
                            .leitura_concluida_em,

                    assinadoEm:
                        atribuicao
                            .assinado_em
                },

                documento: {
                    id:
                        atribuicao
                            .documento_id,

                    codigo:
                        atribuicao
                            .documento_codigo,

                    titulo:
                        atribuicao
                            .documento_titulo,

                    descricao:
                        atribuicao
                            .documento_descricao
                },

                versao: {
                    id:
                        atribuicao
                            .documento_versao_id,

                    numero:
                        atribuicao
                            .numero_versao,

                    nomeArquivo:
                        atribuicao
                            .nome_arquivo,

                    mimeType:
                        atribuicao
                            .mime_type,

                    tamanhoBytes:
                        atribuicao
                            .tamanho_bytes,

                    sha256:
                        atribuicao.sha256,

                    publicadoEm:
                        atribuicao
                            .publicado_em
                }
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao abrir atribuição:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,

                mensagem:
                    "Não foi possível abrir a atribuição."
            },
            500
        );
    }
}