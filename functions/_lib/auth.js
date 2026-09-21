import {
    obterTokenSessao,
    hashTokenSessao
} from "./session.js";


import {
    obterDispositivoAutorizado
} from "./device.js";


export async function obterContextoAutenticado(
    context
) {

    /*
     * 1. Verifica o tablet corporativo.
     */

    const dispositivo =
        await obterDispositivoAutorizado(
            context
        );


    if (!dispositivo) {
        return null;
    }


    /*
     * 2. Obtém o cookie da sessão
     * do colaborador.
     */

    const token =
        obterTokenSessao(
            context.request
        );


    if (!token) {
        return null;
    }


    const tokenHash =
        await hashTokenSessao(
            token
        );


    const agora =
        new Date().toISOString();


    /*
     * 3. Procura uma sessão válida
     * vinculada AO MESMO tablet.
     */

    const registro =
        await context.env.DB
            .prepare(
                `
                SELECT
                    s.id AS sessao_id,
                    s.expira_em,
                    s.criado_em
                        AS sessao_criada_em,

                    u.id
                        AS usuario_id,
                    u.codigo_funcional,
                    u.nome,
                    u.usuario,
                    u.setor,
                    u.perfil,

                    d.id
                        AS dispositivo_id,
                    d.codigo
                        AS dispositivo_codigo,
                    d.nome
                        AS dispositivo_nome,
                    d.local
                        AS dispositivo_local

                FROM sessoes s

                INNER JOIN usuarios u
                    ON u.id = s.usuario_id

                INNER JOIN dispositivos d
                    ON d.id = s.dispositivo_id

                WHERE
                    s.token_hash = ?1

                    AND s.dispositivo_id = ?2

                    AND s.expira_em > ?3

                    AND u.ativo = 1

                    AND d.ativo = 1

                LIMIT 1
                `
            )
            .bind(
                tokenHash,
                dispositivo.id,
                agora
            )
            .first();


    if (!registro) {
        return null;
    }


    /*
     * 4. Atualiza o último acesso
     * daquela sessão.
     */

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
            registro.sessao_id
        )
        .run();


    /*
     * 5. Retorna um contexto completo.
     */

    return {

        sessao: {
            id:
                registro.sessao_id,

            criadaEm:
                registro.sessao_criada_em,

            expiraEm:
                registro.expira_em
        },


        usuario: {
            id:
                registro.usuario_id,

            codigoFuncional:
                registro.codigo_funcional,

            nome:
                registro.nome,

            usuario:
                registro.usuario,

            setor:
                registro.setor,

            perfil:
                registro.perfil
        },


        dispositivo: {
            id:
                registro.dispositivo_id,

            codigo:
                registro.dispositivo_codigo,

            nome:
                registro.dispositivo_nome,

            local:
                registro.dispositivo_local
        }

    };
}


/*
 * Mantemos esta função para não quebrar
 * as APIs que já usam obterUsuarioAutenticado().
 */

export async function obterUsuarioAutenticado(
    context
) {

    const contexto =
        await obterContextoAutenticado(
            context
        );


    return contexto?.usuario || null;
}