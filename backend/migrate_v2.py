"""
Migração v2: remove unique constraint de responsaveis.cpf
para permitir que um responsável seja vinculado a múltiplos alunos.

Execute uma única vez:
  python migrate_v2.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


async def migrate():
    engine = create_async_engine("sqlite+aiosqlite:///escola.db", echo=True)
    async with engine.begin() as conn:
        # Verifica se a migração já foi feita (índice unique não existe mais)
        result = await conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='responsaveis'"
        ))
        row = result.fetchone()
        if row and "UNIQUE" not in row[0].upper():
            print("Migração já aplicada anteriormente. Nada a fazer.")
            await engine.dispose()
            return

        print("Aplicando migração: removendo unique de responsaveis.cpf...")

        await conn.execute(text("""
            CREATE TABLE responsaveis_v2 (
                id      INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                nome    VARCHAR(100) NOT NULL,
                cpf     VARCHAR(14) NOT NULL,
                telefone VARCHAR(20),
                parentesco VARCHAR(50) NOT NULL,
                foto_path  VARCHAR(500),
                face_encoding TEXT,
                aluno_id INTEGER NOT NULL REFERENCES alunos(id),
                ativo    BOOLEAN NOT NULL DEFAULT 1,
                criado_em DATETIME
            )
        """))

        await conn.execute(text(
            "INSERT INTO responsaveis_v2 SELECT * FROM responsaveis"
        ))

        await conn.execute(text("DROP TABLE responsaveis"))
        await conn.execute(text(
            "ALTER TABLE responsaveis_v2 RENAME TO responsaveis"
        ))

    print("Migração concluída com sucesso!")
    await engine.dispose()


asyncio.run(migrate())
