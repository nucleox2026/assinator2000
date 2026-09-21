import {
    verificarSenha
} from "../../_lib/password.js";


import {
    registrarAuditoria
} from "../../_lib/audit.js";


import {
    gerarTokenSessao,
    criarCookieSessao,
    DURACAO_SESSAO
} from "../../_lib/session.js";


import {
    obterDispositivoAutorizado
} from "../../_lib/device.js";


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

        headers.set(
            nome,
            valor
        );
    }


    return new Response(
        JSON.stringify(dados),
        {
            status,
            headers
        }
    );
}


function montarUsuarioAuditoria(
    colaborador
) {

    return {
        id:
            colaborador.id,

        codigoFuncional:
            colaborador.codigo_funcional,

        usuario:
            colaborador.usuario
    };
}


export async function onRequestPost(
    context
) {

    try {

        /*
         * 1. O login somente pode acontecer
         * em um tablet corporativo ativado.
         */

        const dispositivo =
            await obterDispositivoAutorizado(
                context
            );


        if (!dispositivo) {

            await registrarAuditoria(
                context,
                {
                    evento:
                        "LOGIN_FALHA",

                    resultado:
                        "NEGADO",

                    detalhes: {
                        motivo:
                            "DISPOSITIVO_NAO_AUTORIZADO"
                    }
                }
            );


            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Este equipamento não está autorizado para acessar o Assinator2000."
                },
                403
            );
        }


        /*
         * 2. Lê e normaliza os dados
         * enviados pelo formulário.
         *
         * O frontend ainda envia o PIN
         * no campo chamado "senha".
         */

        const dados =
            await context.request.json();


        const usuario =
            String(
                dados.usuario || ""
            )
                .trim()
                .toLowerCase();


        const pin =
            String(
                dados.senha || ""
            ).trim();


        /*
         * 3. Validação básica.
         */

        if (
            !usuario ||
            !pin
        ) {

            await registrarAuditoria(
                context,
                {
                    evento:
                        "LOGIN_FALHA",

                    resultado:
                        "FALHA",

                    dispositivo,

                    detalhes: {
                        motivo:
                            "DADOS_INCOMPLETOS"
                    }
                }
            );


            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Informe o usuário e o PIN."
                },
                400
            );
        }


        /*
         * 4. Procura o colaborador.
         */

        const colaborador =
            await context.env.DB
                .prepare(
                    `
                    SELECT
                        id,
                        codigo_funcional,
                        nome,
                        usuario,
                        senha_hash,
                        senha_salt,
                        setor,
                        perfil,
                        ativo,
                        credencial_ativada,
                        tentativas_falhas,
                        bloqueado_ate

                    FROM usuarios

                    WHERE usuario = ?1

                    LIMIT 1
                    `
                )
                .bind(
                    usuario
                )
                .first();


        /*
         * Não revelamos se o usuário
         * existe ou está inativo.
         */

        if (
            !colaborador ||
            colaborador.ativo !== 1
        ) {

            await registrarAuditoria(
                context,
                {
                    evento:
                        "LOGIN_FALHA",

                    resultado:
                        "FALHA",

                    dispositivo,

                    detalhes: {
                        motivo:
                            "USUARIO_OU_CREDENCIAL_INVALIDA",

                        usuarioInformado:
                            usuario
                    }
                }
            );


            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Usuário ou PIN inválidos."
                },
                401
            );
        }


        /*
         * 5. A credencial pessoal precisa
         * ter sido ativada pelo colaborador.
         */

        if (
            colaborador
                .credencial_ativada !== 1
        ) {

            await registrarAuditoria(
                context,
                {
                    evento:
                        "LOGIN_FALHA",

                    resultado:
                        "NEGADO",

                    usuario:
                        montarUsuarioAuditoria(
                            colaborador
                        ),

                    dispositivo,

                    detalhes: {
                        motivo:
                            "CREDENCIAL_NAO_ATIVADA"
                    }
                }
            );


            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Usuário ou PIN inválidos."
                },
                403
            );
        }


        /*
         * 6. Verifica bloqueio temporário.
         */

        const agora =
            new Date();


        if (
            colaborador.bloqueado_ate
        ) {

            const bloqueadoAte =
                new Date(
                    colaborador
                        .bloqueado_ate
                );


            /*
             * O bloqueio ainda está vigente.
             */

            if (
                bloqueadoAte >
                agora
            ) {

                await registrarAuditoria(
                    context,
                    {
                        evento:
                            "LOGIN_FALHA",

                        resultado:
                            "BLOQUEADO",

                        usuario:
                            montarUsuarioAuditoria(
                                colaborador
                            ),

                        dispositivo,

                        detalhes: {
                            motivo:
                                "USUARIO_TEMPORARIAMENTE_BLOQUEADO",

                            bloqueadoAte:
                                colaborador
                                    .bloqueado_ate
                        }
                    }
                );


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
                        atualizado_em =
                            CURRENT_TIMESTAMP

                    WHERE id = ?1
                    `
                )
                .bind(
                    colaborador.id
                )
                .run();


            colaborador.tentativas_falhas =
                0;

            colaborador.bloqueado_ate =
                null;
        }


        /*
         * 7. Verifica o PIN pessoal.
         */

        const pinValido =
            await verificarSenha(
                pin,
                colaborador.senha_salt,
                colaborador.senha_hash,
                context.env.APP_PEPPER
            );


        /*
         * 8. PIN incorreto.
         */

        if (!pinValido) {

            const tentativas =
                Number(
                    colaborador
                        .tentativas_falhas ||
                    0
                ) + 1;


            /*
             * Atingiu o limite.
             */

            if (
                tentativas >=
                MAX_TENTATIVAS
            ) {

                const bloqueadoAte =
                    new Date(
                        Date.now() +
                        MINUTOS_BLOQUEIO *
                        60 *
                        1000
                    ).toISOString();


                await context.env.DB
                    .prepare(
                        `
                        UPDATE usuarios

                        SET
                            tentativas_falhas = ?1,
                            bloqueado_ate = ?2,
                            atualizado_em =
                                CURRENT_TIMESTAMP

                        WHERE id = ?3
                        `
                    )
                    .bind(
                        tentativas,
                        bloqueadoAte,
                        colaborador.id
                    )
                    .run();


                await registrarAuditoria(
                    context,
                    {
                        evento:
                            "LOGIN_FALHA",

                        resultado:
                            "BLOQUEADO",

                        usuario:
                            montarUsuarioAuditoria(
                                colaborador
                            ),

                        dispositivo,

                        detalhes: {
                            motivo:
                                "LIMITE_TENTATIVAS",

                            tentativas,

                            bloqueadoAte
                        }
                    }
                );


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
             * Ainda não atingiu o limite.
             */

            await context.env.DB
                .prepare(
                    `
                    UPDATE usuarios

                    SET
                        tentativas_falhas = ?1,
                        atualizado_em =
                            CURRENT_TIMESTAMP

                    WHERE id = ?2
                    `
                )
                .bind(
                    tentativas,
                    colaborador.id
                )
                .run();


            await registrarAuditoria(
                context,
                {
                    evento:
                        "LOGIN_FALHA",

                    resultado:
                        "FALHA",

                    usuario:
                        montarUsuarioAuditoria(
                            colaborador
                        ),

                    dispositivo,

                    detalhes: {
                        motivo:
                            "CREDENCIAL_INVALIDA",

                        tentativas
                    }
                }
            );


            return respostaJson(
                {
                    sucesso: false,

                    mensagem:
                        "Usuário ou PIN inválidos."
                },
                401
            );
        }


        /*
         * 9. Login correto.
         *
         * Zeramos falhas anteriores.
         */

        await context.env.DB
            .prepare(
                `
                UPDATE usuarios

                SET
                    tentativas_falhas = 0,
                    bloqueado_ate = NULL,
                    atualizado_em =
                        CURRENT_TIMESTAMP

                WHERE id = ?1
                `
            )
            .bind(
                colaborador.id
            )
            .run();


        /*
         * 10. Remove sessões expiradas.
         */

        await context.env.DB
            .prepare(
                `
                DELETE FROM sessoes

                WHERE expira_em <= ?1
                `
            )
            .bind(
                new Date()
                    .toISOString()
            )
            .run();


        /*
         * 11. Gera um novo token
         * criptográfico de sessão.
         */

        const sessao =
            await gerarTokenSessao();


        const expiraEm =
            new Date(
                Date.now() +
                DURACAO_SESSAO *
                1000
            ).toISOString();


        /*
         * 12. Grava somente o HASH
         * do token no banco.
         *
         * A sessão também fica vinculada
         * ao tablet corporativo.
         */

        const resultadoSessao =
            await context.env.DB
                .prepare(
                    `
                    INSERT INTO sessoes (
                        usuario_id,
                        dispositivo_id,
                        token_hash,
                        expira_em
                    )

                    VALUES (
                        ?1,
                        ?2,
                        ?3,
                        ?4
                    )
                    `
                )
                .bind(
                    colaborador.id,
                    dispositivo.id,
                    sessao.tokenHash,
                    expiraEm
                )
                .run();


        const sessaoId =
            resultadoSessao
                .meta
                .last_row_id;


        /*
         * 13. Registra o login bem-sucedido.
         *
         * Se esta auditoria falhar,
         * não queremos deixar uma sessão
         * ativa sem o evento correspondente.
         */

        try {

            await registrarAuditoria(
                context,
                {
                    evento:
                        "LOGIN_SUCESSO",

                    resultado:
                        "SUCESSO",

                    usuario:
                        montarUsuarioAuditoria(
                            colaborador
                        ),

                    sessao: {
                        id:
                            sessaoId
                    },

                    dispositivo,

                    detalhes: {
                        metodo:
                            "PIN_PESSOAL"
                    }
                }
            );

        } catch (erroAuditoria) {

            /*
             * Remove a sessão que acabou
             * de ser criada.
             */

            await context.env.DB
                .prepare(
                    `
                    DELETE FROM sessoes

                    WHERE id = ?1
                    `
                )
                .bind(
                    sessaoId
                )
                .run();


            throw erroAuditoria;
        }


        /*
         * 14. Somente depois da sessão e
         * auditoria estarem gravadas
         * criamos o cookie HttpOnly.
         */

        const cookie =
            criarCookieSessao(
                sessao.token,
                context.request
            );


        /*
         * 15. Autenticação concluída.
         */

        return respostaJson(
            {
                sucesso: true,

                mensagem:
                    "Autenticação realizada com sucesso.",

                usuario: {
                    id:
                        colaborador.id,

                    codigoFuncional:
                        colaborador
                            .codigo_funcional,

                    nome:
                        colaborador.nome,

                    usuario:
                        colaborador.usuario,

                    setor:
                        colaborador.setor,

                    perfil:
                        colaborador.perfil
                }
            },

            200,

            {
                "Set-Cookie":
                    cookie
            }
        );


    } catch (erro) {

        console.error(
            "Erro durante login:",
            erro
        );


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