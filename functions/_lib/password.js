const ITERACOES_PBKDF2 = 600000

function bytesParaBase64(bytes) {
    let texto = "";

    for (const byte of bytes) {
        texto += String.fromCharCode(byte);
    }

    return btoa(texto);
}

function base64ParaBytes(base64) {
    const texto = atob(base64);

    const bytes = new Uint8Array(texto.length);

    for (let i = 0; i < texto.length; i++) {
        bytes[i] = texto.charCodeAt(i);
    }

    return bytes;
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

export async function verificarSenha(
        senha,
        saltBase64,
        hashEsperadoBase64,
        pepper
    ) {

        const salt = base64ParaBytes(saltBase64);

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

        const hashCalculado = await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt,
                iterations: ITERACOES_PBKDF2,
                hash: "SHA-256"
            },
            chave,
            256
        );

        const calculado = new Uint8Array(hashCalculado);

        const esperado = base64ParaBytes(
            hashEsperadoBase64
        );

        if (calculado.length !== esperado.length) {
            return false;
        }

        let diferenca = 0;

        for (let i = 0; i < calculado.length; i++) {
            diferenca |= calculado[i] ^ esperado [i];
        }

        return diferenca === 0;
    }