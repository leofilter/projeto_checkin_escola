import asyncio
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
import models
import schemas
from auth import require_porteiro
from services import facial_recognition, email_service

router = APIRouter(prefix="/checkin", tags=["checkin"])


@router.get("/validar/{token}", response_model=schemas.QRValidationResponse)
async def validar_qr(
    token: str,
    db: AsyncSession = Depends(get_db),
    _porteiro=Depends(require_porteiro),
):
    """Etapa 1: Porteiro escaneia QR Code → valida autorização."""
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
        return schemas.QRValidationResponse(valido=False, motivos=["QR Code não encontrado"])

    now = datetime.utcnow()
    motivos = []

    if auth.usado:
        motivos.append("QR Code já utilizado")
    if auth.cancelado:
        motivos.append("Autorização foi cancelada")
    if auth.valido_ate < now:
        motivos.append("QR Code expirado")
    if auth.data_autorizacao != date.today():
        motivos.append("Autorização não é para hoje")

    if motivos:
        return schemas.QRValidationResponse(valido=False, motivos=motivos)

    resp = auth.responsavel
    foto_url = f"/responsaveis/{resp.id}/foto" if resp.foto_path else None

    return schemas.QRValidationResponse(
        valido=True,
        autorizacao_id=auth.id,
        aluno={"nome": auth.aluno.nome, "turma": auth.aluno.turma},
        responsavel={
            "id": resp.id,
            "nome": resp.nome,
            "parentesco": resp.parentesco,
            "telefone": resp.telefone,
            "foto_url": foto_url,
            "tem_facial": bool(resp.face_encoding),
        },
    )


@router.post("/verify-face", response_model=schemas.FaceVerifyResponse)
async def verify_face(
    autorizacao_id: int = Form(...),
    frame: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _porteiro=Depends(require_porteiro),
):
    """Etapa 2: Envia frame da câmera → retorna resultado do reconhecimento facial."""
    result = await db.execute(
        select(models.Autorizacao)
        .options(selectinload(models.Autorizacao.responsavel))
        .where(models.Autorizacao.id == autorizacao_id)
    )
    auth = result.scalar_one_or_none()

    if not auth or auth.usado or auth.cancelado:
        raise HTTPException(409, "Autorização inválida")

    resp = auth.responsavel
    if not resp.face_encoding:
        return schemas.FaceVerifyResponse(
            match=False,
            reason="Responsável não possui reconhecimento facial cadastrado. Confirme manualmente.",
        )

    frame_bytes = await frame.read()
    if len(frame_bytes) > 10 * 1024 * 1024:
        raise HTTPException(400, "Frame muito grande")

    face_result = await facial_recognition.verify_face(frame_bytes, resp.face_encoding)
    return schemas.FaceVerifyResponse(**face_result)


@router.post("/confirmar", response_model=schemas.CheckinConfirmadoResponse)
async def confirmar_checkin(
    payload: schemas.ConfirmarCheckinRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    porteiro: models.Usuario = Depends(require_porteiro),
):
    """Etapa 3: Confirma entrega → registra log + envia notificação."""
    result = await db.execute(
        select(models.Autorizacao)
        .options(
            selectinload(models.Autorizacao.aluno).selectinload(models.Aluno.pai),
            selectinload(models.Autorizacao.responsavel),
        )
        .where(models.Autorizacao.id == payload.autorizacao_id)
    )
    auth = result.scalar_one_or_none()

    if not auth:
        raise HTTPException(404, "Autorização não encontrada")
    if auth.usado:
        raise HTTPException(409, "Autorização já utilizada")
    if auth.cancelado:
        raise HTTPException(409, "Autorização foi cancelada")

    # Override sem reconhecimento facial requer observação
    if not payload.face_match and not payload.observacao:
        raise HTTPException(
            400,
            "Informe uma observação ao confirmar sem reconhecimento facial aprovado",
        )

    timestamp = datetime.utcnow()
    auth.usado = True

    registro = models.RegistroEntrega(
        autorizacao_id=auth.id,
        porteiro_id=porteiro.id,
        timestamp=timestamp,
        face_match=payload.face_match,
        face_confidence=payload.face_confidence,
        observacao=payload.observacao,
        ip_origem=request.client.host if request.client else None,
    )
    db.add(registro)
    await db.commit()
    await db.refresh(registro)

    # Notifica pais em background (não bloqueia resposta)
    pai = auth.aluno.pai
    if pai:
        asyncio.create_task(
            email_service.notify_pickup(
                pai_email=pai.email,
                aluno_nome=auth.aluno.nome,
                responsavel_nome=auth.responsavel.nome,
                responsavel_parentesco=auth.responsavel.parentesco,
                timestamp=timestamp,
            )
        )

    return schemas.CheckinConfirmadoResponse(
        status="confirmado",
        timestamp=timestamp.isoformat(),
        registro_id=registro.id,
    )
