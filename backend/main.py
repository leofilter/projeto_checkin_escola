from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from limiter import limiter
from database import create_tables
from config import settings
from routes import auth, alunos, responsaveis, autorizacoes, registros, chegada
from auth import hash_password
from database import AsyncSessionLocal
import models

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    await run_migrations()
    await seed_admin()
    yield


async def run_migrations():
    """Executa migrações pendentes de forma idempotente (SQLite e PostgreSQL)."""
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    is_pg = settings.DATABASE_URL.startswith(("postgresql", "postgres"))
    async with engine.begin() as conn:
        if is_pg:
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='responsaveis' AND column_name='cpf_hash'"
            ))
            needs_migration = result.fetchone() is None
        else:
            result = await conn.execute(text(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='responsaveis'"
            ))
            row = result.fetchone()
            needs_migration = row is not None and "cpf_hash" not in row[0]

        if needs_migration:
            print("⚙️  Executando migração v3: criptografando CPFs...")
            if not settings.CPF_ENCRYPTION_KEY:
                print("❌ CPF_ENCRYPTION_KEY não configurada — migração v3 ignorada.")
            else:
                import hashlib
                from cryptography.fernet import Fernet
                fernet = Fernet(settings.CPF_ENCRYPTION_KEY.encode())
                rows = await conn.execute(text("SELECT id, cpf FROM responsaveis"))
                registros = rows.fetchall()

                if is_pg:
                    await conn.execute(text("ALTER TABLE responsaveis ADD COLUMN cpf_hash VARCHAR(64)"))
                    await conn.execute(text("ALTER TABLE responsaveis ADD COLUMN cpf_enc TEXT"))
                    for rec_id, cpf in registros:
                        cpf_hash = hashlib.sha256(cpf.encode()).hexdigest()
                        cpf_enc = fernet.encrypt(cpf.encode()).decode()
                        await conn.execute(text(
                            "UPDATE responsaveis SET cpf_hash = :h, cpf_enc = :e WHERE id = :id"
                        ), {"id": rec_id, "h": cpf_hash, "e": cpf_enc})
                    await conn.execute(text("ALTER TABLE responsaveis ALTER COLUMN cpf_hash SET NOT NULL"))
                    await conn.execute(text("ALTER TABLE responsaveis ALTER COLUMN cpf_enc SET NOT NULL"))
                    await conn.execute(text("ALTER TABLE responsaveis DROP COLUMN cpf"))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_responsaveis_cpf_hash ON responsaveis (cpf_hash)"
                    ))
                else:
                    await conn.execute(text("""
                        CREATE TABLE responsaveis_v3 (
                            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                            nome VARCHAR(100) NOT NULL,
                            cpf_hash VARCHAR(64) NOT NULL,
                            cpf_enc TEXT NOT NULL,
                            telefone VARCHAR(20),
                            parentesco VARCHAR(50) NOT NULL,
                            foto_path VARCHAR(500),
                            face_encoding TEXT,
                            aluno_id INTEGER NOT NULL REFERENCES alunos(id),
                            ativo BOOLEAN NOT NULL DEFAULT 1,
                            criado_em DATETIME
                        )
                    """))
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

                print(f"✅ Migração v3 concluída: {len(registros)} CPF(s) criptografado(s).")
    await engine.dispose()


async def seed_admin():
    """Cria usuário admin padrão se não existir."""
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(models.Usuario).where(models.Usuario.email == "admin@escola.com")
        )
        if not result.scalar_one_or_none():
            admin = models.Usuario(
                email="admin@escola.com",
                senha_hash=hash_password("admin123"),
                nome="Administrador",
                role="admin",
            )
            db.add(admin)
            await db.commit()
            print("✅ Admin criado: admin@escola.com / admin123")


app = FastAPI(
    title="Sistema de Check-in Escolar",
    description="API para controle seguro de retirada de crianças na escola",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(alunos.router)
app.include_router(responsaveis.router)
app.include_router(autorizacoes.router)
app.include_router(registros.router)
app.include_router(chegada.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
