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