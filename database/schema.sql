CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    codigo_funcional TEXT UNIQUE,

    nome TEXT NOT NULL,

    usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,

    senha_hash TEXT NOT NULL,

    senha_salt TEXT NOT NULL,

    credencial_ativada INTEGER NOT NULL DEFAULT 0
        CHECK (credencial_ativada IN (0, 1)),

    ativacao_expira_em TEXT,

    setor TEXT,

    perfil TEXT NOT NULL DEFAULT 'COLABORADOR',

    ativo INTEGER NOT NULL DEFAULT 1
        CHECK (ativo IN (0, 1)),

    desligado_em TEXT,

    tentativas_falhas INTEGER NOT NULL DEFAULT 0,

    bloqueado_ate TEXT,

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    tentativas_ativacao INTEGER NOT NULL DEFAULT 0,

    bloqueado_ate TEXT
);


CREATE INDEX IF NOT EXISTS idx_dispositivos_codigo
ON dispositivos(codigo);

CREATE INDEX IF NOT EXISTS idx_usuarios_usuario
ON usuarios (usuario);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_codigo_funcional
ON usuarios(codigo_funcional)
WHERE codigo_funcional IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    usuario_id INTEGER NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    expira_em TEXT NOT NULL,

    dispositivo_id INTEGER,

    ultimo_acesso_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE

    FOREIGN KEY (dispositivo_id)
        REFERENCES dispositivos(id)
);

CREATE INDEX IF NOT EXISTS idx_sessoes_dispositivo
ON sessoes(dispositivo_id);

CREATE INDEX IF NOT EXISTS idx_sessoes_token_hash
ON sessoes(token_hash);

CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_id
ON sessoes(usuario_id);

CREATE TABLE IF NOT EXISTS documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    codigo TEXT NOT NULL UNIQUE COLLATE NOCASE,

    titulo TEXT NOT NULL,

    descricao TEXT,

    nome_arquivo TEXT,

    sharepoint_item_id TEXT,

    versao TEXT NOT NULL DEFAULT '1',

    ativo INTEGER NOT NULL DEFAULT 1
        CHECK (ativo IN (0, 1)),

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS documentos_usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    documento_id INTEGER NOT NULL,

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

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    UNIQUE (
        documento_id,
        usuario_id
    )
);


CREATE INDEX IF NOT EXISTS idx_documentos_codigo
ON documentos(codigo);


CREATE INDEX IF NOT EXISTS idx_documentos_usuarios_usuario
ON documentos_usuarios(usuario_id);


CREATE INDEX IF NOT EXISTS idx_documentos_usuarios_documento
ON documentos_usuarios(documento_id);


CREATE INDEX IF NOT EXISTS idx_documentos_usuarios_status
ON documentos_usuarios(status);