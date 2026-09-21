import {
    obterContextoAutenticado
} from "../../../_lib/auth.js";


import {
    prepararAuditoria
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
                    "application/json; charset=UTF-8",

                "Cache-Control":
                    "no-store"
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
         * 2. O ID representa a atribuição.
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
         * 3. Busca exatamente a versão
         * atribuída ao usuário autenticado.
         */

        const atribuicao =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        du.id
                            AS atribuicao_id,

                        du.status,
                        du.visualizado_em,
                        du.leitura_concluida_em,
                        du.assinado_em,

                        d.id
                            AS documento_id,

                        d.codigo
                            AS documento_codigo,

                        d.titulo
                            AS documento_titulo,

                        dv.id
                            AS documento_versao_id,

                        dv.numero_versao,
                        dv.sha256

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
         * 4. O documento precisa ter sido
         * aberto antes.
         */

        if (
            !atribuicao.visualizado_em
        ) {

            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Abra o documento antes de concluir a leitura."
                },
                409
            );
        }


        /*
         * 5. Documento assinado não sofre
         * nova alteração de leitura.
         */

        if (
            atribuicao.assinado_em ||
            atribuicao.status ===
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
         * 6. Operação idempotente.
         */

        if (
            atribuicao
                .leitura_concluida_em
        ) {

            return respostaJson(
                {
                    sucesso: true,

                    leituraConcluida:
                        true,

                    jaConcluida:
                        true,

                    leituraConcluidaEm:
                        atribuicao
                            .leitura_concluida_em
                }
            );
        }


        /*
         * 7. Preparamos a atualização.
         */

        const atualizarLeitura =
            context.env.DB
                .prepare(
                    `
                    UPDATE documentos_usuarios

                    SET
                        leitura_concluida_em =
                            CURRENT_TIMESTAMP,

                        status =
                            'EM_LEITURA'

                    WHERE
                        id = ?1

                        AND usuario_id = ?2

                        AND documento_versao_id = ?3

                        AND leitura_concluida_em
                            IS NULL

                        AND status !=
                            'ASSINADO'
                    `
                )
                .bind(
                    atribuicaoId,

                    autenticacao
                        .usuario
                        .id,

                    atribuicao
                        .documento_versao_id
                );


        /*
         * 8. A auditoria registra a versão
         * e o SHA-256 exatos.
         */

        const registrarLeitura =
            prepararAuditoria(
                context,
                {
                    evento:
                        "LEITURA_CONCLUIDA",

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
                            atribuicao.sha256,

                        manifestacao:
                            "CONFIRMACAO_EXPLICITA_DE_VISUALIZACAO"
                    }
                }
            );


        /*
         * Estado + auditoria no mesmo batch.
         */

        await context.env.DB
            .batch([
                atualizarLeitura,
                registrarLeitura
            ]);


        /*
         * 9. Recupera o horário gravado
         * pelo servidor.
         */

        const atualizado =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        leitura_concluida_em

                    FROM documentos_usuarios

                    WHERE id = ?1

                    LIMIT 1
                    `
                )
                .bind(
                    atribuicaoId
                )
                .first();


        return respostaJson(
            {
                sucesso: true,

                leituraConcluida:
                    true,

                jaConcluida:
                    false,

                leituraConcluidaEm:
                    atualizado
                        ?.leitura_concluida_em ||
                    null,

                mensagem:
                    "Leitura concluída com sucesso."
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao concluir leitura da atribuição:",
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