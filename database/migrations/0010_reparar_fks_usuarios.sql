/*
 * =========================================================
 * MIGRATION 0010
 *
 * Repara FKs que ficaram apontando para
 * usuarios_antigo após a reconstrução da
 * tabela usuarios na migration 0009.
 * =========================================================
 */

PRAGMA defer_foreign_keys = ON;


/*
 * =========================================================
 * 1. SESSÕES
 * =========================================================
 */

CREATE TABLE sessoes_novo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    usuario_id INTEGER NOT NULL,

    dispositivo_id INTEGER,

    token_hash TEXT NOT NULL UNIQUE,

    expira_em TEXT NOT NULL,

    ultimo_acesso_em TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    criado_em TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    FOREIGN KEY (dispositivo_id)
        REFERENCES dispositivos(id)
);


INSERT INTO sessoes_novo (
    id,
    usuario_id,
    dispositivo_id,
    token_hash,
    expira_em,
    ultimo_acesso_em,
    criado_em
)

SELECT
    id,
    usuario_id,
    dispositivo_id,
    token_hash,
    expira_em,
    ultimo_acesso_em,
    criado_em

FROM sessoes;


DROP TABLE sessoes;


ALTER TABLE sessoes_novo
RENAME TO sessoes;


CREATE INDEX idx_sessoes_dispositivo
ON sessoes(dispositivo_id);


CREATE INDEX idx_sessoes_token_hash
ON sessoes(token_hash);


CREATE INDEX idx_sessoes_usuario_id
ON sessoes(usuario_id);


/*
 * =========================================================
 * 2. VERSÕES DOS DOCUMENTOS
 * =========================================================
 */

CREATE TABLE documento_versoes_novo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    documento_id INTEGER NOT NULL,

    numero_versao INTEGER NOT NULL,

    nome_arquivo TEXT NOT NULL,

    mime_type TEXT,

    tamanho_bytes INTEGER,

    sha256 TEXT NOT NULL
        CHECK (
            length(sha256) = 64
        ),

    origem_tipo TEXT NOT NULL
        DEFAULT 'SHAREPOINT',

    origem_referencia TEXT,

    publicado_por_usuario_id INTEGER,

    publicado_em TEXT NOT NULL
        DEFAULT (
            strftime(
                '%Y-%m-%dT%H:%M:%fZ',
                'now'
            )
        ),

    criado_em TEXT NOT NULL
        DEFAULT (
            strftime(
                '%Y-%m-%dT%H:%M:%fZ',
                'now'
            )
        ),

    FOREIGN KEY (documento_id)
        REFERENCES documentos(id),

    FOREIGN KEY (publicado_por_usuario_id)
        REFERENCES usuarios(id),

    UNIQUE (
        documento_id,
        numero_versao
    )
);


INSERT INTO documento_versoes_novo (
    id,
    documento_id,
    numero_versao,
    nome_arquivo,
    mime_type,
    tamanho_bytes,
    sha256,
    origem_tipo,
    origem_referencia,
    publicado_por_usuario_id,
    publicado_em,
    criado_em
)

SELECT
    id,
    documento_id,
    numero_versao,
    nome_arquivo,
    mime_type,
    tamanho_bytes,
    sha256,
    origem_tipo,
    origem_referencia,
    publicado_por_usuario_id,
    publicado_em,
    criado_em

FROM documento_versoes;


DROP TABLE documento_versoes;


ALTER TABLE documento_versoes_novo
RENAME TO documento_versoes;


CREATE INDEX idx_documento_versoes_documento
ON documento_versoes(documento_id);


CREATE INDEX idx_documento_versoes_sha256
ON documento_versoes(sha256);


/*
 * Recria proteção de imutabilidade.
 */

CREATE TRIGGER documento_versoes_bloquear_update
BEFORE UPDATE ON documento_versoes

BEGIN

    SELECT RAISE(
        ABORT,
        'Versões publicadas são imutáveis'
    );

END;


CREATE TRIGGER documento_versoes_bloquear_delete
BEFORE DELETE ON documento_versoes

BEGIN

    SELECT RAISE(
        ABORT,
        'Versões publicadas são imutáveis'
    );

END;


/*
 * =========================================================
 * 3. DOCUMENTOS ATRIBUÍDOS A USUÁRIOS
 * =========================================================
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

    atribuido_em TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

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


DROP TABLE documentos_usuarios;


ALTER TABLE documentos_usuarios_novo
RENAME TO documentos_usuarios;


/*
 * Índices normais.
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
 * Mesma versão não pode ser atribuída
 * duas vezes ao mesmo usuário.
 */

CREATE UNIQUE INDEX
idx_documentos_usuarios_usuario_versao_unico

ON documentos_usuarios(
    documento_versao_id,
    usuario_id
)

WHERE documento_versao_id IS NOT NULL;


/*
 * Compatibilidade temporária com
 * atribuições antigas sem versão.
 */

CREATE UNIQUE INDEX
idx_documentos_usuarios_legacy_unico

ON documentos_usuarios(
    documento_id,
    usuario_id
)

WHERE documento_versao_id IS NULL;


/*
 * =========================================================
 * FIM
 * =========================================================
 */

PRAGMA defer_foreign_keys = OFF;