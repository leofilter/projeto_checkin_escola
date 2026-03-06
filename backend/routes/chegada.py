"""
Fluxo de chegada do responsável na escola.

O responsável escaneia o QR Code fixo da escola com o celular,
informa o CPF, tira uma selfie para verificação facial e seleciona
qual filho vai buscar. Tudo sem precisar de login.
"""
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from database import get_db
import models
from services import facial_recognition, email_service

router = APIRouter(prefix="/chegada", tags=["chegada"])


class BuscarResponsavelResponse(BaseModel):
    responsavel_id: int
    nome: str
    parentesco: str
    tem_facial: bool
    filhos: list[dict]


class ConfirmarChegadaRequest(BaseModel):
    responsavel_id: int
    aluno_id: int
    face_match: bool
    face_confidence: float | None = None
    observacao: str | None = None


class ChegadaResponse(BaseModel):
    status: str
    registro_id: int
    timestamp: str
    aluno_nome: str
    responsavel_nome: str


def _get_local_ip() -> str:
    """Detecta o IP local da máquina na rede."""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"


@router.get("/qrcode-escola")
async def get_qrcode_escola():
    """
    Retorna o QR Code da escola para exibir na portaria.
    Aponta para a URL de produção no Vercel com token de 6 horas.
    """
    from config import settings
    from services.qrcode_service import generate_window_token, CHEGADA_BASE_URL

    token = generate_window_token(settings.SECRET_KEY)
    url = f"{CHEGADA_BASE_URL}?t={token}"
    qr_image = generate_qr_image_from_url(url)

    return {
        "qr_image": qr_image,
        "url": url,
        "instrucao": "Escaneie com o celular para registrar sua chegada",
        "valido_horas": 6,
    }


@router.get("/validar-token")
async def validar_token(t: str):
    """
    Valida o token de 6 horas do QR Code da escola.
    Rota pública — usada pela página /chegada ao carregar.
    """
    from config import settings
    from services.qrcode_service import validate_window_token

    if validate_window_token(t, settings.SECRET_KEY):
        return {"valido": True}
    raise HTTPException(401, "QR Code expirado. Solicite um novo QR Code ao porteiro.")


def generate_qr_image_from_url(url: str) -> str:
    import qrcode
    import io
    import base64

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=12,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@router.get("/buscar-por-cpf/{cpf}", response_model=BuscarResponsavelResponse)
async def buscar_por_cpf(
    cpf: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Etapa 1: Pai informa o CPF → retorna seu nome + filhos vinculados.
    Rota pública (sem autenticação).
    """
    import re
    cleaned = re.sub(r"\D", "", cpf)
    cpf_formatado = f"{cleaned[:3]}.{cleaned[3:6]}.{cleaned[6:9]}-{cleaned[9:]}" if len(cleaned) == 11 else cpf

    result = await db.execute(
        select(models.Responsavel)
        .options(selectinload(models.Responsavel.aluno))
        .where(models.Responsavel.cpf == cpf_formatado, models.Responsavel.ativo == True)
    )
    # Um CPF pode ter múltiplos registros (um por aluno)
    responsaveis = result.scalars().all()

    if not responsaveis:
        raise HTTPException(404, "CPF não encontrado. Verifique com a escola se seu cadastro está completo.")

    # Agrupa todos os filhos vinculados a este CPF
    principal = responsaveis[0]
    filhos = [
        {"id": r.aluno.id, "nome": r.aluno.nome, "turma": r.aluno.turma, "responsavel_id": r.id}
        for r in responsaveis
    ]

    return BuscarResponsavelResponse(
        responsavel_id=principal.id,
        nome=principal.nome,
        parentesco=principal.parentesco,
        tem_facial=bool(principal.face_encoding),
        filhos=filhos,
    )


@router.post("/verificar-face", response_model=dict)
async def verificar_face_chegada(
    responsavel_id: int = Form(...),
    selfie: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Etapa 2: Verifica a selfie do responsável contra o encoding cadastrado.
    Rota pública (sem autenticação).
    """
    result = await db.execute(
        select(models.Responsavel).where(models.Responsavel.id == responsavel_id)
    )
    resp = result.scalar_one_or_none()

    if not resp:
        raise HTTPException(404, "Responsável não encontrado")

    if not resp.face_encoding:
        return {
            "match": False,
            "reason": "Responsável sem reconhecimento facial cadastrado. Dirija-se ao porteiro.",
            "confidence": None,
        }

    frame_bytes = await selfie.read()
    if len(frame_bytes) > 15 * 1024 * 1024:
        raise HTTPException(400, "Imagem muito grande")

    face_result = await facial_recognition.verify_face(frame_bytes, resp.face_encoding)
    return face_result


@router.post("/confirmar", response_model=ChegadaResponse)
async def confirmar_chegada(
    payload: ConfirmarChegadaRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Etapa 3: Confirma o check-in de chegada.
    Registra no RegistroChegada e notifica porteiro + pais.
    Rota pública (sem autenticação) — segurança garantida pelo face_match.
    """
    # Busca o responsável com o aluno vinculado
    result = await db.execute(
        select(models.Responsavel)
        .options(
            selectinload(models.Responsavel.aluno).selectinload(models.Aluno.pai)
        )
        .where(
            models.Responsavel.id == payload.responsavel_id,
            models.Responsavel.aluno_id == payload.aluno_id,
            models.Responsavel.ativo == True,
        )
    )
    resp = result.scalar_one_or_none()

    if not resp:
        raise HTTPException(404, "Vínculo responsável-aluno não encontrado")

    if not payload.face_match and not payload.observacao:
        raise HTTPException(400, "Informe uma observação para check-in sem reconhecimento facial aprovado")

    timestamp = datetime.utcnow()

    registro = models.RegistroChegada(
        responsavel_id=resp.id,
        aluno_id=resp.aluno.id,
        timestamp=timestamp,
        face_match=payload.face_match,
        face_confidence=payload.face_confidence,
        observacao=payload.observacao,
    )
    db.add(registro)
    await db.commit()
    await db.refresh(registro)

    # Notifica pais em background
    pai = resp.aluno.pai
    if pai:
        asyncio.create_task(
            email_service.notify_pickup(
                pai_email=pai.email,
                aluno_nome=resp.aluno.nome,
                responsavel_nome=resp.nome,
                responsavel_parentesco=resp.parentesco,
                timestamp=timestamp,
            )
        )

    return ChegadaResponse(
        status="confirmado",
        registro_id=registro.id,
        timestamp=timestamp.isoformat(),
        aluno_nome=resp.aluno.nome,
        responsavel_nome=resp.nome,
    )


@router.get("/registros-hoje")
async def registros_hoje(
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna os check-ins de chegada do dia atual.
    Usado pelo painel do porteiro para monitorar chegadas em tempo real.
    """
    from datetime import date
    from sqlalchemy import func

    result = await db.execute(
        select(models.RegistroChegada)
        .options(
            selectinload(models.RegistroChegada.responsavel),
            selectinload(models.RegistroChegada.aluno),
        )
        .where(
            func.date(models.RegistroChegada.timestamp) == date.today()
        )
        .order_by(models.RegistroChegada.timestamp.desc())
    )
    registros = result.scalars().all()

    return [
        {
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "hora": r.timestamp.strftime("%H:%M"),
            "responsavel": {"nome": r.responsavel.nome, "parentesco": r.responsavel.parentesco},
            "aluno": {"nome": r.aluno.nome, "turma": r.aluno.turma},
            "face_match": r.face_match,
            "face_confidence": r.face_confidence,
        }
        for r in registros
    ]
