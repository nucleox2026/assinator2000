CREATE TABLE IF NOT EXISTS documento_versoes (
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


CREATE INDEX IF NOT EXISTS idx_documento_versoes_documento
ON documento_versoes(documento_id);


CREATE INDEX IF NOT EXISTS idx_documento_versoes_sha256
ON documento_versoes(sha256);


ALTER TABLE documentos_usuarios
ADD COLUMN documento_versao_id INTEGER;


CREATE INDEX IF NOT EXISTS idx_documentos_usuarios_versao
ON documentos_usuarios(documento_versao_id);


/*
 * Uma versão publicada nunca pode
 * ser modificada ou apagada.
 */

CREATE TRIGGER IF NOT EXISTS documento_versoes_bloquear_update
BEFORE UPDATE ON documento_versoes

BEGIN

    SELECT RAISE(
        ABORT,
        'Versões publicadas são imutáveis'
    );

END;


CREATE TRIGGER IF NOT EXISTS documento_versoes_bloquear_delete
BEFORE DELETE ON documento_versoes

BEGIN

    SELECT RAISE(
        ABORT,
        'Versões publicadas são imutáveis'
    );

END;