function removerSegredos(valor) {

    if (
        valor === null ||
        valor === undefined
    ) {
        return valor;
    }


    if (Array.isArray(valor)) {

        return valor.map(
            removerSegredos
        );
    }


    if (typeof valor !== "object") {

        return valor;
    }


    const bloqueados =
        new Set([
            "senha",
            "pin",
            "confirmarPin",
            "codigoAtivacao",
            "codigo",
            "token",
            "cookie",
            "authorization"
        ]);


    const resultado = {};


    for (
        const [chave, conteudo]
        of Object.entries(valor)
    ) {

        if (
            bloqueados.has(
                chave
            )
        ) {
            continue;
        }


        resultado[chave] =
            removerSegredos(
                conteudo
            );
    }


    return resultado;
}


function obterIp(request) {

    const cfIp =
        request.headers.get(
            "CF-Connecting-IP"
        );


    if (cfIp) {
        return cfIp;
    }


    const forwarded =
        request.headers.get(
            "X-Forwarded-For"
        );


    if (forwarded) {

        return forwarded
            .split(",")[0]
            .trim();
    }


    return null;
}


export async function registrarAuditoria(
    context,
    {
        evento,
        resultado,

        usuario = null,
        sessao = null,
        dispositivo = null,

        recursoTipo = null,
        recursoId = null,

        detalhes = null
    }
) {

    const request =
        context.request;


    const ip =
        obterIp(request);


    const userAgent =
        request.headers.get(
            "User-Agent"
        );


    const cfRay =
        request.headers.get(
            "CF-Ray"
        );


    const detalhesLimpos =
        removerSegredos(
            detalhes
        );


    const detalhesJson =
        detalhesLimpos
            ? JSON.stringify(
                detalhesLimpos
            )
            : null;


    await context.env.DB
        .prepare(
            `
            INSERT INTO auditoria (
                evento,
                resultado,

                usuario_id,
                usuario_codigo_funcional,
                usuario_login,

                sessao_id,

                dispositivo_id,
                dispositivo_codigo,

                recurso_tipo,
                recurso_id,

                ip,
                user_agent,
                cf_ray,

                detalhes_json
            )

            VALUES (
                ?1,
                ?2,
                ?3,
                ?4,
                ?5,
                ?6,
                ?7,
                ?8,
                ?9,
                ?10,
                ?11,
                ?12,
                ?13,
                ?14
            )
            `
        )
        .bind(
            evento,
            resultado,

            usuario?.id || null,

            usuario?.codigoFuncional ||
            usuario?.codigo_funcional ||
            null,

            usuario?.usuario || null,

            sessao?.id || null,

            dispositivo?.id || null,
            dispositivo?.codigo || null,

            recursoTipo,
            recursoId
                ? String(recursoId)
                : null,

            ip,
            userAgent,
            cfRay,

            detalhesJson
        )
        .run();
}