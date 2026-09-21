/*
 * =========================================================
 * ASSINATOR2000
 * Schema principal
 * =========================================================
 */


/*
 * =========================================================
 * USUÁRIOS
 * =========================================================
 */

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    codigo_funcional TEXT,

    nome TEXT NOT NULL,

    usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,

    senha_hash TEXT NOT NULL,

    senha_salt TEXT NOT NULL,

    credencial_ativada INTEGER NOT NULL DEFAULT 0
        CHECK (
            credencial_ativada IN (0, 1)
        ),

    ativacao_expira_em TEXT,

    setor TEXT,

    perfil TEXT NOT NULL 
        DEFAULT 'COLABORADOR'
        CHECK (
            perfil IN (
                'COLABORADOR',
                'ADMIN',
                'RH',
                'JURIDICO',
                'TI',
                'GOVERNANCA'
            )
        ),

    ativo INTEGER NOT NULL DEFAULT 1
        CHECK (
            ativo IN (0, 1)
        ),

    desligado_em TEXT,

    tentativas_falhas INTEGER NOT NULL DEFAULT 0,

    bloqueado_ate TEXT,

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_usuarios_usuario
ON usuarios(usuario);


CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_codigo_funcional
ON usuarios(codigo_funcional)
WHERE codigo_funcional IS NOT NULL;


/*
 * =========================================================
 * DISPOSITIVOS CORPORATIVOS
 * =========================================================
 */

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
        CHECK (
            ativo IN (0, 1)
        ),

    ativado_em TEXT,

    ultimo_acesso_em TEXT,

    tentativas_ativacao INTEGER NOT NULL DEFAULT 0,

    bloqueado_ate TEXT,

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_dispositivos_codigo
ON dispositivos(codigo);


/*
 * =========================================================
 * SESSÕES
 * =========================================================
 */

CREATE TABLE IF NOT EXISTS sessoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    usuario_id INTEGER NOT NULL,

    dispositivo_id INTEGER,

    token_hash TEXT NOT NULL UNIQUE,

    expira_em TEXT NOT NULL,

    ultimo_acesso_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    FOREIGN KEY (dispositivo_id)
        REFERENCES dispositivos(id)
);


CREATE INDEX IF NOT EXISTS idx_sessoes_dispositivo
ON sessoes(dispositivo_id);


CREATE INDEX IF NOT EXISTS idx_sessoes_token_hash
ON sessoes(token_hash);


CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_id
ON sessoes(usuario_id);


/*
 * =========================================================
 * DOCUMENTOS
 * =========================================================
 */

CREATE TABLE IF NOT EXISTS documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    codigo TEXT NOT NULL UNIQUE COLLATE NOCASE,

    titulo TEXT NOT NULL,

    descricao TEXT,

    /*
     * Estes campos permanecem temporariamente
     * por compatibilidade com a versão atual
     * da aplicação.
     *
     * A fonte definitiva da versão publicada
     * passará a ser documento_versoes.
     */

    nome_arquivo TEXT,

    sharepoint_item_id TEXT,

    versao TEXT NOT NULL DEFAULT '1',

    ativo INTEGER NOT NULL DEFAULT 1
        CHECK (
            ativo IN (0, 1)
        ),

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_documentos_codigo
ON documentos(codigo);


/*
 * =========================================================
 * VERSÕES IMUTÁVEIS DOS DOCUMENTOS
 * =========================================================
 */

CREATE TABLE IF NOT EXISTS documento_versoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    documento_id INTEGER NOT NULL,

    numero_versao INTEGER NOT NULL,

    nome_arquivo TEXT NOT NULL,

    mime_type TEXT,

    tamanho_bytes INTEGER,

    /*
     * SHA-256 hexadecimal:
     * exatamente 64 caracteres.
     */

    sha256 TEXT NOT NULL
        CHECK (
            length(sha256) = 64
        ),

    /*
     * Exemplos futuros:
     *
     * SHAREPOINT
     * UPLOAD
     */

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


