import {
    obterTokenDispositivo,
    hashTokenDispositivo
} from "../../_lib/device.js";


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

        const token =
            obterTokenDispositivo(
                context.request
            );


        if (!token) {

            return respostaJson(
                {
                    ativado: false
                },
                401
            );
        }


        const tokenHash =
            await hashTokenDispositivo(
                token
            );


        const dispositivo =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        codigo,
                        nome,
                        local

                    FROM dispositivos

                    WHERE
                        token_hash = ?1
                        AND ativo = 1

                    LIMIT 1
                    `
                )
                .bind(tokenHash)
                .first();


        if (!dispositivo) {

            return respostaJson(
                {
                    ativado: false
                },
                401
            );
        }


        await context.env.DB
            .prepare(
                `
                UPDATE dispositivos

                SET ultimo_acesso_em =
                    CURRENT_TIMESTAMP

                WHERE id = ?1
                `
            )
            .bind(
                dispositivo.id
            )
            .run();


        return respostaJson(
            {
                ativado: true,
                dispositivo
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao verificar dispositivo:",
            erro
        );


        return respostaJson(
            {
                ativado: false
            },
            500
        );
    }
}