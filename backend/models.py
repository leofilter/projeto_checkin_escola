from datetime import datetime, date, time
from sqlalchemy import (
    Integer, String, Boolean, DateTime, Date, Time,
    Float, Text, ForeignKey, Enum, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("admin", "pai", "porteiro", name="user_role"), nullable=False
    )
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    alunos: Mapped[list["Aluno"]] = relationship("Aluno", back_populates="pai")


class Aluno(Base):
    __tablename__ = "alunos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    turma: Mapped[str] = mapped_column(String(50), nullable=False)
    data_nascimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    foto_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    usuario_pai_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("usuarios.id"), nullable=True
    )
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    pai: Mapped["Usuario | None"] = relationship("Usuario", back_populates="alunos")
    responsaveis: Mapped[list["Responsavel"]] = relationship(
        "Responsavel", back_populates="aluno"
    )
    autorizacoes: Mapped[list["Autorizacao"]] = relationship(
        "Autorizacao", back_populates="aluno"
    )


class Responsavel(Base):
    __tablename__ = "responsaveis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    cpf: Mapped[str] = mapped_column(String(14), nullable=False, index=True)
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    parentesco: Mapped[str] = mapped_column(String(50), nullable=False)
    foto_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    face_encoding: Mapped[str | None] = mapped_column(Text, nullable=True)
    aluno_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("alunos.id"), nullable=False
    )
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    aluno: Mapped["Aluno"] = relationship("Aluno", back_populates="responsaveis")
    autorizacoes: Mapped[list["Autorizacao"]] = relationship(
        "Autorizacao", back_populates="responsavel"
    )


class Autorizacao(Base):
    __tablename__ = "autorizacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    aluno_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("alunos.id"), nullable=False
    )
    responsavel_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("responsaveis.id"), nullable=False
    )
    data_autorizacao: Mapped[date] = mapped_column(Date, nullable=False)
    hora_prevista: Mapped[time | None] = mapped_column(Time, nullable=True)
    qrcode_token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    qrcode_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    usado: Mapped[bool] = mapped_column(Boolean, default=False)
    cancelado: Mapped[bool] = mapped_column(Boolean, default=False)
    criado_por: Mapped[int] = mapped_column(
        Integer, ForeignKey("usuarios.id"), nullable=False
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    valido_ate: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    aluno: Mapped["Aluno"] = relationship("Aluno", back_populates="autorizacoes")
    responsavel: Mapped["Responsavel"] = relationship(
        "Responsavel", back_populates="autorizacoes"
    )
    criador: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[criado_por])
    registro: Mapped["RegistroEntrega | None"] = relationship(
        "RegistroEntrega", back_populates="autorizacao", uselist=False
    )


class RegistroEntrega(Base):
    __tablename__ = "registros_entrega"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    autorizacao_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("autorizacoes.id"), nullable=False, unique=True
    )
    porteiro_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("usuarios.id"), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    face_match: Mapped[bool] = mapped_column(Boolean, nullable=False)
    face_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_origem: Mapped[str | None] = mapped_column(String(45), nullable=True)

    autorizacao: Mapped["Autorizacao"] = relationship(
        "Autorizacao", back_populates="registro"
    )
    porteiro: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[porteiro_id])


class RegistroChegada(Base):
    """
    Registra a chegada do responsável na escola via QR Code fixo + selfie facial.
    Diferente de RegistroEntrega (que é o fluxo do porteiro com QR diário),
    este é o auto-check-in feito pelo próprio responsável no celular.
    """
    __tablename__ = "registros_chegada"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    responsavel_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("responsaveis.id"), nullable=False
    )
    aluno_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("alunos.id"), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    face_match: Mapped[bool] = mapped_column(Boolean, nullable=False)
    face_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)

    responsavel: Mapped["Responsavel"] = relationship("Responsavel")
    aluno: Mapped["Aluno"] = relationship("Aluno")
