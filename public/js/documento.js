const tituloDocumento =
    document.getElementById(
        "tituloDocumento"
    );


const codigoDocumento =
    document.getElementById(
        "codigoDocumento"
    );


const numeroVersao =
    document.getElementById(
        "numeroVersao"
    );


const statusDocumento =
    document.getElementById(
        "statusDocumento"
    );


const sha256Documento =
    document.getElementById(
        "sha256Documento"
    );


const estadoCarregamento =
    document.getElementById(
        "estadoCarregamento"
    );


const conteudoDocumento =
    document.getElementById(
        "conteudoDocumento"
    );


const pdfViewer =
    document.getElementById(
        "pdfViewer"
    );


const confirmarVisualizacao =
    document.getElementById(
        "confirmarVisualizacao"
    );


const botaoConcluir =
    document.getElementById(
        "botaoConcluir"
    );


const mensagemLeitura =
    document.getElementById(
        "mensagemLeitura"
    );


let atribuicaoId = null;

let pdfObjectUrl = null;

let arquivoCarregado = false;

let leituraJaConcluida = false;


function mostrarMensagem(
    texto,
    tipo = ""
) {

    mensagemLeitura.textContent =
        texto;


    mensagemLeitura.className =
        `mensagem ${tipo}`;
}


function atualizarBotao() {

    botaoConcluir.disabled =
        leituraJaConcluida ||
        !arquivoCarregado ||
        !confirmarVisualizacao.checked;
}


function encerrarComErro(
    mensagem
) {

    estadoCarregamento.textContent =
        mensagem;


    conteudoDocumento.hidden =
        true;
}


async function carregarAtribuicao() {

    const parametros =
        new URLSearchParams(
            window.location.search
        );


    atribuicaoId =
        Number(
            parametros.get(
                "atribuicao"
            )
        );


    if (
        !Number.isInteger(
            atribuicaoId
        ) ||
        atribuicaoId <= 0
    ) {

        encerrarComErro(
            "Atribuição inválida."
        );

        return;
    }


    try {

        /*
         * 1. Carrega os metadados da
         * atribuição e registra a abertura.
         */

        const resposta =
            await fetch(
                `/api/atribuicoes/${atribuicaoId}`,
                {
                    cache:
                        "no-store"
                }
            );


        const resultado =
            await resposta.json();


        if (
            resposta.status === 401
        ) {

            window.location.href =
                "/";

            return;
        }


        if (!resposta.ok) {

            encerrarComErro(
                resultado.mensagem ||
                "Não foi possível abrir o documento."
            );

            return;
        }


        tituloDocumento.textContent =
            resultado.documento.titulo;


        codigoDocumento.textContent =
            resultado.documento.codigo;


        numeroVersao.textContent =
            resultado.versao.numero;


        statusDocumento.textContent =
            resultado.atribuicao.status;


        sha256Documento.textContent =
            resultado.versao.sha256;


        leituraJaConcluida =
            Boolean(
                resultado
                    .atribuicao
                    .leituraConcluidaEm
            );


        /*
         * 2. Busca o PDF pelo endpoint
         * protegido.
         *
         * O servidor recalcula o SHA-256
         * antes de devolver os bytes.
         */

        const respostaArquivo =
            await fetch(
                `/api/atribuicoes/${atribuicaoId}/arquivo`,
                {
                    cache:
                        "no-store"
                }
            );


        if (!respostaArquivo.ok) {

            let mensagem =
                "Não foi possível carregar o PDF.";


            try {

                const erro =
                    await respostaArquivo
                        .json();


                mensagem =
                    erro.mensagem ||
                    mensagem;

            } catch {
                // Mantém mensagem padrão.
            }


            encerrarComErro(
                mensagem
            );

            return;
        }


        const contentType =
            respostaArquivo
                .headers
                .get(
                    "Content-Type"
                );


        if (
            !contentType ||
            !contentType
                .toLowerCase()
                .includes(
                    "application/pdf"
                )
        ) {

            encerrarComErro(
                "O servidor não retornou um PDF válido."
            );

            return;
        }


        const blob =
            await respostaArquivo
                .blob();


        pdfObjectUrl =
            URL.createObjectURL(
                blob
            );


        /*
         * Só liberamos a manifestação
         * quando o visualizador carregar.
         *
         * O listener é registrado antes do src
         * para evitar perder um carregamento rápido.
         */

        pdfViewer.addEventListener(
            "load",
            function () {

                arquivoCarregado =
                    true;


                estadoCarregamento.hidden =
                    true;


                conteudoDocumento.hidden =
                    false;


                if (
                    leituraJaConcluida
                ) {

                    confirmarVisualizacao
                        .checked =
                        true;


                    confirmarVisualizacao
                        .disabled =
                        true;


                    botaoConcluir.disabled =
                        true;


                    botaoConcluir.textContent =
                        "Leitura já concluída";


                    mostrarMensagem(
                        "A leitura deste documento já foi concluída.",
                        "sucesso"
                    );

                } else {

                    confirmarVisualizacao
                        .disabled =
                        false;


                    atualizarBotao();
                }

            },
            {
                once:
                    true
            }
        );


        pdfViewer.src =
            pdfObjectUrl;


    } catch (erro) {

        console.error(
            "Erro ao carregar documento:",
            erro
        );


        encerrarComErro(
            "Não foi possível carregar o documento."
        );
    }
}


confirmarVisualizacao.addEventListener(
    "change",
    atualizarBotao
);


botaoConcluir.addEventListener(
    "click",

    async function () {

        if (
            !arquivoCarregado ||
            !confirmarVisualizacao
                .checked ||
            leituraJaConcluida
        ) {

            return;
        }


        botaoConcluir.disabled =
            true;


        botaoConcluir.textContent =
            "Registrando...";


        mostrarMensagem(
            "Registrando a conclusão da leitura..."
        );


        try {

            const resposta =
                await fetch(
                    `/api/atribuicoes/${atribuicaoId}/leitura-concluida`,
                    {
                        method:
                            "POST",

                        cache:
                            "no-store"
                    }
                );


            const resultado =
                await resposta.json();


            if (!resposta.ok) {

                mostrarMensagem(
                    resultado.mensagem ||
                    "Não foi possível concluir a leitura.",
                    "erro"
                );


                botaoConcluir.disabled =
                    false;


                botaoConcluir.textContent =
                    "Concluir leitura";


                return;
            }


            leituraJaConcluida =
                true;


            statusDocumento.textContent =
                "EM_LEITURA";


            confirmarVisualizacao.disabled =
                true;


            botaoConcluir.disabled =
                true;


            botaoConcluir.textContent =
                "Leitura concluída";


            mostrarMensagem(
                "Leitura registrada com sucesso.",
                "sucesso"
            );


        } catch (erro) {

            console.error(
                "Erro ao concluir leitura:",
                erro
            );


            mostrarMensagem(
                "Não foi possível conectar ao servidor.",
                "erro"
            );


            botaoConcluir.disabled =
                false;


            botaoConcluir.textContent =
                "Concluir leitura";
        }

    }
);


window.addEventListener(
    "beforeunload",
    function () {

        if (pdfObjectUrl) {

            URL.revokeObjectURL(
                pdfObjectUrl
            );
        }

    }
);


carregarAtribuicao();