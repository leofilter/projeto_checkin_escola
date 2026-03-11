from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./escola.db"
    SECRET_KEY: str = "dev-secret-key-troque-em-producao"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@escola.com.br"

    MEDIA_DIR: str = "./media"
    FRONTEND_URL: str = "http://localhost:5173"

    # Chave Fernet (AES-128-CBC) para criptografia reversível do CPF (LGPD).
    # Gere com: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # e adicione ao .env: CPF_ENCRYPTION_KEY=<chave gerada>
    CPF_ENCRYPTION_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()

MEDIA_PATH = Path(settings.MEDIA_DIR)
FOTOS_PATH = MEDIA_PATH / "fotos"
FOTOS_PATH.mkdir(parents=True, exist_ok=True)
