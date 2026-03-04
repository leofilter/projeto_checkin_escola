import json
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
import models
import schemas
from auth import require_admin, require_porteiro, get_current_user
from config import FOTOS_PATH
from services import facial_recognition

router = APIRouter(prefix="/responsaveis", tags=["responsaveis"])


@router.get("", response_model=list[schemas.ResponsavelResponse])
async def list_responsaveis(
    aluno_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = select(models.Responsavel).where(models.Responsavel.ativo == True)
    if aluno_id:
        query = query.where(models.Responsavel.aluno_id == aluno_id)
    result = await db.execute(query.order_by(models.Responsavel.nome))
    return result.scalars().all()


@router.post("", response_model=schemas.ResponsavelResponse)
async def create_responsavel(
    data: schemas.ResponsavelCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    # Impede vincular o mesmo CPF duas vezes ao mesmo aluno
    existing = await db.execute(
        select(models.Responsavel).where(
            models.Responsavel.cpf == data.cpf,
            models.Responsavel.aluno_id == data.aluno_id,
            models.Responsavel.ativo == True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Este responsável já está vinculado a este aluno")

    resp = models.Responsavel(**data.model_dump())

    # Se já existe outro registro com este CPF, copia o face_encoding e foto_path
    outros = await db.execute(
        select(models.Responsavel).where(
            models.Responsavel.cpf == data.cpf,
            models.Responsavel.face_encoding.is_not(None),
        )
    )
    outro = outros.scalars().first()
    if outro:
        resp.face_encoding = outro.face_encoding
        resp.foto_path = outro.foto_path

    db.add(resp)
    await db.commit()
    await db.refresh(resp)
    return resp


@router.get("/{responsavel_id}", response_model=schemas.ResponsavelResponse)
async def get_responsavel(
    responsavel_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    result = await db.execute(
        select(models.Responsavel).where(models.Responsavel.id == responsavel_id)
    )
    resp = result.scalar_one_or_none()
    if not resp:
        raise HTTPException(404, "Responsável não encontrado")
    return resp


@router.put("/{responsavel_id}", response_model=schemas.ResponsavelResponse)
async def update_responsavel(
    responsavel_id: int,
    data: schemas.ResponsavelUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    result = await db.execute(
        select(models.Responsavel).where(models.Responsavel.id == responsavel_id)
    )
    resp = result.scalar_one_or_none()
    if not resp:
        raise HTTPException(404, "Responsável não encontrado")

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(resp, field, value)

    # Propaga nome/telefone/parentesco para todos os registros com mesmo CPF
    outros_result = await db.execute(
        select(models.Responsavel).where(
            models.Responsavel.cpf == resp.cpf,
            models.Responsavel.id != responsavel_id,
        )
    )
    for outro in outros_result.scalars().all():
        for field, value in updates.items():
            setattr(outro, field, value)

    await db.commit()
    await db.refresh(resp)
    return resp


@router.post("/{responsavel_id}/face-enroll")
async def enroll_face(
    responsavel_id: int,
    photo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Cadastra embedding facial do responsável a partir de uma foto."""
    if photo.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(400, "Formato não suportado. Use JPEG, PNG ou WEBP.")

    contents = await photo.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(400, "Imagem muito grande (máximo 10MB)")

    result = await db.execute(
        select(models.Responsavel).where(models.Responsavel.id == responsavel_id)
    )
    resp = result.scalar_one_or_none()
    if not resp:
        raise HTTPException(404, "Responsável não encontrado")

    encoding = await facial_recognition.extract_encoding(contents)

    if encoding is None:
        raise HTTPException(
            422,
            detail={
                "error": "face_not_found",
                "message": (
                    "Nenhum rosto detectado na imagem. "
                    "Envie uma foto com o rosto centralizado, iluminado e sem obstruções."
                ),
            },
        )

    # Salva foto no disco
    foto_path = FOTOS_PATH / f"resp_{responsavel_id}.jpg"
    async with aiofiles.open(foto_path, "wb") as f:
        await f.write(contents)

    encoding_json = json.dumps(encoding)
    foto_path_str = str(foto_path)

    # Propaga encoding para todos os registros com o mesmo CPF
    todos = await db.execute(
        select(models.Responsavel).where(models.Responsavel.cpf == resp.cpf)
    )
    for r in todos.scalars().all():
        r.face_encoding = encoding_json
        r.foto_path = foto_path_str

    await db.commit()

    return {
        "status": "enrolled",
        "message": "Reconhecimento facial cadastrado com sucesso",
        "responsavel_id": responsavel_id,
    }


@router.get("/{responsavel_id}/foto")
async def get_foto(
    responsavel_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_porteiro),
):
    """Serve foto do responsável (somente admin/porteiro)."""
    result = await db.execute(
        select(models.Responsavel).where(models.Responsavel.id == responsavel_id)
    )
    resp = result.scalar_one_or_none()
    if not resp or not resp.foto_path:
        raise HTTPException(404, "Foto não encontrada")
    return FileResponse(resp.foto_path, media_type="image/jpeg")


@router.delete("/{responsavel_id}")
async def delete_responsavel(
    responsavel_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    result = await db.execute(
        select(models.Responsavel).where(models.Responsavel.id == responsavel_id)
    )
    resp = result.scalar_one_or_none()
    if not resp:
        raise HTTPException(404, "Responsável não encontrado")
    resp.ativo = False
    await db.commit()
    return {"status": "desativado"}
