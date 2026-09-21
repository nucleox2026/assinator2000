const estadoCarregando =
    document.getElementById(
        "estadoCarregando"
    );

const appDashboard =
    document.getElementById(
        "appDashboard"
    );

const nomeUsuario =
    document.getElementById(
        "nomeUsuario"
    );

const setorUsuario =
    document.getElementById(
        "setorUsuario"
    );

const tituloBoasVindas =
    document.getElementById(
        "tituloBoasVindas"
    );

const botaoSair =
    document.getElementById(
        "botaoSair"
    );


async function verificarSessao() {

    try {

        const resposta =
            await fetch(
                "/api/auth/me",
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (!resposta.ok) {

            window.location.replace("/");

            return;
        }


        const dados =
            await resposta.json();


        if (
            !dados.autenticado ||
            !dados.usuario
        ) {

            window.location.replace("/");

            return;
        }


        carregarUsuario(
            dados.usuario
        );


        /*
         * Somente agora mostramos
         * o dashboard.
         */

        estadoCarregando.hidden = true;

        appDashboard.hidden = false;


    } catch (erro) {

        console.error(
            "Erro ao verificar sessão:",
            erro
        );


        estadoCarregando.innerHTML = `
            <p>
                Não foi possível verificar
                sua sessão.
            </p>

            <button
                type="button"
                onclick="window.location.reload()"
            >
                Tentar novamente
            </button>
        `;

    }

}


function carregarUsuario(usuario) {

    nomeUsuario.textContent =
        usuario.nome;

    setorUsuario.textContent =
        usuario.setor || "Sem setor";


    /*
     * Pegamos somente o primeiro nome
     * para a saudação.
     */

    const primeiroNome =
        usuario.nome
            .trim()
            .split(" ")[0];


    tituloBoasVindas.textContent =
        `Olá, ${primeiroNome}`;
}


async function realizarLogout() {

    botaoSair.disabled = true;

    botaoSair.textContent =
        "Saindo...";


    try {

        await fetch(
            "/api/auth/logout",
            {
                method: "POST"
            }
        );

    } catch (erro) {

        console.error(
            "Erro durante logout:",
            erro
        );

    } finally {

        /*
         * Mesmo que exista algum problema
         * de comunicação, voltamos ao login.
         */

        window.location.replace("/");

    }

}


botaoSair.addEventListener(
    "click",
    realizarLogout
);


verificarSessao();