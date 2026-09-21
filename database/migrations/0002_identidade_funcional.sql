ALTER TABLE usuarios
ADD COLUMN codigo_funcional TEXT;


ALTER TABLE usuarios
ADD COLUMN credencial_ativada INTEGER NOT NULL DEFAULT 0
CHECK (credencial_ativada IN (0, 1));


ALTER TABLE usuarios
ADD COLUMN desligado_em TEXT;


CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_codigo_funcional
ON usuarios(codigo_funcional)
WHERE codigo_funcional IS NOT NULL;