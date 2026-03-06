from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
import models
import schemas
from auth import get_current_user, require_pai, require_porteiro
from services.qrcode_service import generate_token, calculate_expiry

router = APIRouter(prefix="/autorizacoes", tags=["autorizações"])


@router.post("", response_model=schemas.AutorizacaoResponse)
async def create_autorizacao(
    data: schemas.AutorizacaoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    if current_user.role not in ("admin", "pai"):
        raise HTTPException(403, "Apenas pais ou admin podem criar autorizações")

    # Verifica se aluno pertence ao pai
    if current_user.role == "pai":
        result = await db.execute(
            select(models.Aluno).where(
                models.Aluno.id == data.aluno_id,
                models.Aluno.usuario_pai_id == current_user.id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(403, "Aluno não vinculado a este usuário")

    # Responsável deve estar vinculado ao aluno
    result = await db.execute(
        select(models.Responsavel).where(
            models.Responsavel.id == data.responsavel_id,
            models.Responsavel.aluno_id == data.aluno_id,
            models.Responsavel.ativo == True,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(400, "Responsável não está autorizado para este aluno")

    token = generate_token()
    valido_ate = calculate_expiry(data.data_autorizacao)

    autorizacao = models.Autorizacao(
        aluno_id=data.aluno_id,
        responsavel_id=data.responsavel_id,
        data_autorizacao=data.data_autorizacao,
        hora_prevista=data.hora_prevista,
        qrcode_token=token,
        valido_ate=valido_ate,
        criado_por=current_user.id,
    )
    db.add(autorizacao)
    await db.commit()
    await db.refresh(autorizacao)
    return autorizacao


@router.get("", response_model=list[schemas.AutorizacaoDetalhadaResponse])
async def list_autorizacoes(
    aluno_id: int | None = None,
    data: date | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    query = (
        select(models.Autorizacao)
        .options(
            selectinload(models.Autorizacao.aluno),
            selectinload(models.Autorizacao.responsavel),
        )
        .order_by(models.Autorizacao.criado_em.desc())
    )

    if aluno_id:
        query = query.where(models.Autorizacao.aluno_id == aluno_id)
    if data:
        query = query.where(models.Autorizacao.data_autorizacao == data)

    # Pais veem apenas autorizações dos seus filhos
    if current_user.role == "pai":
        query = query.join(models.Aluno).where(
            models.Aluno.usuario_pai_id == current_user.id
        )

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{token}", response_model=schemas.AutorizacaoDetalhadaResponse)
async def get_autorizacao_by_token(
    token: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    result = await db.execute(
        select(models.Autorizacao)
        .options(
            selectinload(models.Autorizacao.aluno),
            selectinload(models.Autorizacao.responsavel),
        )
        .where(models.Autorizacao.qrcode_token == token)
    )
    auth = result.scalar_one_or_none()
    if not auth:
        raise HTTPException(404, "QR Code não encontrado")
    return auth


@router.post("/{autorizacao_id}/cancelar")
async def cancelar_autorizacao(
    autorizacao_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    if current_user.role not in ("admin", "pai"):
        raise HTTPException(403, "Permissão negada")

    result = await db.execute(
        select(models.Autorizacao).where(models.Autorizacao.id == autorizacao_id)
    )
    auth = result.scalar_one_or_none()
    if not auth:
        raise HTTPException(404, "Autorização não encontrada")
    if auth.usado:
        raise HTTPException(400, "Autorização já utilizada, não pode ser cancelada")

    auth.cancelado = True
    await db.commit()
    return {"status": "cancelado"}
