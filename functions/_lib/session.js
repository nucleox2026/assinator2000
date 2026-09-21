const NOME_COOKIE = "assinator_session";

const DURACAO_SESSAO_SEGUNDOS =
    8 * 60 * 60;


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


export async function hashTokenSessao(token) {

    const encoder =
        new TextEncoder();

    const dados =
        encoder.encode(token);

    const hash =
        await crypto.subtle.digest(
            "SHA-256",
            dados
        );

    return bytesParaHex(
        new Uint8Array(hash)
    );
}


export async function gerarTokenSessao() {

    const bytes =
        crypto.getRandomValues(
            new Uint8Array(32)
        );

    const token =
        bytesParaBase64Url(bytes);

    const tokenHash =
        await hashTokenSessao(token);

    return {
        token,
        tokenHash
    };
}


export function obterTokenSessao(request) {

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

            const valor =
                resto.join("=");

            try {
                return decodeURIComponent(valor);
            } catch {
                return null;
            }
        }
    }


    return null;
}


export function criarCookieSessao(
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
        `Max-Age=${DURACAO_SESSAO_SEGUNDOS}`
    ].join("; ") + secure;
}


export function apagarCookieSessao(
    request
) {

    const url =
        new URL(request.url);

    const secure =
        url.protocol === "https:"
            ? "; Secure"
            : "";


    return [
        `${NOME_COOKIE}=`,
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        "Max-Age=0"
    ].join("; ") + secure;
}


export const DURACAO_SESSAO =
    DURACAO_SESSAO_SEGUNDOS;