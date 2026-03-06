import secrets
import qrcode
import io
import base64
import hmac
import hashlib
import time as _time
from datetime import datetime, time, date

CHEGADA_BASE_URL = "https://projeto-checkin-escola.vercel.app/chegada"
_WINDOW_SECONDS = 6 * 3600  # 6 hours


def get_current_window() -> int:
    """Returns the current 6-hour window index (UTC)."""
    return int(_time.time()) // _WINDOW_SECONDS


def generate_window_token(secret: str) -> str:
    """Generates a short HMAC token tied to the current 6-hour window."""
    window = get_current_window()
    return hmac.new(secret.encode(), str(window).encode(), hashlib.sha256).hexdigest()[:16]


def validate_window_token(token: str, secret: str) -> bool:
    """Accepts tokens from the current or previous window (grace period)."""
    current = get_current_window()
    for window in [current, current - 1]:
        expected = hmac.new(secret.encode(), str(window).encode(), hashlib.sha256).hexdigest()[:16]
        if hmac.compare_digest(token, expected):
            return True
    return False


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def generate_qr_image(token: str, frontend_url: str) -> str:
    """Retorna PNG base64 do QR Code."""
    url = f"{frontend_url}/portaria/scan/{token}"

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def calculate_expiry(data_autorizacao: date) -> datetime:
    """Token expira às 23:59:59 do dia da autorização."""
    return datetime.combine(data_autorizacao, time(23, 59, 59))
