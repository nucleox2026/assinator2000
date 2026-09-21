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

const quantidadePendentes =
    document.getElementById(
        "quantidadePendentes"
    );

const quantidadeAssinados =
    document.getElementById(
        "quantidadeAssinados"
    );

const listaDocumentos =
    document.getElementById(
        "listaDocumentos"
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

        await carregarDocumentos();

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

async function carregarDocumentos() {

    try {

        const resposta =
            await fetch(
                "/api/documentos/pendentes",
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (resposta.status === 401) {

            window.location.replace("/");

            return;
        }


        const dados =
            await resposta.json();


        if (!resposta.ok) {

            throw new Error(
                dados.mensagem ||
                "Erro ao carregar documentos."
            );
        }


        quantidadePendentes.textContent =
            dados.resumo.pendentes;

        quantidadeAssinados.textContent =
            dados.resumo.assinados;


        renderizarDocumentos(
            dados.documentos
        );


    } catch (erro) {

        console.error(
            "Erro ao carregar documentos:",
            erro
        );


        listaDocumentos.textContent =
            "Não foi possível carregar os documentos.";

    }

}


function renderizarDocumentos(documentos) {

    listaDocumentos.replaceChildren();


    if (documentos.length === 0) {

        const vazio =
            document.createElement("div");

        vazio.className =
            "estado-vazio";


        const titulo =
            document.createElement("h3");

        titulo.textContent =
            "Nenhum documento pendente";


        const texto =
            document.createElement("p");

        texto.textContent =
            "Você não possui documentos aguardando assinatura.";


        vazio.append(
            titulo,
            texto
        );


        listaDocumentos.appendChild(
            vazio
        );


        return;
    }


    for (const documento of documentos) {

        const card =
            document.createElement("article");

        card.className =
            "documento-card";


        const conteudo =
            document.createElement("div");

        conteudo.className =
            "documento-conteudo";


        const status =
            document.createElement("span");

        status.className =
            "documento-status";

        status.textContent =
            "Aguardando assinatura";


        const titulo =
            document.createElement("h3");

        titulo.textContent =
            documento.titulo;


        const descricao =
            document.createElement("p");

        descricao.textContent =
            documento.descricao ||
            "Documento corporativo";


        const versao =
            document.createElement("small");

        versao.textContent =
            `Versão ${documento.versao}`;


        const botao =
            document.createElement("button");

        botao.type = "button";

        botao.className =
            "botao-documento";

        botao.textContent =
            "Abrir";


        botao.addEventListener(
            "click",
            function () {

                alert(
                    "O visualizador do documento será criado na próxima etapa."
                );

            }
        );


        conteudo.append(
            status,
            titulo,
            descricao,
            versao
        );


        card.append(
            conteudo,
            botao
        );


        listaDocumentos.appendChild(
            card
        );
    }
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