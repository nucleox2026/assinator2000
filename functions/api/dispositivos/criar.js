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


function criarSiglaLocal(local) {

    const normalizado =
        local
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toUpperCase()
            .replace(
                /[^A-Z0-9]/g,
                ""
            );


    if (!normalizado) {
        return "GERAL";
    }


    /*
     * Limitamos a sigla para manter
     * códigos curtos.
     *
     * RH continua RH.
     * RECEPCAO vira RECEPC.
     */
    return normalizado.slice(0, 6);
}


export async function onRequestPost(context) {

    try {

        /*
         * Rota administrativa temporariamente
         * protegida pela BOOTSTRAP_ADMIN_KEY.
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


        const dados =
            await context.request.json();


        const nome =
            String(
                dados.nome || ""
            ).trim();


        const local =
            String(
                dados.local || ""
            ).trim();


        if (!nome || !local) {

            return respostaJson(
                {
                    sucesso: false,
                    mensagem:
                        "Informe o nome e o local do dispositivo."
                },
                400
            );
        }


        /*
         * Código temporário que será
         * digitado fisicamente no tablet.
         */

        const codigoAtivacao =
            gerarCodigoAtivacao();


        const codigoProtegido =
            await gerarHashSenha(
                codigoAtivacao,
                context.env.APP_PEPPER
            );


        const expiraEm =
            new Date(
                Date.now() +
                HORAS_VALIDADE_ATIVACAO *
                60 *
                60 *
                1000
            ).toISOString();


        /*
         * Como precisamos do ID do registro
         * para criar TAB-RH-001,
         * inserimos primeiro um código
         * provisório e único.
         */

        const codigoProvisorio =
            `PENDENTE-${crypto.randomUUID()}`;


        const resultado =
            await context.env.DB
                .prepare(
                    `
                    INSERT INTO dispositivos (
                        codigo,
                        nome,
                        local,
                        ativacao_hash,
                        ativacao_salt,
                        ativacao_expira_em,
                        ativo
                    )

                    VALUES (
                        ?1,
                        ?2,
                        ?3,
                        ?4,
                        ?5,
                        ?6,
                        1
                    )
                    `
                )
                .bind(
                    codigoProvisorio,
                    nome,
                    local,
                    codigoProtegido.hash,
                    codigoProtegido.salt,
                    expiraEm
                )
                .run();


        const dispositivoId =
            resultado.meta.last_row_id;


        /*
         * Exemplo:
         *
         * local = RH
         * id = 1
         *
         * TAB-RH-001
         */

        const sigla =
            criarSiglaLocal(local);


        const codigoDispositivo =
            `TAB-${sigla}-${String(
                dispositivoId
            ).padStart(3, "0")}`;


        await context.env.DB
            .prepare(
                `
                UPDATE dispositivos

                SET
                    codigo = ?1,
                    atualizado_em =
                        CURRENT_TIMESTAMP

                WHERE id = ?2
                `
            )
            .bind(
                codigoDispositivo,
                dispositivoId
            )
            .run();


        /*
         * O código de ativação original
         * aparece apenas nesta resposta.
         */

        return respostaJson(
            {
                sucesso: true,

                mensagem:
                    "Dispositivo cadastrado. Realize a ativação no próprio tablet.",

                dispositivo: {
                    id:
                        dispositivoId,

                    codigo:
                        codigoDispositivo,

                    nome,

                    local
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
            "Erro ao cadastrar dispositivo:",
            erro
        );


        return respostaJson(
            {
                sucesso: false,
                mensagem:
                    "Não foi possível cadastrar o dispositivo."
            },
            500
        );
    }
}