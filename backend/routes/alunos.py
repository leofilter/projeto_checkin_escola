import io
import aiofiles
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
import models
import schemas
from auth import require_admin, get_current_user
from config import FOTOS_PATH

router = APIRouter(prefix="/alunos", tags=["alunos"])


@router.get("", response_model=list[schemas.AlunoResponse])
async def list_alunos(
    db: AsyncSession = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    query = select(models.Aluno).where(models.Aluno.ativo == True)
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


@router.post("/importar")
async def importar_alunos(
    arquivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    import openpyxl

    if not arquivo.filename or not arquivo.filename.lower().endswith(".xlsx"):
        raise HTTPException(400, "Envie um arquivo .xlsx válido.")

    contents = await arquivo.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        ws = wb.active
    except Exception:
        raise HTTPException(400, "Não foi possível ler o arquivo. Certifique-se de que é um .xlsx válido.")

    criados = 0
    ignorados = 0
    erros = []

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        nome = str(row[0]).strip() if row[0] is not None else ""
        turma = str(row[1]).strip() if row[1] is not None else ""

        if not nome or not turma:
            if nome or turma:
                erros.append(f"Linha {i}: nome ou turma em branco.")
            continue

        # Verifica se já existe (mesmo nome + turma, ativo)
        result = await db.execute(
            select(models.Aluno).where(
                models.Aluno.nome == nome,
                models.Aluno.turma == turma,
                models.Aluno.ativo == True,
            )
        )
        existente = result.scalar_one_or_none()
        if existente:
            ignorados += 1
            continue

        aluno = models.Aluno(nome=nome, turma=turma)
        db.add(aluno)
        criados += 1

    await db.commit()

    return {"criados": criados, "ignorados": ignorados, "erros": erros}


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