/*
 * Uma versão publicada não poderá
 * ser alterada.
 */

CREATE TRIGGER IF NOT EXISTS documento_versoes_bloquear_update
BEFORE UPDATE ON documento_versoes

BEGIN

    SELECT RAISE(
        ABORT,
        'Versões publicadas são imutáveis'
    );

END;


/*
 * Uma versão publicada também não poderá
 * ser apagada.
 */

CREATE TRIGGER IF NOT EXISTS documento_versoes_bloquear_delete
BEFORE DELETE ON documento_versoes

BEGIN

    SELECT RAISE(
        ABORT,
        'Versões publicadas são imutáveis'
    );

END;


/*
 * =========================================================
 * DOCUMENTOS ATRIBUÍDOS AOS COLABORADORES
 * =========================================================
 */

CREATE TABLE IF NOT EXISTS documentos_usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    documento_id INTEGER NOT NULL,

    /*
     * Durante a transição permitiremos NULL.
     *
     * Depois que todo documento publicado
     * obrigatoriamente possuir uma versão,
     * este campo poderá virar NOT NULL.
     */

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
        ON DELETE CASCADE,

    /*
     * IMPORTANTE:
     *
     * A mesma pessoa poderá receber futuramente
     * uma nova versão do mesmo documento.
     *
     * Por isso a unicidade passa a considerar
     * a versão específica.
     */

    UNIQUE (
        documento_versao_id,
        usuario_id
    )
);


CREATE INDEX IF NOT EXISTS idx_documentos_usuarios_usuario
ON documentos_usuarios(usuario_id);


CREATE INDEX IF NOT EXISTS idx_documentos_usuarios_documento
ON documentos_usuarios(documento_id);


CREATE INDEX IF NOT EXISTS idx_documentos_usuarios_versao
ON documentos_usuarios(documento_versao_id);


CREATE INDEX IF NOT EXISTS idx_documentos_usuarios_status
ON documentos_usuarios(status);


/*
 * =========================================================
 * AUDITORIA
 * =========================================================
 */

CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    evento TEXT NOT NULL,

    resultado TEXT NOT NULL
        CHECK (
            resultado IN (
                'SUCESSO',
                'FALHA',
                'NEGADO',
                'BLOQUEADO'
            )
        ),

    usuario_id INTEGER,

    usuario_codigo_funcional TEXT,

    usuario_login TEXT,

    sessao_id INTEGER,

    dispositivo_id INTEGER,

    dispositivo_codigo TEXT,

    recurso_tipo TEXT,

    recurso_id TEXT,

    ip TEXT,

    user_agent TEXT,

    cf_ray TEXT,

    detalhes_json TEXT,

    data_hora_utc TEXT NOT NULL
        DEFAULT (
            strftime(
                '%Y-%m-%dT%H:%M:%fZ',
                'now'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_auditoria_evento
ON auditoria(evento);


CREATE INDEX IF NOT EXISTS idx_auditoria_usuario
ON auditoria(usuario_id);


CREATE INDEX IF NOT EXISTS idx_auditoria_sessao
ON auditoria(sessao_id);


CREATE INDEX IF NOT EXISTS idx_auditoria_dispositivo
ON auditoria(dispositivo_id);


CREATE INDEX IF NOT EXISTS idx_auditoria_data
ON auditoria(data_hora_utc);


/*
 * A auditoria funciona como append-only
 * na camada de banco da aplicação.
 */

CREATE TRIGGER IF NOT EXISTS auditoria_bloquear_update
BEFORE UPDATE ON auditoria

BEGIN

    SELECT RAISE(
        ABORT,
        'Registros de auditoria são imutáveis'
    );

END;


CREATE TRIGGER IF NOT EXISTS auditoria_bloquear_delete
BEFORE DELETE ON auditoria

BEGIN

    SELECT RAISE(
        ABORT,
        'Registros de auditoria são imutáveis'
    );

END;