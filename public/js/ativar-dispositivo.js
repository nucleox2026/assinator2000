const form =
    document.getElementById(
        "formDispositivo"
    );

const campoDispositivo =
    document.getElementById(
        "codigoDispositivo"
    );

const campoCodigo =
    document.getElementById(
        "codigoAtivacao"
    );

const botao =
    document.getElementById(
        "botaoAtivar"
    );

const mensagem =
    document.getElementById(
        "mensagem"
    );


campoCodigo.addEventListener(
    "input",
    function () {

        campoCodigo.value =
            campoCodigo.value.replace(
                /\D/g,
                ""
            );

    }
);


campoDispositivo.addEventListener(
    "input",
    function () {

        campoDispositivo.value =
            campoDispositivo.value
                .toUpperCase();

    }
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

    async function (evento) {

        evento.preventDefault();


        const codigoDispositivo =
            campoDispositivo
                .value
                .trim()
                .toUpperCase();


        const codigoAtivacao =
            campoCodigo
                .value
                .trim();


        if (
            !codigoDispositivo ||
            !/^\d{8}$/.test(
                codigoAtivacao
            )
        ) {

            mostrarMensagem(
                "Confira o código do dispositivo e o código temporário.",
                "erro"
            );

            return;
        }


        botao.disabled = true;

        botao.textContent =
            "Ativando...";


        try {

            const resposta =
                await fetch(
                    "/api/dispositivos/ativar",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            codigoDispositivo,
                            codigoAtivacao
                        })
                    }
                );


            const resultado =
                await resposta.json();


            if (!resposta.ok) {

                mostrarMensagem(
                    resultado.mensagem ||
                    "Não foi possível ativar o tablet.",
                    "erro"
                );

                return;
            }


            mostrarMensagem(
                `${resultado.dispositivo.codigo} ativado com sucesso.`,
                "sucesso"
            );


            campoCodigo.value = "";


            setTimeout(
                function () {

                    window.location.href =
                        "/";

                },
                1500
            );


        } catch (erro) {

            console.error(
                "Erro ao ativar tablet:",
                erro
            );


            mostrarMensagem(
                "Não foi possível conectar ao servidor.",
                "erro"
            );


        } finally {

            botao.disabled = false;

            botao.textContent =
                "Ativar este tablet";

        }

    }
);