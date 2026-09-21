const form =
    document.getElementById(
        "formPublicacao"
    );


const campoDocumentoId =
    document.getElementById(
        "documentoId"
    );


const campoArquivo =
    document.getElementById(
        "arquivo"
    );


const mensagem =
    document.getElementById(
        "mensagem"
    );


const botao =
    document.getElementById(
        "botaoPublicar"
    );


function mostrarMensagem(
    texto,
    tipo
) {

    mensagem.textContent =
        texto;


    mensagem.className =
        `mensagem ${tipo}`;
}


form.addEventListener(
    "submit",

    async function (
        evento
    ) {

        evento.preventDefault();


        const documentoId =
            Number(
                campoDocumentoId.value
            );


        if (
            !Number.isInteger(
                documentoId
            ) ||
            documentoId <= 0
        ) {

            mostrarMensagem(
                "Informe um ID de documento válido.",
                "erro"
            );

            return;
        }


        if (
            !campoArquivo.files ||
            campoArquivo.files.length !== 1
        ) {

            mostrarMensagem(
                "Selecione um arquivo PDF.",
                "erro"
            );

            return;
        }


        const arquivo =
            campoArquivo.files[0];


        /*
         * Validação amigável no frontend.
         *
         * O backend continuará fazendo
         * sua própria validação.
         */

        if (
            arquivo.size <= 0
        ) {

            mostrarMensagem(
                "O arquivo está vazio.",
                "erro"
            );

            return;
        }


        if (
            arquivo.size >
            10 * 1024 * 1024
        ) {

            mostrarMensagem(
                "O PDF não pode ultrapassar 10 MB.",
                "erro"
            );

            return;
        }


        const dados =
            new FormData();


        dados.append(
            "documentoId",
            String(
                documentoId
            )
        );


        dados.append(
            "arquivo",
            arquivo
        );


        botao.disabled =
            true;


        botao.textContent =
            "Publicando...";


        mostrarMensagem(
            "Enviando e calculando a integridade do documento...",
            "info"
        );


        try {

            const resposta =
                await fetch(
                    "/api/documentos/publicar-versao",
                    {
                        method:
                            "POST",

                        body:
                            dados
                    }
                );


            const resultado =
                await resposta.json();


            if (!resposta.ok) {

                mostrarMensagem(
                    resultado.mensagem ||
                    "Não foi possível publicar o documento.",
                    "erro"
                );

                return;
            }


            mostrarMensagem(
                `Versão ${resultado.versao.numero} publicada com sucesso. SHA-256: ${resultado.versao.sha256}`,
                "sucesso"
            );


            console.log(
                "Publicação concluída:",
                resultado
            );


            campoArquivo.value =
                "";


        } catch (erro) {

            console.error(
                "Erro durante publicação:",
                erro
            );


            mostrarMensagem(
                "Não foi possível conectar ao servidor.",
                "erro"
            );


        } finally {

            botao.disabled =
                false;


            botao.textContent =
                "Publicar versão";
        }

    }
);