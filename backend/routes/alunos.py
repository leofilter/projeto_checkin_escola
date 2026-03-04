import aiofiles
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
import models
import schemas
from auth import require_admin, require_pai, get_current_user
from config import FOTOS_PATH

router = APIRouter(prefix="/alunos", tags=["alunos"])


@router.get("", response_model=list[schemas.AlunoResponse])
async def list_alunos(
    db: AsyncSession = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    query = select(models.Aluno).where(models.Aluno.ativo == True)
    if current_user.role == "pai":
        query = query.where(models.Aluno.usuario_pai_id == current_user.id)
    result = await db.execute(query.order_by(models.Aluno.nome))
    return result.scalars().all()


@router.post("", response_model=schemas.AlunoResponse)
async def create_aluno(
    data: schemas.AlunoCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    aluno = models.Aluno(**data.model_dump())
    db.add(aluno)
    await db.commit()
    await db.refresh(aluno)
    return aluno


@router.get("/{aluno_id}", response_model=schemas.AlunoResponse)
async def get_aluno(
    aluno_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    result = await db.execute(
        select(models.Aluno).where(models.Aluno.id == aluno_id)
    )
    aluno = result.scalar_one_or_none()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    return aluno


@router.put("/{aluno_id}", response_model=schemas.AlunoResponse)
async def update_aluno(
    aluno_id: int,
    data: schemas.AlunoUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    result = await db.execute(
        select(models.Aluno).where(models.Aluno.id == aluno_id)
    )
    aluno = result.scalar_one_or_none()
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(aluno, field, value)

    await db.commit()
    await db.refresh(aluno)
    return aluno


@router.post("/{aluno_id}/foto")
async def upload_foto_aluno(
    aluno_id: int,
    foto: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    if foto.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(400, "Formato não suportado. Use JPEG, PNG ou WEBP.")

    contents = await foto.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(400, "Imagem muito grande (máximo 5MB)")

    foto_path = FOTOS_PATH / f"aluno_{aluno_id}.jpg"
    async with aiofiles.open(foto_path, "wb") as f:
        await f.write(contents)

    result = await db.execute(select(models.Aluno).where(models.Aluno.id == aluno_id))
    aluno = result.scalar_one_or_none()
    if not aluno:
        raise HTTPException(404, "Aluno não encontrado")

    aluno.foto_path = str(foto_path)
    await db.commit()

    return {"status": "ok", "foto_path": str(foto_path)}


@router.delete("/{aluno_id}")
async def delete_aluno(
    aluno_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    result = await db.execute(select(models.Aluno).where(models.Aluno.id == aluno_id))
    aluno = result.scalar_one_or_none()
    if not aluno:
        raise HTTPException(404, "Aluno não encontrado")
    aluno.ativo = False
    await db.commit()
    return {"status": "desativado"}
