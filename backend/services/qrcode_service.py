import secrets
import qrcode
import io
import base64
from datetime import datetime, time, date


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
