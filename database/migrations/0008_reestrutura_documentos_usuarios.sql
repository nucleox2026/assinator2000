/*
 * =========================================================
 * MIGRATION 0008
 *
 * Reestrutura documentos_usuarios para permitir
 * múltiplas versões do mesmo documento por usuário.
 * =========================================================
 */


/*
 * 1. Criamos a nova estrutura.
 */

CREATE TABLE documentos_usuarios_novo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    documento_id INTEGER NOT NULL,

    documento_versao_id INTEGER,

    usuario_id INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'PENDENTE'
        CHECK (
            status IN (
                'PENDENTE',
                'EM_LEITURA',
                'ASSINADO'
            )
        ),

    atribuido_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    visualizado_em TEXT,

    leitura_concluida_em TEXT,

    assinado_em TEXT,

    FOREIGN KEY (documento_id)
        REFERENCES documentos(id)
        ON DELETE CASCADE,

    FOREIGN KEY (documento_versao_id)
        REFERENCES documento_versoes(id),

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE
);


/*
 * 2. Copiamos todos os dados existentes.
 *
 * Inclusive documento_versao_id, que já foi
 * criado pela migration 0007.
 */

INSERT INTO documentos_usuarios_novo (
    id,
    documento_id,
    documento_versao_id,
    usuario_id,
    status,
    atribuido_em,
    visualizado_em,
    leitura_concluida_em,
    assinado_em
)

SELECT
    id,
    documento_id,
    documento_versao_id,
    usuario_id,
    status,
    atribuido_em,
    visualizado_em,
    leitura_concluida_em,
    assinado_em

FROM documentos_usuarios;


/*
 * 3. Remove a tabela antiga.
 */

DROP TABLE documentos_usuarios;


/*
 * 4. Renomeia a nova tabela.
 */

ALTER TABLE documentos_usuarios_novo
RENAME TO documentos_usuarios;


/*
 * =========================================================
 * ÍNDICES
 * =========================================================
 */

CREATE INDEX idx_documentos_usuarios_usuario
ON documentos_usuarios(usuario_id);


CREATE INDEX idx_documentos_usuarios_documento
ON documentos_usuarios(documento_id);


CREATE INDEX idx_documentos_usuarios_versao
ON documentos_usuarios(documento_versao_id);


CREATE INDEX idx_documentos_usuarios_status
ON documentos_usuarios(status);


/*
 * =========================================================
 * REGRAS DE UNICIDADE
 * =========================================================
 *
 * Para registros novos com versão:
 *
 * o mesmo usuário não pode receber duas vezes
 * a mesma versão.
 */

CREATE UNIQUE INDEX idx_documentos_usuarios_usuario_versao_unico
ON documentos_usuarios(
    documento_versao_id,
    usuario_id
)
WHERE documento_versao_id IS NOT NULL;


/*
 * Enquanto existirem registros antigos sem
 * documento_versao_id, mantemos a regra antiga
 * para esses registros.
 *
 * Isso evita duplicatas durante a transição.
 */

CREATE UNIQUE INDEX idx_documentos_usuarios_legacy_unico
ON documentos_usuarios(
    documento_id,
    usuario_id
)
WHERE documento_versao_id IS NULL;