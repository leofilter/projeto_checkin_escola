# 🔐 Sistema de Check-in Escolar

Sistema de liberação segura de crianças na escola com reconhecimento facial e QR Code.

---

## 🚀 Como Iniciar

### Windows (forma rápida)
```
Clique duas vezes em: start.bat
```

### Manual

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🌐 Endereços

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API Backend | http://localhost:8000 |
| Documentação API | http://localhost:8000/docs |

---

## 🔑 Login Padrão (Admin)

```
E-mail: admin@escola.com
Senha:  admin123
```

> **IMPORTANTE:** Troque a senha após o primeiro acesso!

---

## 👥 Perfis de Usuário

| Perfil | Acesso |
|--------|--------|
| **Admin** | Cadastra alunos, responsáveis e usuários |
| **Pai/Mãe** | Cria autorizações diárias e gera QR Code |
| **Porteiro** | Valida QR Code e faz reconhecimento facial na portaria |

---

## 📋 Fluxo de Uso

### 1. Configuração Inicial (Admin)
1. Acesse `/admin/usuarios` → crie contas para pais e porteiros
2. Acesse `/admin/alunos` → cadastre os alunos
3. Acesse `/admin/responsaveis` → cadastre os responsáveis vinculados a cada aluno
4. Para cada responsável, clique no ícone de câmera → envie uma foto para cadastrar o reconhecimento facial

### 2. No dia da retirada (Pai/Mãe)
1. Acesse `/pais/dashboard` → clique em **Nova Autorização**
2. Selecione: aluno, quem vai buscar, data e horário
3. Sistema gera um **QR Code** válido para o dia
4. Envie o QR Code para o responsável (print ou WhatsApp)

### 3. Na portaria (Porteiro)
1. Acesse `/portaria`
2. Clique em **Escanear QR Code**
3. Sistema valida e exibe foto + dados do responsável
4. Clique em **Verificar Reconhecimento Facial** → câmera abre automaticamente
5. Posicione o rosto do responsável → sistema compara com a foto cadastrada
6. **Confirmar** → criança liberada, pais notificados por e-mail

---

## 🔒 Segurança

- **QR Code único**: gerado com 256 bits de entropia, válido apenas no dia
- **Anti-replay**: QR Code marcado como usado após primeira utilização
- **Reconhecimento facial**: FaceNet (PyTorch) com similaridade ≥ 70%
- **Log de auditoria**: cada entrega registrada com timestamp, porteiro, resultado facial e IP
- **Override manual**: porteiro pode confirmar sem facial, mas deve registrar observação
- **JWT**: tokens de 8h com roles (admin/pai/porteiro)

---

## 📧 Configurar E-mail (opcional)

Crie o arquivo `backend/.env` a partir de `backend/.env.example`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu@gmail.com
SMTP_PASSWORD=sua-senha-de-app
EMAIL_FROM=portaria@escola.com.br
```

> Para Gmail, use uma **Senha de App** (não a senha normal).
> Acesse: https://myaccount.google.com/apppasswords

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.11 + FastAPI |
| Banco de dados | SQLite (dev) / PostgreSQL (prod) |
| Reconhecimento facial | FaceNet via facenet-pytorch (PyTorch) |
| QR Code | qrcode[pil] |
| Frontend | React + TypeScript + Vite |
| Estilo | Tailwind CSS v4 |
| Autenticação | JWT (python-jose) |

---

## 🗄️ Migrar para PostgreSQL (Produção)

No arquivo `backend/.env`:
```env
DATABASE_URL=postgresql+asyncpg://usuario:senha@localhost/escola_checkin
```

Instale o driver:
```bash
pip install asyncpg
```
