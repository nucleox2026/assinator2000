import {
    obterContextoAutenticado
} from "../../_lib/auth.js";


import {
    prepararAuditoria
} from "../../_lib/audit.js";


import {
    calcularSha256
} from "../../_lib/hash.js";


const TAMANHO_MAXIMO_BYTES =
    10 * 1024 * 1024;


const PERFIS_PUBLICADORES =
    new Set([
        "RH",
        "JURIDICO",
        "GOVERNANCA"
    ]);


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


function nomeSeguroArquivo(
    nome
) {

    const limpo =
        String(nome || "documento.pdf")
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            )
            .slice(
                0,
                150
            );


    if (
        limpo
            .toLowerCase()
            .endsWith(".pdf")
    ) {

        return limpo;
    }


    return `${limpo}.pdf`;
}


function possuiCabecalhoPdf(
    bytes
) {

    if (
        bytes.byteLength < 5
    ) {
        return false;
    }


    const inicio =
        new Uint8Array(
            bytes,
            0,
            5
        );


    /*
     * %PDF-
     */

    return (
        inicio[0] === 0x25 &&
        inicio[1] === 0x50 &&
        inicio[2] === 0x44 &&
        inicio[3] === 0x46 &&
        inicio[4] === 0x2D
    );
}


export async function onRequestPost(
    context
) {

    let chaveR2 = null;

    let objetoR2Gravado =
        false;

    let publicacaoPersistida =
        false;


    try {

        /*
         * 1. Autenticação completa:
         *
         * usuário + sessão + tablet.
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
         * 2. Somente perfis autorizados
         * podem publicar versões.
         */

        const perfil =
            String(
                autenticacao
                    .usuario
                    .perfil || ""
            )
                .trim()
                .toUpperCase();


        if (
            !PERFIS_PUBLICADORES
                .has(perfil)
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Seu perfil não possui permissão para publicar documentos."
                },
                403
            );
        }


        /*
         * 3. Confirma binding do R2.
         */

        if (
            !context.env.DOCUMENTOS
        ) {

            throw new Error(
                "Binding R2 DOCUMENTOS não configurado."
            );
        }


        /*
         * 4. Recebe multipart/form-data.
         */

        const formulario =
            await context.request
                .formData();


        const documentoId =
            Number(
                formulario.get(
                    "documentoId"
                )
            );


        const arquivo =
            formulario.get(
                "arquivo"
            );


        if (
            !Number.isInteger(
                documentoId
            ) ||
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


        if (
            !arquivo ||
            typeof arquivo.arrayBuffer
                !== "function"
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Selecione um arquivo PDF."
                },
                400
            );
        }


        /*
         * 5. Valida tamanho antes de
         * carregar o conteúdo todo.
         */

        if (
            Number(arquivo.size) <= 0
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "O arquivo está vazio."
                },
                400
            );
        }


        if (
            Number(arquivo.size) >
            TAMANHO_MAXIMO_BYTES
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "O PDF excede o limite de 10 MB."
                },
                413
            );
        }


        /*
         * 6. Confirma que o cadastro base
         * do documento existe e está ativo.
         */

        const documento =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        codigo,
                        titulo,
                        ativo

                    FROM documentos

                    WHERE
                        id = ?1
                        AND ativo = 1

                    LIMIT 1
                    `
                )
                .bind(
                    documentoId
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
         * 7. Lê os bytes reais.
         */

        const bytes =
            await arquivo
                .arrayBuffer();


        /*
         * Não confiamos somente no
         * Content-Type enviado pelo browser.
         */

        if (
            !possuiCabecalhoPdf(
                bytes
            )
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "O arquivo enviado não possui um cabeçalho PDF válido."
                },
                415
            );
        }


        /*
         * 8. SHA-256 calculado pelo servidor
         * sobre os bytes exatos.
         */

        const sha256 =
            await calcularSha256(
                bytes
            );


        /*
         * 9. Obtém a última versão.
         */

        const ultimaVersao =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        numero_versao,
                        sha256

                    FROM documento_versoes

                    WHERE documento_id = ?1

                    ORDER BY
                        numero_versao DESC

                    LIMIT 1
                    `
                )
                .bind(
                    documento.id
                )
                .first();


        /*
         * Não criamos uma nova versão se
         * os bytes forem exatamente iguais
         * aos da versão mais recente.
         */

        if (
            ultimaVersao &&
            String(
                ultimaVersao.sha256
            ).toLowerCase() ===
            sha256.toLowerCase()
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Este conteúdo já corresponde à versão mais recente do documento."
                },
                409
            );
        }


        const numeroVersao =
            Number(
                ultimaVersao
                    ?.numero_versao || 0
            ) + 1;


        const nomeArquivo =
            nomeSeguroArquivo(
                arquivo.name
            );


        /*
         * A chave física nunca depende
         * exclusivamente do nome enviado
         * pelo usuário.
         */

        chaveR2 =
            [
                "documentos",
                String(
                    documento.id
                ),
                `v${numeroVersao}`,
                `${crypto.randomUUID()}.pdf`
            ].join("/");


        /*
         * 10. Armazena os mesmos bytes
         * que produziram o SHA-256.
         */

        await context.env.DOCUMENTOS
            .put(
                chaveR2,
                bytes,
                {
                    httpMetadata: {
                        contentType:
                            "application/pdf",

                        contentDisposition:
                            `attachment; filename="${nomeArquivo}"`
                    },

                    customMetadata: {
                        documentoId:
                            String(
                                documento.id
                            ),

                        documentoCodigo:
                            String(
                                documento.codigo
                            ),

                        numeroVersao:
                            String(
                                numeroVersao
                            ),

                        sha256:
                            sha256
                    }
                }
            );


        objetoR2Gravado =
            true;


        /*
         * 11. Prepara a versão imutável.
         */

        const inserirVersao =
            context.env.DB
                .prepare(
                    `
                    INSERT INTO documento_versoes (
                        documento_id,
                        numero_versao,
                        nome_arquivo,
                        mime_type,
                        tamanho_bytes,
                        sha256,
                        origem_tipo,
                        origem_referencia,
                        publicado_por_usuario_id
                    )

                    VALUES (
                        ?1,
                        ?2,
                        ?3,
                        'application/pdf',
                        ?4,
                        ?5,
                        'R2',
                        ?6,
                        ?7
                    )
                    `
                )
                .bind(
                    documento.id,
                    numeroVersao,
                    nomeArquivo,
                    bytes.byteLength,
                    sha256,
                    chaveR2,
                    autenticacao
                        .usuario
                        .id
                );


        /*
         * 12. Prepara a auditoria.
         *
         * Ela será executada no MESMO batch
         * da criação da versão.
         */

        const inserirAuditoria =
            prepararAuditoria(
                context,
                {
                    evento:
                        "DOCUMENTO_VERSAO_PUBLICADA",

                    resultado:
                        "SUCESSO",

                    usuario:
                        autenticacao
                            .usuario,

                    sessao:
                        autenticacao
                            .sessao,

                    dispositivo:
                        autenticacao
                            .dispositivo,

                    recursoTipo:
                        "DOCUMENTO_VERSAO",

                    recursoId:
                        `${documento.id}:${numeroVersao}`,

                    detalhes: {
                        documentoId:
                            documento.id,

                        codigoDocumento:
                            documento.codigo,

                        numeroVersao,

                        nomeArquivo,

                        tamanhoBytes:
                            bytes.byteLength,

                        sha256,

                        origem:
                            "R2"
                    }
                }
            );


        /*
         * D1.batch() mantém versão e
         * auditoria na mesma transação.
         */

        await context.env.DB
            .batch([
                inserirVersao,
                inserirAuditoria
            ]);


        publicacaoPersistida =
            true;


        /*
         * 13. Recupera o registro recém
         * criado para a resposta.
         */

        const versao =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        documento_id,
                        numero_versao,
                        nome_arquivo,
                        mime_type,
                        tamanho_bytes,
                        sha256,
                        origem_tipo,
                        origem_referencia,
                        publicado_por_usuario_id,
                        publicado_em

                    FROM documento_versoes

                    WHERE
                        documento_id = ?1

                        AND numero_versao = ?2

                    LIMIT 1
                    `
                )
                .bind(
                    documento.id,
                    numeroVersao
                )
                .first();


        return respostaJson(
            {
                sucesso: true,

                mensagem:
                    "Versão publicada com sucesso.",

                documento: {
                    id:
                        documento.id,

                    codigo:
                        documento.codigo,

                    titulo:
                        documento.titulo
                },

                versao: {
                    id:
                        versao.id,

                    numero:
                        versao.numero_versao,

                    nomeArquivo:
                        versao.nome_arquivo,

                    tamanhoBytes:
                        versao.tamanho_bytes,

                    sha256:
                        versao.sha256,

                    publicadoEm:
                        versao.publicado_em
                }
            },
            201
        );


    } catch (erro) {

        /*
         * O R2 não participa da transação
         * do D1.
         *
         * Se o upload ocorreu, mas o D1
         * não confirmou a publicação,
         * removemos o objeto órfão.
         */

        if (
            objetoR2Gravado &&
            !publicacaoPersistida &&
            chaveR2
        ) {

            try {

                await context.env
                    .DOCUMENTOS
                    .delete(
                        chaveR2
                    );

            } catch (
                erroLimpeza
            ) {

                console.error(
                    "Falha ao remover objeto R2 órfão:",
                    erroLimpeza
                );
            }
        }


        const mensagemErro =
            String(
                erro?.message ||
                erro ||
                ""
            );


        /*
         * Pode acontecer em duas publicações
         * simultâneas da mesma próxima versão.
         */

        if (
            mensagemErro
                .includes(
                    "UNIQUE constraint failed"
                )
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Houve um conflito ao gerar a próxima versão. Tente publicar novamente."
                },
                409
            );
        }


        console.error(
            "Erro ao publicar versão:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,

                mensagem:
                    "Não foi possível publicar a versão do documento."
            },
            500
        );
    }
}