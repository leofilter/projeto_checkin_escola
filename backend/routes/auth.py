from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
import models
import schemas
from auth import verify_password, create_access_token, hash_password, require_admin, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenResponse)
async def login(form: schemas.LoginForm, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Usuario).where(models.Usuario.email == form.email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form.senha, user.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")

    if not user.ativo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta desativada")

    token = create_access_token(user)
    return schemas.TokenResponse(
        access_token=token,
        role=user.role,
        nome=user.nome,
        user_id=user.id,
    )


@router.post("/usuarios", response_model=schemas.UsuarioResponse)
async def create_usuario(
    data: schemas.UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    existing = await db.execute(
        select(models.Usuario).where(models.Usuario.email == data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    user = models.Usuario(
        email=data.email,
        senha_hash=hash_password(data.senha),
        nome=data.nome,
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/usuarios", response_model=list[schemas.UsuarioResponse])
async def list_usuarios(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    result = await db.execute(select(models.Usuario).order_by(models.Usuario.nome))
    return result.scalars().all()


@router.get("/me", response_model=schemas.UsuarioResponse)
async def me(current_user: models.Usuario = Depends(get_current_user)):
    return current_user
