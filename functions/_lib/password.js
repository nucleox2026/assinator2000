const ITERACOES_PBKDF2 = 600000

function bytesParaBase64(bytes) {
    let texto = "";

    for (const byte of bytes) {
        texto += String.fromCharCode(byte);
    }

    return btoa(texto);
}

async function aplicarPepper(senha, pepper) {
    const encoder = new TextEncoder();

    const chavePepper = await crypto.subtle.importKey(
        "raw",
        encoder.encode(pepper),
        {
            name: "HMAC",
            hash: "SHA-256"
        },
        false,
        ["sign"]
    );

    return crypto.subtle.sign(
        "HMAC",
        chavePepper,
        encoder.encode(senha)
    );
}

export async function gerarHashSenha(senha, pepper) {
    const salt = crypto.getRandomValues(
        new Uint8Array(16)
    );

    const senhaProtegida = await aplicarPepper(
        senha,
        pepper
    );

    const chave = await crypto.subtle.importKey(
        "raw",
        senhaProtegida,
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const hash = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt,
            iterations : ITERACOES_PBKDF2,
            hash: "SHA-256"
        },
        chave,
        256
    );

    return {
        hash: bytesParaBase64(
            new Uint8Array(hash)
        ),

        salt: bytesParaBase64(salt)
    };
}