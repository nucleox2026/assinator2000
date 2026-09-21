import {
    obterContextoAutenticado
} from "../../_lib/auth.js";


import {
    prepararAuditoria
} from "../../_lib/audit.js";


const PERFIS_AUTORIZADOS =
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


export async function onRequestPost(
    context
) {

    try {

        /*
         * 1. Confirma usuário + sessão + tablet.
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
         * 2. Somente perfis de gestão documental
         * podem distribuir versões.
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
            !PERFIS_AUTORIZADOS
                .has(perfil)
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Seu perfil não possui permissão para atribuir documentos."
                },
                403
            );
        }


        /*
         * 3. Dados recebidos.
         */

        const dados =
            await context.request.json();


        const documentoVersaoId =
            Number(
                dados.documentoVersaoId
            );


        const usuarioDestino =
            String(
                dados.usuario || ""
            )
                .trim()
                .toLowerCase();


        if (
            !Number.isInteger(
                documentoVersaoId
            ) ||
            documentoVersaoId <= 0 ||
            !usuarioDestino
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Informe a versão do documento e o colaborador."
                },
                400
            );
        }


        /*
         * 4. Localiza a versão imutável.
         */

        const versao =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        dv.id,
                        dv.documento_id,
                        dv.numero_versao,
                        dv.nome_arquivo,
                        dv.sha256,
                        dv.tamanho_bytes,
                        dv.publicado_em,

                        d.codigo,
                        d.titulo,
                        d.ativo

                    FROM documento_versoes dv

                    INNER JOIN documentos d
                        ON d.id =
                            dv.documento_id

                    WHERE
                        dv.id = ?1

                        AND d.ativo = 1

                    LIMIT 1
                    `
                )
                .bind(
                    documentoVersaoId
                )
                .first();


        if (!versao) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Versão do documento não encontrada."
                },
                404
            );
        }


        /*
         * 5. Localiza o colaborador de destino.
         */

        const colaborador =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        codigo_funcional,
                        nome,
                        usuario,
                        setor,
                        perfil,
                        ativo,
                        credencial_ativada

                    FROM usuarios

                    WHERE usuario = ?1

                    LIMIT 1
                    `
                )
                .bind(
                    usuarioDestino
                )
                .first();


        if (
            !colaborador ||
            colaborador.ativo !== 1
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Colaborador não encontrado ou inativo."
                },
                404
            );
        }


        /*
         * 6. Não permitimos a mesma versão
         * duas vezes para a mesma pessoa.
         */

        const atribuicaoExistente =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        status,
                        atribuido_em

                    FROM documentos_usuarios

                    WHERE
                        documento_versao_id = ?1

                        AND usuario_id = ?2

                    LIMIT 1
                    `
                )
                .bind(
                    versao.id,
                    colaborador.id
                )
                .first();


        if (atribuicaoExistente) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Esta versão já está atribuída a este colaborador.",

                    atribuicao: {
                        id:
                            atribuicaoExistente.id,

                        status:
                            atribuicaoExistente.status,

                        atribuidoEm:
                            atribuicaoExistente
                                .atribuido_em
                    }
                },
                409
            );
        }


        /*
         * 7. Preparamos a nova atribuição.
         */

        const inserirAtribuicao =
            context.env.DB
                .prepare(
                    `
                    INSERT INTO documentos_usuarios (
                        documento_id,
                        documento_versao_id,
                        usuario_id,
                        status
                    )

                    VALUES (
                        ?1,
                        ?2,
                        ?3,
                        'PENDENTE'
                    )
                    `
                )
                .bind(
                    versao.documento_id,
                    versao.id,
                    colaborador.id
                );


        /*
         * 8. Preparamos também a auditoria.
         */

        const inserirAuditoria =
            prepararAuditoria(
                context,
                {
                    evento:
                        "DOCUMENTO_VERSAO_ATRIBUIDA",

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
                        versao.id,

                    detalhes: {
                        documentoId:
                            versao.documento_id,

                        documentoCodigo:
                            versao.codigo,

                        documentoVersaoId:
                            versao.id,

                        numeroVersao:
                            versao.numero_versao,

                        sha256:
                            versao.sha256,

                        usuarioDestinoId:
                            colaborador.id,

                        usuarioDestinoCodigoFuncional:
                            colaborador.codigo_funcional,

                        usuarioDestinoLogin:
                            colaborador.usuario
                    }
                }
            );


        /*
         * Atribuição e auditoria precisam
         * ser confirmadas juntas.
         */

        await context.env.DB
            .batch([
                inserirAtribuicao,
                inserirAuditoria
            ]);


        /*
         * 9. Recupera a atribuição criada.
         */

        const atribuicao =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        status,
                        atribuido_em

                    FROM documentos_usuarios

                    WHERE
                        documento_versao_id = ?1

                        AND usuario_id = ?2

                    LIMIT 1
                    `
                )
                .bind(
                    versao.id,
                    colaborador.id
                )
                .first();


        return respostaJson(
            {
                sucesso: true,

                mensagem:
                    "Versão atribuída ao colaborador com sucesso.",

                atribuicao: {
                    id:
                        atribuicao.id,

                    status:
                        atribuicao.status,

                    atribuidoEm:
                        atribuicao.atribuido_em
                },

                colaborador: {
                    id:
                        colaborador.id,

                    codigoFuncional:
                        colaborador.codigo_funcional,

                    nome:
                        colaborador.nome,

                    usuario:
                        colaborador.usuario
                },

                documento: {
                    id:
                        versao.documento_id,

                    codigo:
                        versao.codigo,

                    titulo:
                        versao.titulo
                },

                versao: {
                    id:
                        versao.id,

                    numero:
                        versao.numero_versao,

                    sha256:
                        versao.sha256
                }
            },
            201
        );


    } catch (erro) {

        const mensagemErro =
            String(
                erro?.message ||
                erro ||
                ""
            );


        if (
            mensagemErro.includes(
                "UNIQUE constraint failed"
            )
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Esta versão já está atribuída ao colaborador."
                },
                409
            );
        }


        console.error(
            "Erro ao atribuir versão:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,

                mensagem:
                    "Não foi possível atribuir a versão do documento."
            },
            500
        );
    }
}