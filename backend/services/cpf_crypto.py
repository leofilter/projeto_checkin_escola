"""
Utilitários de criptografia para CPF (LGPD art. 46).

- cpf_to_hash : SHA-256 do CPF formatado → índice de busca no banco (irreversível)
- cpf_encrypt : Fernet AES-128-CBC → armazena dado criptografado (reversível com a chave)
- cpf_decrypt : descriptografa o token Fernet → CPF original

A chave Fernet deve estar em CPF_ENCRYPTION_KEY no .env.
"""
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from config import settings


def _get_fernet() -> Fernet:
    key = settings.CPF_ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "CPF_ENCRYPTION_KEY não configurada. "
            "Gere com: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\" "
            "e adicione ao .env"
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def cpf_to_hash(cpf: str) -> str:
    """SHA-256 do CPF formatado (ex: '123.456.789-00'). Usado como índice de busca."""
    return hashlib.sha256(cpf.encode()).hexdigest()


def cpf_encrypt(cpf: str) -> str:
    """Criptografa CPF com Fernet. Retorna token base64url."""
    return _get_fernet().encrypt(cpf.encode()).decode()


def cpf_decrypt(token: str) -> str:
    """Descriptografa token Fernet → CPF original. Lança InvalidToken se a chave for inválida."""
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return ""
