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