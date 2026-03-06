import secrets
from datetime import datetime, time, date


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def calculate_expiry(data_autorizacao: date) -> datetime:
    """Token expira às 23:59:59 do dia da autorização."""
    return datetime.combine(data_autorizacao, time(23, 59, 59))
