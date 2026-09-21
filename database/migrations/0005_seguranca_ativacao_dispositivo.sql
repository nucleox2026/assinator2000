ALTER TABLE dispositivos
ADD COLUMN tentativas_ativacao INTEGER NOT NULL DEFAULT 0;

ALTER TABLE dispositivos
ADD COLUMN bloqueado_ate TEXT;