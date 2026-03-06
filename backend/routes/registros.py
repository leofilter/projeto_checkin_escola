from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
import models
import schemas
from auth import require_any

router = APIRouter(prefix="/registros", tags=["registros"])


@router.get("", response_model=list[schemas.RegistroResponse])
async def list_registros(
    data: date | None = None,
    aluno_id: int | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_any),
):
    query = (
        select(models.RegistroEntrega)
        .options(
            selectinload(models.RegistroEntrega.autorizacao)
            .selectinload(models.Autorizacao.aluno),
            selectinload(models.RegistroEntrega.autorizacao)
            .selectinload(models.Autorizacao.responsavel),
            selectinload(models.RegistroEntrega.porteiro),
        )
        .order_by(models.RegistroEntrega.timestamp.desc())
        .limit(limit)
    )

    if data:
        query = query.join(models.Autorizacao).where(
            models.Autorizacao.data_autorizacao == data
        )
    if aluno_id:
        query = query.join(models.Autorizacao).where(
            models.Autorizacao.aluno_id == aluno_id
        )

    result = await db.execute(query)
    return result.scalars().all()
