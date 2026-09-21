import { verificarSenha } from "../../_lib/password.js";


const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;


function respostaJson(
    dados,
    status = 200,
    headersExtras = {}
) {

    const headers =
        new Headers({
            "Content-Type":
                "application/json; charset=UTF-8"
        });


    for (
        const [nome, valor]
        of Object.entries(headersExtras)
    ) {
        headers.set(nome, valor);
    }


    return new Response(
        JSON.stringify(dados),
        {
            status,
            headers
        }
    );
}

import {
    gerarTokenSessao,
    criarCookieSessao,
    DURACAO_SESSAO
} from "../../_lib/session.js"

export async function onRequestPost(context) {

    try {

        const dados = await context.request.json();

        const usuario =
            String(dados.usuario || "")
                .trim()
                .toLowerCase();

        const senha =
            String(dados.senha || "").trim();


        /*
         * 1. Validação básica.
         */

        if (!usuario || !senha) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem: "Informe usuário e senha."
                },
                400
            );
        }


        /*
         * 2. Procura o colaborador.
         */

        const colaborador =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        nome,
                        usuario,
                        senha_hash,
                        senha_salt,
                        setor,
                        perfil,
                        ativo,
                        tentativas_falhas,
                        bloqueado_ate
                    FROM usuarios
                    WHERE usuario = ?1
                    LIMIT 1
                    `
                )
                .bind(usuario)
                .first();


        /*
         * Não informamos se o usuário existe ou não.
         */

        if (!colaborador || colaborador.ativo !== 1) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem: "Usuário ou senha inválidos."
                },
                401
            );
        }


        /*
         * 3. Verifica bloqueio.
         */

        const agora = new Date();

        if (colaborador.bloqueado_ate) {

            const bloqueadoAte =
                new Date(colaborador.bloqueado_ate);

            if (bloqueadoAte > agora) {

                return respostaJson(
                    {
                        sucesso: false,
                        mensagem:
                            "Acesso temporariamente bloqueado. Tente novamente mais tarde."
                    },
                    423
                );
            }


            /*
             * O período de bloqueio terminou.
             * Zeramos o contador.
             */

            await context.env.DB
                .prepare(
                    `
                    UPDATE usuarios
                    SET
                        tentativas_falhas = 0,
                        bloqueado_ate = NULL,
                        atualizado_em = CURRENT_TIMESTAMP
                    WHERE id = ?1
                    `
                )
                .bind(colaborador.id)
                .run();

            colaborador.tentativas_falhas = 0;
            colaborador.bloqueado_ate = null;
        }


        /*
         * 4. Verifica a senha.
         */

        const senhaValida =
            await verificarSenha(
                senha,
                colaborador.senha_salt,
                colaborador.senha_hash,
                context.env.APP_PEPPER
            );


        /*
         * 5. Senha incorreta.
         */

        if (!senhaValida) {

            const tentativas =
                Number(colaborador.tentativas_falhas || 0) + 1;


            /*
             * Chegou ao limite.
             */

            if (tentativas >= MAX_TENTATIVAS) {

                const bloqueadoAte = new Date(
                    Date.now() +
                    MINUTOS_BLOQUEIO * 60 * 1000
                ).toISOString();


                await context.env.DB
                    .prepare(
                        `
                        UPDATE usuarios
                        SET
                            tentativas_falhas = ?1,
                            bloqueado_ate = ?2,
                            atualizado_em = CURRENT_TIMESTAMP
                        WHERE id = ?3
                        `
                    )
                    .bind(
                        tentativas,
                        bloqueadoAte,
                        colaborador.id
                    )
                    .run();


                return respostaJson(
                    {
                        sucesso: false,
                        mensagem:
                            "Acesso temporariamente bloqueado. Tente novamente mais tarde."
                    },
                    423
                );
            }


            /*
             * Ainda não chegou ao limite.
             */

            await context.env.DB
                .prepare(
                    `
                    UPDATE usuarios
                    SET
                        tentativas_falhas = ?1,
                        atualizado_em = CURRENT_TIMESTAMP
                    WHERE id = ?2
                    `
                )
                .bind(
                    tentativas,
                    colaborador.id
                )
                .run();


            return respostaJson(
                {
                    sucesso: false,
                    mensagem: "Usuário ou senha inválidos."
                },
                401
            );
        }


        /*
         * 6. Login correto.
         *
         * Zeramos qualquer tentativa anterior.
         */

        await context.env.DB
            .prepare(
                `
                UPDATE usuarios
                SET
                    tentativas_falhas = 0,
                    bloqueado_ate = NULL,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?1
                `
            )
            .bind(colaborador.id)
            .run();

            const sessao =
                await gerarTokenSessao();

            const expiraEm =
                new Date(
                    Date.now() +
                    DURACAO_SESSAO * 1000
                ).toISOString();

            /*
             * Remove sessões que já expiraram.
             */

            await context.env.DB
                .prepare(
                    `
                    
                    DELETE FROM sessoes
                    WHERE expira_em <= ?1
                    `

                )
                .bind(
                    new Date().toISOString()
                )
                .run();

            /*
             * Grava somente o HASH do token.
             */

            await context.env.DB
                .prepare(
                    `
                    
                    INSERT INTO sessoes (
                        usuario_id,
                        token_hash,
                        expira_em
                    )
                    VALUES (
                        ?1,
                        ?2,
                        ?3
                    )
                    `
                )
                .bind(
                    colaborador.id,
                    sessao.tokenHash,
                    expiraEm
                )
                .run();

                const cookie =
                    criarCookieSessao(
                        sessao.token,
                        context.request
                    );


        /*
         * 7. Autenticação válida.
         */

        return respostaJson(
            {
                sucesso: true,

                mensagem:
                    "Autenticação realizada com sucesso.",

                usuario: {
                    id: colaborador.id,
                    nome: colaborador.nome,
                    usuario: colaborador.usuario,
                    setor: colaborador.setor,
                    perfil: colaborador.perfil
                }
            },

            200,

            {
                "Set-Cookie": cookie
            }
        );

    } catch (erro) {

        console.error("Erro durante login:", erro);

        return respostaJson(
            {
                sucesso: false,
                mensagem:
                    "Não foi possível realizar o login."
            },
            500
        );
    }
}