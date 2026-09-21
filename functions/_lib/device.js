const NOME_COOKIE =
    "assinator_device";

const DURACAO_DISPOSITIVO_SEGUNDOS =
    180 * 24 * 60 * 60;


function bytesParaBase64Url(bytes) {

    let texto = "";

    for (const byte of bytes) {
        texto += String.fromCharCode(byte);
    }

    return btoa(texto)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}


function bytesParaHex(bytes) {

    return Array.from(bytes)
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");
}


export async function gerarTokenDispositivo() {

    const bytes =
        crypto.getRandomValues(
            new Uint8Array(32)
        );


    const token =
        bytesParaBase64Url(bytes);


    const tokenHash =
        await hashTokenDispositivo(
            token
        );


    return {
        token,
        tokenHash
    };
}


export async function hashTokenDispositivo(
    token
) {

    const encoder =
        new TextEncoder();


    const hash =
        await crypto.subtle.digest(
            "SHA-256",
            encoder.encode(token)
        );


    return bytesParaHex(
        new Uint8Array(hash)
    );
}


export function obterTokenDispositivo(
    request
) {

    const cookie =
        request.headers.get("Cookie");


    if (!cookie) {
        return null;
    }


    const cookies =
        cookie.split(";");


    for (const item of cookies) {

        const [nome, ...resto] =
            item.trim().split("=");


        if (nome === NOME_COOKIE) {

            try {

                return decodeURIComponent(
                    resto.join("=")
                );

            } catch {

                return null;

            }
        }
    }


    return null;
}


export function criarCookieDispositivo(
    token,
    request
) {

    const url =
        new URL(request.url);


    const secure =
        url.protocol === "https:"
            ? "; Secure"
            : "";


    return [
        `${NOME_COOKIE}=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        `Max-Age=${DURACAO_DISPOSITIVO_SEGUNDOS}`
    ].join("; ") + secure;
}

export async function obterDispositivoAutorizado(
    context
) {

    const token =
        obterTokenDispositivo(
            context.request
        );


    if (!token) {
        return null;
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
                    local,
                    ativo,
                    ativado_em

                FROM dispositivos

                WHERE
                    token_hash = ?1
                    AND ativo = 1
                    AND ativado_em IS NOT NULL

                LIMIT 1
                `
            )
            .bind(tokenHash)
            .first();


    if (!dispositivo) {
        return null;
    }


    await context.env.DB
        .prepare(
            `
            UPDATE dispositivos

            SET
                ultimo_acesso_em =
                    CURRENT_TIMESTAMP

            WHERE id = ?1
            `
        )
        .bind(
            dispositivo.id
        )
        .run();


    return dispositivo;
}