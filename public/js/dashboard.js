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
                    },
                    cache: "no-store"
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


function carregarUsuario(
    usuario
) {

    nomeUsuario.textContent =
        usuario.nome;

    setorUsuario.textContent =
        usuario.setor || "Sem setor";


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
                    },
                    cache: "no-store"
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
            String(
                dados.resumo?.pendentes ?? 0
            );

        quantidadeAssinados.textContent =
            String(
                dados.resumo?.assinados ?? 0
            );


        renderizarDocumentos(
            Array.isArray(dados.documentos)
                ? dados.documentos
                : []
        );


    } catch (erro) {

        console.error(
            "Erro ao carregar documentos:",
            erro
        );


        quantidadePendentes.textContent = "0";
        quantidadeAssinados.textContent = "0";

        listaDocumentos.textContent =
            "Não foi possível carregar os documentos.";
    }
}


function textoStatusDocumento(
    documento
) {

    if (documento.leituraConcluidaEm) {
        return "Leitura concluída";
    }


    if (documento.status === "EM_LEITURA") {
        return "Em leitura";
    }


    return "Aguardando leitura";
}


function renderizarDocumentos(
    documentos
) {

    listaDocumentos.replaceChildren();


    if (documentos.length === 0) {

        const vazio =
            document.createElement("div");

        vazio.className =
            "estado-vazio";


        const icone =
            document.createElement("div");

        icone.className =
            "estado-vazio-icone";

        icone.textContent = "✓";


        const titulo =
            document.createElement("h3");

        titulo.textContent =
            "Nenhum documento pendente";


        const texto =
            document.createElement("p");

        texto.textContent =
            "Você não possui documentos aguardando leitura ou assinatura.";


        vazio.append(
            icone,
            titulo,
            texto
        );


        listaDocumentos.appendChild(
            vazio
        );

        return;
    }


    for (
        const documento
        of documentos
    ) {

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
            textoStatusDocumento(
                documento
            );


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
            `Versão ${documento.numeroVersao}`;


        const botao =
            document.createElement("button");

        botao.type = "button";
        botao.className =
            "botao-documento";

        botao.textContent =
            documento.status === "PENDENTE"
                ? "Abrir"
                : "Continuar";


        botao.addEventListener(
            "click",
            function () {

                const atribuicaoId =
                    Number(
                        documento.atribuicaoId
                    );


                if (
                    !Number.isInteger(
                        atribuicaoId
                    ) ||
                    atribuicaoId <= 0
                ) {

                    console.error(
                        "Atribuição inválida:",
                        documento
                    );

                    return;
                }


                window.location.href =
                    `/documento.html?atribuicao=${encodeURIComponent(atribuicaoId)}`;
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
                method: "POST",
                cache: "no-store"
            }
        );

    } catch (erro) {

        console.error(
            "Erro durante logout:",
            erro
        );

    } finally {

        window.location.replace("/");
    }
}


botaoSair.addEventListener(
    "click",
    realizarLogout
);


verificarSessao();
