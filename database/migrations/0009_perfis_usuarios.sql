/*
 * =========================================================
 * MIGRATION 0009
 *
 * Amplia os perfis de usuário do Assinator2000.
 *
 * Perfis:
 * COLABORADOR
 * ADMIN
 * RH
 * JURIDICO
 * TI
 * GOVERNANCA
 * =========================================================
 */


/*
 * Durante o RENAME queremos que as tabelas filhas
 * continuem apontando para "usuarios", e não para
 * "usuarios_antigo".
 */

PRAGMA legacy_alter_table = ON;


/*
 * Validações de FK podem ficar temporariamente
 * inconsistentes durante a reconstrução.
 */

PRAGMA defer_foreign_keys = ON;


/*
 * 1. Renomeia a tabela antiga.
 */

ALTER TABLE usuarios
RENAME TO usuarios_antigo;


/*
 * 2. Cria a nova versão da tabela.
 */

CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    codigo_funcional TEXT,

    nome TEXT NOT NULL,

    usuario TEXT NOT NULL
        UNIQUE COLLATE NOCASE,

    senha_hash TEXT NOT NULL,

    senha_salt TEXT NOT NULL,

    credencial_ativada INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            credencial_ativada
            IN (0, 1)
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

    ativo INTEGER NOT NULL
        DEFAULT 1
        CHECK (
            ativo IN (0, 1)
        ),

    desligado_em TEXT,

    tentativas_falhas INTEGER NOT NULL
        DEFAULT 0,

    bloqueado_ate TEXT,

    criado_em TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    atualizado_em TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP
);


/*
 * 3. Copia preservando todos os IDs.
 */

INSERT INTO usuarios (
    id,
    codigo_funcional,
    nome,
    usuario,
    senha_hash,
    senha_salt,
    credencial_ativada,
    ativacao_expira_em,
    setor,
    perfil,
    ativo,
    desligado_em,
    tentativas_falhas,
    bloqueado_ate,
    criado_em,
    atualizado_em
)

SELECT
    id,
    codigo_funcional,
    nome,
    usuario,
    senha_hash,
    senha_salt,
    credencial_ativada,
    ativacao_expira_em,
    setor,
    perfil,
    ativo,
    desligado_em,
    tentativas_falhas,
    bloqueado_ate,
    criado_em,
    atualizado_em

FROM usuarios_antigo;


/*
 * 4. Recria os índices.
 */

CREATE INDEX IF NOT EXISTS idx_usuarios_usuario
ON usuarios(usuario);


CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_codigo_funcional
ON usuarios(codigo_funcional)
WHERE codigo_funcional IS NOT NULL;


/*
 * 5. Remove somente a tabela antiga.
 *
 * Como as FKs das tabelas filhas permaneceram
 * apontando para "usuarios", não devem ocorrer
 * cascatas para usuarios_antigo.
 */

DROP TABLE usuarios_antigo;


/*
 * 6. Volta ao comportamento padrão.
 */

PRAGMA legacy_alter_table = OFF;


/*
 * 7. Obriga a validação das FKs antes
 * do término da migração.
 */

PRAGMA defer_foreign_keys = OFF;