from datetime import datetime, date, time
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, computed_field, Field, model_validator
import re
import hashlib


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
        if v not in ("admin", "porteiro"):
            raise ValueError("role deve ser admin ou porteiro")
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
    cpf: Optional[str] = None
    responsavel_principal_id: Optional[int] = None  # alternativa ao CPF p/ vincular aluno adicional
    telefone: Optional[str] = None
    parentesco: str
    aluno_id: int

    @model_validator(mode="after")
    def cpf_ou_id_obrigatorio(self) -> "ResponsavelCreate":
        if not self.cpf and not self.responsavel_principal_id:
            raise ValueError("Informe o CPF ou o ID de um responsável existente")
        return self

    @field_validator("cpf", mode="before")
    @classmethod
    def validate_cpf(cls, v) -> Optional[str]:
        if v is None:
            return None
        cleaned = re.sub(r"\D", "", str(v))
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
    cpf_enc: str = Field(exclude=True)  # ciphertext Fernet, nunca retornado na API
    cpf_hash: str  # SHA-256, retornado para agrupamento no frontend
    telefone: Optional[str]
    parentesco: str
    foto_path: Optional[str]
    face_encoding: Optional[str]
    aluno_id: int
    ativo: bool

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def cpf_mascarado(self) -> str:
        """Descriptografa internamente e exibe apenas os dígitos centrais: ***.456.789-**"""
        from services.cpf_crypto import cpf_decrypt
        cpf = cpf_decrypt(self.cpf_enc) if self.cpf_enc else ""
        if len(cpf) >= 13:  # "123.456.789-00" tem 14 chars
            return f"***.{cpf[4:11]}-**"
        return "***.***.***-**"


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
