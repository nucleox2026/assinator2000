CREATE TABLE IF NOT EXISTS dispositivos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    codigo TEXT NOT NULL UNIQUE COLLATE NOCASE,

    nome TEXT NOT NULL,

    local TEXT,

    token_hash TEXT UNIQUE,

    ativacao_hash TEXT,

    ativacao_salt TEXT,

    ativacao_expira_em TEXT,

    ativo INTEGER NOT NULL DEFAULT 1
        CHECK (ativo IN (0, 1)),

    ativado_em TEXT,

    ultimo_acesso_em TEXT,

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_dispositivos_codigo
ON dispositivos(codigo);


ALTER TABLE sessoes
ADD COLUMN dispositivo_id INTEGER;


CREATE INDEX IF NOT EXISTS idx_sessoes_dispositivo
ON sessoes(dispositivo_id);