function bytesParaHex(
    bytes
) {

    return Array
        .from(bytes)
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");
}


export async function calcularSha256(
    conteudo
) {

    let bytes;


    if (
        conteudo instanceof ArrayBuffer
    ) {

        bytes =
            new Uint8Array(
                conteudo
            );

    } else if (
        ArrayBuffer.isView(
            conteudo
        )
    ) {

        bytes =
            new Uint8Array(
                conteudo.buffer,
                conteudo.byteOffset,
                conteudo.byteLength
            );

    } else {

        throw new TypeError(
            "O conteúdo deve ser ArrayBuffer ou uma visão de ArrayBuffer."
        );
    }


    const hash =
        await crypto.subtle.digest(
            "SHA-256",
            bytes
        );


    return bytesParaHex(
        new Uint8Array(
            hash
        )
    );
}


export async function calcularSha256Texto(
    texto
) {

    const bytes =
        new TextEncoder()
            .encode(
                String(texto)
            );


    return calcularSha256(
        bytes
    );
}
