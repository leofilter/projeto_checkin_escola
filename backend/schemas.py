from datetime import datetime, date, time
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
import re


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginForm(BaseModel):
    email: EmailStr
    senha: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    nome: str
    user_id: int


# ─── Usuário ─────────────────────────────────────────────────────────────────

class UsuarioCreate(BaseModel):
    email: EmailStr
    senha: str
    nome: str
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("admin", "colaborador", "porteiro"):
            raise ValueError("role deve ser admin, pai ou porteiro")
        return v


class UsuarioResponse(BaseModel):
    id: int
    email: str
    nome: str
    role: str
    ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


# ─── Aluno ───────────────────────────────────────────────────────────────────

class AlunoCreate(BaseModel):
    nome: str
    turma: str
    data_nascimento: Optional[date] = None
    usuario_pai_id: Optional[int] = None


class AlunoUpdate(BaseModel):
    nome: Optional[str] = None
    turma: Optional[str] = None
    data_nascimento: Optional[date] = None
    usuario_pai_id: Optional[int] = None


class AlunoResponse(BaseModel):
    id: int
    nome: str
    turma: str
    data_nascimento: Optional[date]
    foto_path: Optional[str]
    usuario_pai_id: Optional[int]
    ativo: bool

    model_config = {"from_attributes": True}


# ─── Responsável ─────────────────────────────────────────────────────────────

class ResponsavelCreate(BaseModel):
    nome: str
    cpf: str
    telefone: Optional[str] = None
    parentesco: str
    aluno_id: int

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, v: str) -> str:
        cleaned = re.sub(r"\D", "", v)
        if len(cleaned) != 11:
            raise ValueError("CPF inválido")
        return f"{cleaned[:3]}.{cleaned[3:6]}.{cleaned[6:9]}-{cleaned[9:]}"


class ResponsavelUpdate(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    parentesco: Optional[str] = None


class ResponsavelResponse(BaseModel):
    id: int
    nome: str
    cpf: str
    telefone: Optional[str]
    parentesco: str
    foto_path: Optional[str]
    face_encoding: Optional[str]
    aluno_id: int
    ativo: bool

    model_config = {"from_attributes": True}


class ResponsavelComAlunoResponse(ResponsavelResponse):
    aluno: AlunoResponse


# ─── Autorização ─────────────────────────────────────────────────────────────

class AutorizacaoCreate(BaseModel):
    aluno_id: int
    responsavel_id: int
    data_autorizacao: date
    hora_prevista: Optional[time] = None


class AutorizacaoResponse(BaseModel):
    id: int
    aluno_id: int
    responsavel_id: int
    data_autorizacao: date
    hora_prevista: Optional[time]
    usado: bool
    cancelado: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


class AutorizacaoDetalhadaResponse(BaseModel):
    id: int
    data_autorizacao: date
    hora_prevista: Optional[time]
    usado: bool
    cancelado: bool
    aluno: AlunoResponse
    responsavel: ResponsavelResponse

    model_config = {"from_attributes": True}


# ─── Registro de Entrega ──────────────────────────────────────────────────────

class RegistroResponse(BaseModel):
    id: int
    timestamp: datetime
    face_match: bool
    face_confidence: Optional[float]
    observacao: Optional[str]
    ip_origem: Optional[str]
    autorizacao: AutorizacaoDetalhadaResponse
    porteiro: UsuarioResponse

    model_config = {"from_attributes": True}
