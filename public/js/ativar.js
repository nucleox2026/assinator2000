const formAtivacao =
    document.getElementById(
        "formAtivacao"
    );

const campoUsuario =
    document.getElementById(
        "usuario"
    );

const campoCodigo =
    document.getElementById(
        "codigo"
    );

const campoPin =
    document.getElementById(
        "pin"
    );

const campoConfirmarPin =
    document.getElementById(
        "confirmarPin"
    );

const botaoAtivar =
    document.getElementById(
        "botaoAtivar"
    );

const mensagem =
    document.getElementById(
        "mensagem"
    );


function somenteNumeros(campo) {

    campo.addEventListener(
        "input",
        function () {

            campo.value =
                campo.value.replace(
                    /\D/g,
                    ""
                );

        }
    );
}


somenteNumeros(campoCodigo);
somenteNumeros(campoPin);
somenteNumeros(campoConfirmarPin);


function mostrarMensagem(
    texto,
    tipo
) {

    mensagem.textContent =
        texto;

    mensagem.className =
        `mensagem ${tipo}`;
}


function limparMensagem() {

    mensagem.textContent = "";

    mensagem.className =
        "mensagem";
}


function alterarCarregamento(
    carregando
) {

    botaoAtivar.disabled =
        carregando;


    botaoAtivar.textContent =
        carregando
            ? "Ativando..."
            : "Criar PIN pessoal";
}


formAtivacao.addEventListener(
    "submit",

    async function (evento) {

        evento.preventDefault();


        limparMensagem();


        const usuario =
            campoUsuario.value
                .trim()
                .toLowerCase();


        const codigo =
            campoCodigo.value.trim();


        const pin =
            campoPin.value.trim();


        const confirmarPin =
            campoConfirmarPin
                .value
                .trim();


        if (!usuario) {

            mostrarMensagem(
                "Informe seu usuário.",
                "erro"
            );

            return;
        }


        if (!/^\d{8}$/.test(codigo)) {

            mostrarMensagem(
                "O código temporário deve conter 8 números.",
                "erro"
            );

            return;
        }


        if (!/^\d{6}$/.test(pin)) {

            mostrarMensagem(
                "O PIN deve conter exatamente 6 números.",
                "erro"
            );

            return;
        }


        if (pin !== confirmarPin) {

            mostrarMensagem(
                "Os PINs não são iguais.",
                "erro"
            );

            return;
        }


        alterarCarregamento(true);


        try {

            const resposta =
                await fetch(
                    "/api/auth/ativar",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            usuario,
                            codigo,
                            pin,
                            confirmarPin
                        })
                    }
                );


            const resultado =
                await resposta.json();


            if (!resposta.ok) {

                mostrarMensagem(
                    resultado.mensagem ||
                    "Não foi possível ativar a credencial.",
                    "erro"
                );

                return;
            }


            mostrarMensagem(
                "PIN criado com sucesso. Você já pode entrar no Assinator2000.",
                "sucesso"
            );


            campoCodigo.value = "";
            campoPin.value = "";
            campoConfirmarPin.value = "";


            setTimeout(
                function () {

                    window.location.href =
                        "/";

                },
                1500
            );


        } catch (erro) {

            console.error(
                "Erro de comunicação:",
                erro
            );


            mostrarMensagem(
                "Não foi possível conectar ao servidor.",
                "erro"
            );


        } finally {

            alterarCarregamento(false);

        }

    }
);