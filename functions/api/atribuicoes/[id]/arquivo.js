import {
    obterContextoAutenticado
} from "../../../_lib/auth.js";


import {
    registrarAuditoria
} from "../../../_lib/audit.js";


import {
    calcularSha256
} from "../../../_lib/hash.js";


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


function nomeSeguroCabecalho(
    nome
) {

    const limpo =
        String(
            nome || "documento.pdf"
        )
            .replace(
                /[\r\n"]/g,
                "_"
            )
            .slice(
                0,
                150
            );


    return limpo || "documento.pdf";
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
         * 2. O ID representa a atribuição
         * individual do colaborador.
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
         * 3. Busca somente uma atribuição
         * pertencente ao usuário autenticado.
         */

        const atribuicao =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        du.id
                            AS atribuicao_id,

                        du.status,

                        d.id
                            AS documento_id,

                        d.codigo
                            AS documento_codigo,

                        d.titulo
                            AS documento_titulo,

                        dv.id
                            AS documento_versao_id,

                        dv.numero_versao,

                        dv.nome_arquivo,

                        dv.mime_type,

                        dv.tamanho_bytes,

                        dv.sha256,

                        dv.origem_tipo,

                        dv.origem_referencia

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
         * 4. Por enquanto nosso protótipo
         * entrega arquivos armazenados no R2.
         */

        if (
            String(
                atribuicao.origem_tipo || ""
            ).toUpperCase() !== "R2" ||
            !atribuicao.origem_referencia
        ) {

            await registrarAuditoria(
                context,
                {
                    evento:
                        "DOCUMENTO_ARQUIVO_NEGADO",

                    resultado:
                        "NEGADO",

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
                        motivo:
                            "ORIGEM_NAO_DISPONIVEL",

                        atribuicaoId,

                        documentoVersaoId:
                            atribuicao
                                .documento_versao_id
                    }
                }
            );


            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "O arquivo desta versão não está disponível."
                },
                409
            );
        }


        /*
         * 5. Confirma o binding privado
         * do R2.
         */

        if (
            !context.env.DOCUMENTOS
        ) {

            throw new Error(
                "Binding DOCUMENTOS não configurado."
            );
        }


        /*
         * 6. Busca exatamente o objeto
         * registrado na versão imutável.
         */

        const objeto =
            await context.env.DOCUMENTOS
                .get(
                    atribuicao
                        .origem_referencia
                );


        if (!objeto) {

            await registrarAuditoria(
                context,
                {
                    evento:
                        "DOCUMENTO_ARQUIVO_INDISPONIVEL",

                    resultado:
                        "FALHA",

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
                        atribuicaoId,

                        documentoId:
                            atribuicao
                                .documento_id,

                        numeroVersao:
                            atribuicao
                                .numero_versao
                    }
                }
            );


            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "O arquivo desta versão não foi encontrado."
                },
                410
            );
        }


        /*
         * 7. Lê os bytes armazenados.
         */

        const bytes =
            await objeto
                .arrayBuffer();


        const tamanhoAtual =
            bytes.byteLength;


        /*
         * 8. Recalcula SHA-256.
         *
         * Não confiamos apenas no fato de
         * o objeto existir no R2.
         */

        const sha256Atual =
            await calcularSha256(
                bytes
            );


        const sha256Esperado =
            String(
                atribuicao.sha256
            ).toLowerCase();


        const hashValido =
            sha256Atual.toLowerCase() ===
            sha256Esperado;


        /*
         * Também validamos o tamanho,
         * quando ele existir no cadastro.
         */

        const tamanhoEsperado =
            atribuicao.tamanho_bytes ===
                null
                ? null
                : Number(
                    atribuicao
                        .tamanho_bytes
                );


        const tamanhoValido =
            tamanhoEsperado === null ||
            tamanhoAtual ===
                tamanhoEsperado;


        /*
         * 9. Qualquer divergência bloqueia
         * imediatamente a entrega.
         */

        if (
            !hashValido ||
            !tamanhoValido
        ) {

            await registrarAuditoria(
                context,
                {
                    evento:
                        "DOCUMENTO_INTEGRIDADE_FALHA",

                    resultado:
                        "NEGADO",

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
                        atribuicaoId,

                        documentoId:
                            atribuicao
                                .documento_id,

                        documentoVersaoId:
                            atribuicao
                                .documento_versao_id,

                        numeroVersao:
                            atribuicao
                                .numero_versao,

                        sha256Esperado,

                        sha256Encontrado:
                            sha256Atual,

                        tamanhoEsperado,

                        tamanhoEncontrado:
                            tamanhoAtual
                    }
                }
            );


            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "A integridade do documento não pôde ser confirmada."
                },
                409
            );
        }


        /*
         * 10. Integridade confirmada.
         *
         * Registramos exatamente qual arquivo
         * foi entregue ao colaborador.
         */

        await registrarAuditoria(
            context,
            {
                evento:
                    "DOCUMENTO_ARQUIVO_ENTREGUE",

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
                    atribuicaoId,

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
                        sha256Atual,

                    tamanhoBytes:
                        tamanhoAtual,

                    integridadeConfirmada:
                        true
                }
            }
        );


        /*
         * 11. Entrega o PDF somente agora.
         */

        const nomeArquivo =
            nomeSeguroCabecalho(
                atribuicao
                    .nome_arquivo
            );


        return new Response(
            bytes,
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "application/pdf",

                    "Content-Disposition":
                        `inline; filename="${nomeArquivo}"`,

                    "Content-Length":
                        String(
                            tamanhoAtual
                        ),

                    "Cache-Control":
                        "private, no-store, max-age=0",

                    "Pragma":
                        "no-cache",

                    "X-Content-Type-Options":
                        "nosniff"
                }
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao entregar documento:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,

                mensagem:
                    "Não foi possível carregar o arquivo do documento."
            },
            500
        );
    }
}