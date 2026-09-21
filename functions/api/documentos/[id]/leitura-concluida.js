import {
    obterContextoAutenticado
} from "../../../_lib/auth.js";


import {
    registrarAuditoria
} from "../../../_lib/audit.js";


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
         * 1. Identifica sessão,
         * colaborador e tablet.
         */

        const contextoAutenticado =
            await obterContextoAutenticado(
                context
            );


        if (!contextoAutenticado) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Sessão inválida ou expirada."
                },
                401
            );
        }


        const documentoId =
            Number(
                context.params.id
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


        /*
         * 2. Confirma que o documento está
         * atribuído ao colaborador.
         */

        const documento =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        d.id,
                        d.codigo,
                        d.titulo,
                        d.versao,

                        du.status,
                        du.visualizado_em,
                        du.leitura_concluida_em,
                        du.assinado_em

                    FROM documentos_usuarios du

                    INNER JOIN documentos d
                        ON d.id =
                            du.documento_id

                    WHERE
                        d.id = ?1

                        AND du.usuario_id = ?2

                        AND d.ativo = 1

                    LIMIT 1
                    `
                )
                .bind(
                    documentoId,
                    contextoAutenticado
                        .usuario
                        .id
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
         * Para concluir a leitura,
         * o documento precisa já ter
         * sido aberto pelo colaborador.
         */

        if (!documento.visualizado_em) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "O documento precisa ser aberto antes da conclusão da leitura."
                },
                409
            );
        }


        /*
         * Documento já assinado não deve
         * sofrer alteração de leitura.
         */

        if (
            documento.assinado_em ||
            documento.status ===
                "ASSINADO"
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Este documento já foi assinado."
                },
                409
            );
        }


        /*
         * A operação é idempotente.
         *
         * Se a leitura já foi concluída,
         * simplesmente informamos isso
         * sem gerar outro evento.
         */

        if (
            documento
                .leitura_concluida_em
        ) {

            return respostaJson(
                {
                    sucesso: true,

                    leituraConcluida:
                        true,

                    jaConcluida:
                        true
                }
            );
        }


        /*
         * 3. Marca a primeira conclusão.
         */

        const resultado =
            await context.env.DB
                .prepare(
                    `
                    UPDATE documentos_usuarios

                    SET
                        leitura_concluida_em =
                            CURRENT_TIMESTAMP,

                        status =
                            'EM_LEITURA'

                    WHERE
                        documento_id = ?1

                        AND usuario_id = ?2

                        AND leitura_concluida_em
                            IS NULL

                        AND status !=
                            'ASSINADO'
                    `
                )
                .bind(
                    documentoId,

                    contextoAutenticado
                        .usuario
                        .id
                )
                .run();


        /*
         * Se outra requisição concluiu
         * simultaneamente, não duplicamos
         * a evidência.
         */

        if (
            Number(
                resultado.meta
                    .changes || 0
            ) === 0
        ) {

            return respostaJson(
                {
                    sucesso: true,

                    leituraConcluida:
                        true,

                    jaConcluida:
                        true
                }
            );
        }


        /*
         * 4. Registra a evidência.
         */

        await registrarAuditoria(
            context,
            {
                evento:
                    "LEITURA_CONCLUIDA",

                resultado:
                    "SUCESSO",

                usuario:
                    contextoAutenticado
                        .usuario,

                sessao:
                    contextoAutenticado
                        .sessao,

                dispositivo:
                    contextoAutenticado
                        .dispositivo,

                recursoTipo:
                    "DOCUMENTO",

                recursoId:
                    documento.id,

                detalhes: {
                    codigoDocumento:
                        documento.codigo,

                    versao:
                        documento.versao
                }
            }
        );


        return respostaJson(
            {
                sucesso: true,

                leituraConcluida:
                    true,

                jaConcluida:
                    false,

                mensagem:
                    "Leitura concluída com sucesso."
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao concluir leitura:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,

                mensagem:
                    "Não foi possível concluir a leitura."
            },
            500
        );
    }
}