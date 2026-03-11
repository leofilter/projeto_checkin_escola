"""
Audit trail LGPD (art. 37 e 46).

Registra em JSON toda operação que envolve dados pessoais (CPF).
O log é gravado em logs/lgpd_audit.log — nunca contém o CPF real,
apenas o prefixo do hash (suficiente para rastreabilidade interna).

Campos de cada entrada:
  ts         — timestamp ISO-8601 UTC
  acao       — consulta_cpf | listagem | acesso | criacao | edicao | exclusao
  ip         — IP de origem (pode ser 127.0.0.1 em ambiente local)
  usuario_id — ID do usuário autenticado, ou "publico"
  cpf_hash8  — primeiros 8 hex do SHA-256 do CPF (identifica sem expor)
  resultado  — encontrado | nao_encontrado | ok | erro
  detalhe    — informação complementar opcional
"""
import json
import logging
import logging.handlers
from datetime import datetime, timezone
from pathlib import Path

_LOG_DIR = Path(__file__).parent.parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)

_handler = logging.handlers.RotatingFileHandler(
    _LOG_DIR / "lgpd_audit.log",
    maxBytes=10 * 1024 * 1024,  # 10 MB por arquivo
    backupCount=12,              # mantém 12 arquivos (~120 MB, ~1 ano)
    encoding="utf-8",
)
_handler.setFormatter(logging.Formatter("%(message)s"))

_logger = logging.getLogger("lgpd.audit")
_logger.setLevel(logging.INFO)
_logger.addHandler(_handler)
_logger.propagate = False  # não polui o log geral da aplicação


def _entry(
    acao: str,
    ip: str,
    usuario_id: str | int,
    resultado: str,
    cpf_hash: str | None = None,
    detalhe: str | None = None,
) -> None:
    record: dict = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "acao": acao,
        "ip": ip,
        "usuario_id": str(usuario_id),
        "resultado": resultado,
    }
    if cpf_hash:
        record["cpf_hash8"] = cpf_hash[:8]  # prefixo — rastreável, mas não o dado completo
    if detalhe:
        record["detalhe"] = detalhe
    _logger.info(json.dumps(record, ensure_ascii=False))


# ── Funções públicas ───────────────────────────────────────────────────────────

def log_consulta_cpf(ip: str, cpf_hash: str, encontrado: bool) -> None:
    """Rota pública: pai buscou CPF na portaria."""
    _entry(
        acao="consulta_cpf",
        ip=ip,
        usuario_id="publico",
        cpf_hash=cpf_hash,
        resultado="encontrado" if encontrado else "nao_encontrado",
    )


def log_listagem(ip: str, usuario_id: int, recurso: str) -> None:
    """Admin listou registros com dados pessoais."""
    _entry(acao="listagem", ip=ip, usuario_id=usuario_id, resultado="ok", detalhe=recurso)


def log_acesso(ip: str, usuario_id: int, recurso: str, recurso_id: int) -> None:
    """Admin acessou registro específico com dados pessoais."""
    _entry(
        acao="acesso",
        ip=ip,
        usuario_id=usuario_id,
        resultado="ok",
        detalhe=f"{recurso}#{recurso_id}",
    )


def log_criacao(ip: str, usuario_id: int, recurso: str, cpf_hash: str) -> None:
    """Admin cadastrou novo responsável (dado pessoal criado)."""
    _entry(acao="criacao", ip=ip, usuario_id=usuario_id, cpf_hash=cpf_hash, resultado="ok", detalhe=recurso)


def log_edicao(ip: str, usuario_id: int, recurso: str, recurso_id: int) -> None:
    """Admin editou dados pessoais de um responsável."""
    _entry(
        acao="edicao",
        ip=ip,
        usuario_id=usuario_id,
        resultado="ok",
        detalhe=f"{recurso}#{recurso_id}",
    )


def log_exclusao(ip: str, usuario_id: int, recurso: str, recurso_id: int) -> None:
    """Admin desativou/excluiu registro com dados pessoais."""
    _entry(
        acao="exclusao",
        ip=ip,
        usuario_id=usuario_id,
        resultado="ok",
        detalhe=f"{recurso}#{recurso_id}",
    )
