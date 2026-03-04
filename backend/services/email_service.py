import asyncio
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import aiosmtplib
from config import settings


async def notify_pickup(
    pai_email: str,
    aluno_nome: str,
    responsavel_nome: str,
    responsavel_parentesco: str,
    timestamp: datetime,
) -> None:
    if not settings.SMTP_USER:
        # Email não configurado — apenas loga
        print(
            f"[EMAIL] {aluno_nome} retirado às {timestamp.strftime('%H:%M')} "
            f"por {responsavel_nome} ({responsavel_parentesco}). "
            f"Destinatário: {pai_email}"
        )
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = f"✅ Retirada confirmada — {aluno_nome}"
    message["From"] = settings.EMAIL_FROM
    message["To"] = pai_email

    hora = timestamp.strftime("%H:%M")
    data = timestamp.strftime("%d/%m/%Y")

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #16a34a;">✅ Retirada Confirmada</h2>
      <p>
        Seu(sua) filho(a) <strong>{aluno_nome}</strong> foi retirado(a) com segurança.
      </p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; color: #6b7280;">Responsável</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>{responsavel_nome}</strong> ({responsavel_parentesco})</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; color: #6b7280;">Horário</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>{hora}</strong> de {data}</td>
        </tr>
      </table>
      <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
        Este é um e-mail automático do sistema de portaria escolar.
      </p>
    </div>
    """

    message.attach(MIMEText(html, "html"))

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=True,
        )
    except Exception as e:
        print(f"[EMAIL ERROR] Falha ao enviar notificação: {e}")
