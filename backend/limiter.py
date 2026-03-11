"""
Instância global do rate limiter (slowapi).
Importado por main.py e pelas rotas que precisam aplicar limites.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
