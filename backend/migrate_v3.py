"""
Migração v3: criptografa CPF na tabela responsaveis (LGPD art. 46).

Substitui a coluna `cpf` (texto puro) por:
  - cpf_hash  VARCHAR(64)  — SHA-256, índice de busca (irreversível)
  - cpf_enc   TEXT         — Fernet AES-128-CBC, dado legível apenas com a chave

ANTES de executar:
  1. Gere uma chave Fernet (UMA ÚNICA VEZ e guarde-a):
       python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  2. Adicione ao arquivo .env:
       CPF_ENCRYPTION_KEY=<chave gerada acima>
  3. Execute esta migração UMA ÚNICA VEZ:
       python migrate_v3.py

ATENÇÃO: Sem a CPF_ENCRYPTION_KEY correta, os CPFs se tornam inacessíveis.
         Faça backup do banco antes de executar.
"""
import asyncio
import hashlib
from cryptography.fernet import Fernet
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from config import settings


async def migrate():
    if not settings.CPF_ENCRYPTION_KEY:
        print("=" * 60)
        print("ERRO: CPF_ENCRYPTION_KEY não configurada no .env")
        print()
        print("Gere a chave com:")
        print('  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"')
        print()
        print("Adicione ao .env:")
        print("  CPF_ENCRYPTION_KEY=<chave gerada>")
        print("=" * 60)
        return

    fernet = Fernet(settings.CPF_ENCRYPTION_KEY.encode())
    engine = create_async_engine("sqlite+aiosqlite:///escola.db", echo=False)

    async with engine.begin() as conn:
        # Verifica se já foi migrado
        result = await conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='responsaveis'"
        ))
        row = result.fetchone()
        if row and "cpf_hash" in row[0]:
            print("Migração v3 já aplicada anteriormente. Nada a fazer.")
            await engine.dispose()
            return

        # Lê todos os CPFs em texto puro
        rows = await conn.execute(text("SELECT id, cpf FROM responsaveis"))
        registros = rows.fetchall()
        print(f"Criptografando {len(registros)} registros...")

        # Recria a tabela com as novas colunas
        await conn.execute(text("""
            CREATE TABLE responsaveis_v3 (
                id            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                nome          VARCHAR(100) NOT NULL,
                cpf_hash      VARCHAR(64) NOT NULL,
                cpf_enc       TEXT NOT NULL,
                telefone      VARCHAR(20),
                parentesco    VARCHAR(50) NOT NULL,
                foto_path     VARCHAR(500),
                face_encoding TEXT,
                aluno_id      INTEGER NOT NULL REFERENCES alunos(id),
                ativo         BOOLEAN NOT NULL DEFAULT 1,
                criado_em     DATETIME
            )
        """))

        # Migra cada registro criptografando o CPF
        for rec_id, cpf in registros:
            cpf_hash = hashlib.sha256(cpf.encode()).hexdigest()
            cpf_enc = fernet.encrypt(cpf.encode()).decode()
            await conn.execute(text("""
                INSERT INTO responsaveis_v3
                SELECT :id, nome, :cpf_hash, :cpf_enc, telefone, parentesco,
                       foto_path, face_encoding, aluno_id, ativo, criado_em
                FROM responsaveis WHERE id = :id
            """), {"id": rec_id, "cpf_hash": cpf_hash, "cpf_enc": cpf_enc})

        await conn.execute(text("DROP TABLE responsaveis"))
        await conn.execute(text("ALTER TABLE responsaveis_v3 RENAME TO responsaveis"))
        await conn.execute(text(
            "CREATE INDEX ix_responsaveis_cpf_hash ON responsaveis (cpf_hash)"
        ))

    print("=" * 60)
    print("Migração v3 concluída! CPFs criptografados com sucesso.")
    print(f"  {len(registros)} registro(s) migrado(s).")
    print()
    print("IMPORTANTE: Guarde a CPF_ENCRYPTION_KEY em local seguro.")
    print("Sem ela, os CPFs não poderão ser recuperados.")
    print("=" * 60)
    await engine.dispose()


asyncio.run(migrate())
