const formLogin =
    document.getElementById("formLogin");

const campoUsuario =
    document.getElementById("usuario");

const campoSenha =
    document.getElementById("senha");

const botaoEntrar =
    document.getElementById("botaoEntrar");

const mensagem =
    document.getElementById("mensagem");


function mostrarMensagem(texto, tipo) {

    mensagem.textContent = texto;

    mensagem.className =
        `mensagem ${tipo}`;
}


function limparMensagem() {

    mensagem.textContent = "";

    mensagem.className = "mensagem";
}


function alterarEstadoBotao(carregando) {

    botaoEntrar.disabled = carregando;

    botaoEntrar.textContent =
        carregando
            ? "Entrando..."
            : "Entrar";
}


campoSenha.addEventListener("input", function () {

    campoSenha.value =
        campoSenha.value.replace(/\D/g, "");

});


formLogin.addEventListener(
    "submit",
    async function (evento) {

        evento.preventDefault();

        limparMensagem();


        const usuario =
            campoUsuario.value
                .trim()
                .toLowerCase();

        const senha =
            campoSenha.value.trim();


        if (!usuario || !senha) {

            mostrarMensagem(
                "Informe o usuário e a data de nascimento.",
                "erro"
            );

            return;
        }


        if (!/^\d{8}$/.test(senha)) {

            mostrarMensagem(
                "A data de nascimento deve conter 8 números.",
                "erro"
            );

            campoSenha.focus();

            return;
        }


        alterarEstadoBotao(true);


        try {

            const resposta =
                await fetch(
                    "/api/auth/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            usuario,
                            senha
                        })
                    }
                );


            const resultado =
                await resposta.json();


            if (!resposta.ok) {

                mostrarMensagem(
                    resultado.mensagem ||
                    "Não foi possível realizar o login.",
                    "erro"
                );

                campoSenha.value = "";
                campoSenha.focus();

                return;
            }


            mostrarMensagem(
                `Bem-vindo, ${resultado.usuario.nome}.`,
                "sucesso"
            );


            campoSenha.value = "";


            console.log(
                "Usuário autenticado:",
                resultado.usuario
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

            alterarEstadoBotao(false);

        }

    }
);