export function gerarCodigoAtivacao() {

    const MINIMO = 10_000_000;

    const QUANTIDADE =
        90_000_000;

    const TOTAL_UINT32 =
        4_294_967_296;

    /*
     * Evita viés ao transformar
     * um uint32 em nosso intervalo.
     */
    const limite =
        Math.floor(
            TOTAL_UINT32 / QUANTIDADE
        ) * QUANTIDADE;


    const valores =
        new Uint32Array(1);


    let numero;


    do {

        crypto.getRandomValues(
            valores
        );

        numero = valores[0];

    } while (numero >= limite);


    const codigo =
        MINIMO +
        (numero % QUANTIDADE);


    return String(codigo);
}