import { gerarHashSenha } from "../../_lib/password.js";


function respostaJson(dados, status = 200) {
    return new Response(
        JSON.stringify(dados),
        {
            status,
            headers: {
                "Content-Type": "application/json; charset=UTF-8"
            }
        }
    );
}


function dataNascimentoValida(senha) {

    if (!/^\d{8}$/.test(senha)) {
        return false;
    }

    const dia = Number(senha.slice(0, 2));
    const mes = Number(senha.slice(2, 4));
    const ano = Number(senha.slice(4, 8));

    const data = new Date(
        ano,
        mes - 1,
        dia
    );

    return (
        data.getFullYear() === ano &&
        data.getMonth() === mes - 1 &&
        data.getDate() === dia
    );
}


export async function onRequestPost(context) {

    try {

        /*
         * 1. Verifica a chave administrativa.
         */

        const chaveRecebida =
            context.request.headers.get("X-Admin-Key");

        if (
            !chaveRecebida ||
            chaveRecebida !== context.env.BOOTSTRAP_ADMIN_KEY
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem: "Não autorizado."
                },
                401
            );
        }


        /*
         * 2. Lê os dados enviados.
         */

        const dados = await context.request.json();

        const nome =
            String(dados.nome || "").trim();

        const usuario =
            String(dados.usuario || "")
                .trim()
                .toLowerCase();

        const senha =
            String(dados.senha || "").trim();

        const setor =
            String(dados.setor || "").trim();


        /*
         * 3. Valida campos obrigatórios.
         */

        if (!nome || !usuario || !senha || !setor) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem: "Preencha todos os campos."
                },
                400
            );
        }


        /*
         * 4. Valida o padrão nome.sobrenome
         */

        const usuarioValido =
            /^[a-z0-9]+(?:\.[a-z0-9]+)+$/.test(usuario);

        if (!usuarioValido) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "O usuário deve seguir o padrão nome.sobrenome."
                },
                400
            );
        }


        /*
         * 5. A senha deve ser uma data válida DDMMAAAA.
         */

        if (!dataNascimentoValida(senha)) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "A senha deve ser uma data válida no formato DDMMAAAA."
                },
                400
            );
        }


        /*
         * 6. Verifica se o usuário já existe.
         */

        const usuarioExistente =
            await context.env.DB
                .prepare(
                    `
                    SELECT id
                    FROM usuarios
                    WHERE usuario = ?1
                    LIMIT 1
                    `
                )
                .bind(usuario)
                .first();


        if (usuarioExistente) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem: "Usuário já cadastrado."
                },
                409
            );
        }


        /*
         * 7. Transforma a senha em hash.
         */

        const senhaProtegida =
            await gerarHashSenha(
                senha,
                context.env.APP_PEPPER
            );


        /*
         * 8. Insere o usuário no D1.
         */

        const resultado =
            await context.env.DB
                .prepare(
                    `
                    INSERT INTO usuarios (
                        nome,
                        usuario,
                        senha_hash,
                        senha_salt,
                        setor,
                        perfil,
                        ativo
                    )
                    VALUES (
                        ?1,
                        ?2,
                        ?3,
                        ?4,
                        ?5,
                        'COLABORADOR',
                        1
                    )
                    `
                )
                .bind(
                    nome,
                    usuario,
                    senhaProtegida.hash,
                    senhaProtegida.salt,
                    setor
                )
                .run();


        /*
         * 9. Retorna somente dados não sensíveis.
         */

        return respostaJson(
            {
                sucesso: true,

                mensagem:
                    "Usuário cadastrado com sucesso.",

                usuario: {
                    id: resultado.meta.last_row_id,
                    nome,
                    usuario,
                    setor,
                    perfil: "COLABORADOR"
                }
            },
            201
        );

    } catch (erro) {

        console.error("Erro ao criar usuário:", erro);

        return respostaJson(
            {
                sucesso: false,
                mensagem:
                    "Não foi possível cadastrar o usuário."
            },
            500
        );
    }
}