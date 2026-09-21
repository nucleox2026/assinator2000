import {
    gerarHashSenha
} from "../../_lib/password.js";


import {
    gerarCodigoAtivacao
} from "../../_lib/activation.js";


const HORAS_VALIDADE_ATIVACAO = 24;


function respostaJson(
    dados,
    status = 200
) {

    return new Response(
        JSON.stringify(dados),
        {
            status,

            headers: {
                "Content-Type":
                    "application/json; charset=UTF-8"
            }
        }
    );
}


export async function onRequestPost(context) {

    try {

        /*
         * 1. Proteção temporária da rota administrativa.
         */

        const chaveRecebida =
            context.request.headers.get(
                "X-Admin-Key"
            );


        if (
            !chaveRecebida ||
            chaveRecebida !==
                context.env.BOOTSTRAP_ADMIN_KEY
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Não autorizado."
                },
                401
            );
        }


        /*
         * 2. Dados fornecidos pelo administrador.
         *
         * Observe que NÃO recebemos senha.
         */

        const dados =
            await context.request.json();


        const nome =
            String(
                dados.nome || ""
            ).trim();


        const usuario =
            String(
                dados.usuario || ""
            )
                .trim()
                .toLowerCase();


        const setor =
            String(
                dados.setor || ""
            ).trim();


        /*
         * 3. Campos obrigatórios.
         */

        if (
            !nome ||
            !usuario ||
            !setor
        ) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Preencha nome, usuário e setor."
                },
                400
            );
        }


        /*
         * 4. Validação de nome.sobrenome.
         */

        const usuarioValido =
            /^[a-z0-9]+(?:\.[a-z0-9]+)+$/
                .test(usuario);


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
         * 5. Impede usuário duplicado.
         */

        const existente =
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


        if (existente) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Usuário já cadastrado."
                },
                409
            );
        }


        /*
         * 6. Gera código temporário.
         */

        const codigoAtivacao =
            gerarCodigoAtivacao();


        /*
         * Nunca gravamos o código original.
         *
         * Gravamos somente hash + salt.
         */

        const codigoProtegido =
            await gerarHashSenha(
                codigoAtivacao,
                context.env.APP_PEPPER
            );


        /*
         * 7. Define expiração.
         */

        const expiraEm =
            new Date(
                Date.now() +
                HORAS_VALIDADE_ATIVACAO *
                60 *
                60 *
                1000
            ).toISOString();


        /*
         * 8. Cria o colaborador.
         *
         * Neste momento senha_hash contém
         * o HASH DO CÓDIGO TEMPORÁRIO.
         *
         * Depois da ativação será substituído
         * pelo hash do PIN pessoal.
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
                        ativo,
                        credencial_ativada,
                        ativacao_expira_em
                    )

                    VALUES (
                        ?1,
                        ?2,
                        ?3,
                        ?4,
                        ?5,
                        'COLABORADOR',
                        1,
                        0,
                        ?6
                    )
                    `
                )
                .bind(
                    nome,
                    usuario,
                    codigoProtegido.hash,
                    codigoProtegido.salt,
                    setor,
                    expiraEm
                )
                .run();


        const usuarioId =
            resultado.meta.last_row_id;


        /*
         * 9. Cria identificador funcional
         * interno e permanente.
         */

        const codigoFuncional =
            `COL-${String(usuarioId)
                .padStart(6, "0")}`;


        await context.env.DB
            .prepare(
                `
                UPDATE usuarios

                SET
                    codigo_funcional = ?1,
                    atualizado_em =
                        CURRENT_TIMESTAMP

                WHERE id = ?2
                `
            )
            .bind(
                codigoFuncional,
                usuarioId
            )
            .run();


        /*
         * 10. O código temporário aparece
         * UMA VEZ nesta resposta.
         *
         * Como o banco possui somente o hash,
         * não conseguiremos recuperá-lo depois.
         */

        return respostaJson(
            {
                sucesso: true,

                mensagem:
                    "Colaborador cadastrado. Entregue o código de ativação ao colaborador.",

                usuario: {
                    id: usuarioId,
                    codigoFuncional,
                    nome,
                    usuario,
                    setor,
                    perfil:
                        "COLABORADOR"
                },

                ativacao: {
                    codigo:
                        codigoAtivacao,

                    expiraEm
                }
            },
            201
        );


    } catch (erro) {

        console.error(
            "Erro ao criar usuário:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,
                mensagem:
                    "Não foi possível cadastrar o colaborador."
            },
            500
        );
    }
}