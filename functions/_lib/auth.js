import {
    obterTokenSessao,
    hashTokenSessao
} from "./session.js";


export async function obterUsuarioAutenticado(context) {

    const token =
        obterTokenSessao(
            context.request
        );


    if (!token) {
        return null;
    }


    const tokenHash =
        await hashTokenSessao(token);


    const agora =
        new Date().toISOString();


    const usuario =
        await context.env.DB
            .prepare(
                `
                SELECT
                    u.id,
                    u.nome,
                    u.usuario,
                    u.setor,
                    u.perfil

                FROM sessoes s

                INNER JOIN usuarios u
                    ON u.id = s.usuario_id

                WHERE
                    s.token_hash = ?1
                    AND s.expira_em > ?2
                    AND u.ativo = 1

                LIMIT 1
                `
            )
            .bind(
                tokenHash,
                agora
            )
            .first();


    return usuario || null;
}