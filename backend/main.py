from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_tables
from config import settings
from routes import auth, alunos, responsaveis, autorizacoes, registros, chegada
from auth import hash_password
from database import AsyncSessionLocal
import models


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    await seed_admin()
    yield


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
