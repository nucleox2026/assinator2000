CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash TEXT NOT NULL,
    senha_salt TEXT NOT NULL,
    setor TEXT,

    perfil TEXT NOT NULL DEFAULT 'COLABORADOR'
        CHECK (perfil IN ('COLABORADOR', 'ADMIN')),

    ativo INTEGER NOT NULL DEFAULT 1
        CHECK (ativo IN (0, 1)),

    tentativas_falhas INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate TEXT,

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_usuario
ON usuarios (usuario);

CREATE TABLE IF NOT EXISTS sessoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    usuario_id INTEGER NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    expira_em TEXT NOT NULL,

    ultimo_acesso_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessoes_token_hash
ON sessoes(token_hash);

CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_id
ON sessoes(usuario_id);