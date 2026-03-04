# 📐 Arquitetura do Sistema de Check-in Escolar

## 📋 Visão Geral

Sistema completo de gerenciamento de entrada/saída de alunos em escolas com suporte a reconhecimento facial, QR Code e autorizações de responsáveis.

---

## 🏗️ Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)             │
│  Vite | TailwindCSS | Lucide Icons | Axios API Client      │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP REST API
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (FastAPI + Python)                      │
│  SQLAlchemy ORM | Alembic Migrations | JWT Auth             │
│                                                               │
│  ├── Routes (Endpoints)                                     │
│  ├── Services (Lógica de Negócio)                           │
│  ├── Models (Banco de Dados)                                │
│  └── Auth (Segurança)                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              DATABASE (SQLite/PostgreSQL)                    │
│  Tabelas: Usuários, Alunos, Responsáveis,                   │
│  Autorizações, Registros de Check-in                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧩 Componentes Principais

### 1. **Backend (Python/FastAPI)**

#### Estrutura de Pasta
```
backend/
├── main.py                 # Entrada da aplicação
├── config.py              # Configurações de ambiente
├── database.py            # Conexão com BD
├── models.py              # Modelos SQLAlchemy
├── schemas.py             # Schemas Pydantic
├── auth.py                # Autenticação JWT
├── migrate_v2.py          # Migração de dados
│
├── routes/                # Endpoints da API
│   ├── auth.py           # Login/Logout/Tokens
│   ├── alunos.py         # CRUD de Alunos
│   ├── responsaveis.py   # CRUD de Responsáveis
│   ├── autorizacoes.py   # Gerenciamento de Autorizações
│   ├── checkin.py        # Check-in interno (admin)
│   ├── chegada.py        # Check-in público (responsáveis)
│   └── registros.py      # Histórico de movimentações
│
└── services/              # Lógica de Negócio
    ├── facial_recognition.py  # IA de Reconhecimento Facial
    ├── qrcode_service.py      # Geração de QR Codes
    └── email_service.py       # Envio de Emails
```

#### Rotas Principais

| Route | Método | Descrição |
|-------|--------|-----------|
| `/auth/login` | POST | Autenticação de usuários |
| `/alunos` | GET/POST | CRUD de alunos |
| `/responsaveis` | GET/POST/PUT/DELETE | CRUD de responsáveis |
| `/autorizacoes` | GET/POST | Gerenciar autorizações |
| `/checkin` | POST | Check-in administrativo |
| `/chegada/buscar-por-cpf` | GET | Busca pública de responsável |
| `/chegada/confirmar` | POST | Confirmação de chegada |
| `/registros` | GET | Histórico de movimentações |

### 2. **Frontend (React + TypeScript)**

#### Estrutura de Pasta
```
frontend/src/
├── main.tsx              # Entrada da aplicação
├── App.tsx              # Componente raiz
│
├── components/          # Componentes reutilizáveis
│   └── Layout.tsx      # Layout padrão
│
├── contexts/           # Context API
│   └── AuthContext.tsx # Gerenciamento de autenticação
│
├── services/           # Integração com API
│   └── api.ts          # Cliente Axios configurado
│
└── pages/              # Páginas da aplicação
    ├── Login.tsx                      # Página de login
    ├── Registros.tsx                  # Histórico de movimentações
    ├── admin/
    │   ├── Alunos.tsx                 # Gerenciamento de alunos
    │   ├── Responsaveis.tsx           # Gerenciamento de responsáveis
    │   └── Usuarios.tsx               # Gerenciamento de usuários
    ├── chegada/
    │   └── Chegada.tsx               # Check-in público (responsáveis)
    ├── pais/
    │   ├── Dashboard.tsx             # Dashboard do responsável
    │   └── NovaAutorizacao.tsx       # Criar autorização
    └── portaria/
        └── Portaria.tsx              # Check-in administrativo
```

---

## 🗄️ Modelo de Dados

### Tabelas Principais

#### **usuarios**
```sql
id (PK)
email (UNIQUE)
senha_hash
nome
role (admin | pai | porteiro)
ativo
criado_em
```

#### **alunos**
```sql
id (PK)
nome
turma
data_nascimento
foto_path
usuario_pai_id (FK → usuarios)
ativo
criado_em
```

#### **responsaveis**
```sql
id (PK)
nome
cpf
telefone
parentesco (Pai, Mãe, Avô, Avó, Tio, etc)
foto_path
face_encoding (Para reconhecimento facial)
aluno_id (FK → alunos)
ativo
criado_em
```

#### **autorizacoes**
```sql
id (PK)
aluno_id (FK → alunos)
responsavel_id (FK → responsaveis)
data_autorizacao
data_validade
ativo
```

#### **registros_movimentacao**
```sql
id (PK)
aluno_id (FK → alunos)
responsavel_id (FK → responsaveis)
tipo_movimentacao (chegada | saida)
data_hora
observacoes
confirma_facial (boolean)
ativo
```

---

## 🔐 Sistema de Autenticação

### Flow de Login
```
1. Usuário entra email/senha
2. Sistema valida credenciais no BD
3. Se válido, gera JWT Token com:
   - user_id
   - email
   - role (admin/pai/porteiro)
   - exp (expiração)
4. Token é armazenado localmente (localStorage)
5. Token é enviado em cada requisição (header Authorization)
6. Backend valida token em endpoints protegidos
```

### Roles (Papéis)
- **admin**: Acesso total ao sistema
- **porteiro**: Pode fazer check-in/saída de alunos
- **pai**: Pode autorizar responsáveis e visualizar movimentações

---

## 🤖 Tecnologias Principais

### Backend
- **FastAPI**: Framework web rápido e moderno
- **SQLAlchemy**: ORM para banco de dados
- **Pydantic**: Validação de dados
- **Python-jose**: Geração de JWT
- **Facenet-pytorch**: Reconhecimento facial com IA
- **qrcode**: Geração de QR Codes
- **Pillow**: Processamento de imagens
- **OpenCV**: Processamento de vídeo

### Frontend
- **React 19**: UI interativa
- **TypeScript**: Tipagem estática
- **Vite**: Build tool rápido
- **TailwindCSS**: Estilos utilitários
- **Axios**: Cliente HTTP
- **html5-qrcode**: Scanner de QR Code
- **Lucide Icons**: Ícones SVG

### Banco de Dados
- **SQLite**: Desenvolvimento
- **PostgreSQL**: Produção (opcional)
- **Alembic**: Gerenciamento de migrations

---

## 🔄 Fluxos Principais

### 1️⃣ Check-in de Chegada (Público)
```
Responsável na portaria
    ↓
Escaneia QR Code
    ↓
Digita CPF
    ↓
Seleciona qual(is) filho(s) está trazendo
    ↓
Tira selfie (foto do rosto)
    ↓
Sistema verifica reconhecimento facial
    ↓
Se OK → Registra chegada
Se FALHA → Alerta para validação manual
```

### 2️⃣ Check-in de Saída (Admin/Porteiro)
```
Admin/Porteiro acessa sistema
    ↓
Vai para seção de Check-in
    ↓
Coloca foto do aluno OU escaneia QR
    ↓
Sistema identifica o aluno
    ↓
Valida se tem autorização de saída
    ↓
Registra saída com timestamp
```

### 3️⃣ Gerenciamento de Responsáveis
```
Admin acessa "Responsáveis"
    ↓
Pode realizar ações:
  ├── Adicionar novo responsável
  ├── Vincular múltiplos alunos
  ├── Remover vínculo com alunos
  ├── Editar dados (nome, telefone, parentesco)
  └── Cadastrar reconhecimento facial
```

---

## 🔄 Integração Sistema (API REST)

Todos os endpoints retornam JSON:

```json
{
  "data": {...},
  "message": "Sucesso",
  "status": 200
}
```

### Headers Necessários
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## 🚀 Deploy

### Desenvolvimento
```bash
# Backend
cd backend
python -m uvicorn main:app --reload

# Frontend
cd frontend
npm run dev
```

### Produção
```bash
# Build Frontend
npm run build

# Servir com Gunicorn (Backend)
gunicorn -w 4 -b 0.0.0.0:8000 main:app
```

---

## 📊 Fluxo de Dados

```
Frontend → HTTP Request (Axios)
           ↓
Backend  → Valida JWT
           ↓
           → Valida dados (Pydantic)
           ↓
           → Processa lógica
           ↓
           → Interage com BD (SQLAlchemy)
           ↓
           → Retorna JSON
           ↓
Frontend → Processa resposta
           ↓
           → Atualiza UI (React)
           ↓
           → Exibe resultado para usuário
```

---

## 🎯 Features Implementadas

✅ Autenticação JWT com múltiplos papéis
✅ CRUD completo de alunos e responsáveis
✅ Reconhecimento facial com Facenet
✅ Geração e leitura de QR Codes
✅ Sistema de autorizações para saída
✅ Histórico completo de movimentações
✅ Interface responsiva (mobile-friendly)
✅ Validação de dados em frontend e backend
✅ Suporte a múltiplos responsáveis por aluno
✅ Associação de múltiplos alunos por responsável

---

## 🔧 Variáveis de Ambiente

Criar arquivo `.env` na raiz do backend:

```env
DATABASE_URL=sqlite:///./escola.db
SECRET_KEY=sua_chave_secreta_super_segura
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=seu_email@gmail.com
SMTP_PASSWORD=sua_senha
```

---

## 📈 Escalabilidade

Para crescer a produção:

1. **Banco de Dados**: Migrar para PostgreSQL
2. **Storage**: Usar AWS S3 ou similar para fotos
3. **Cache**: Implementar Redis para tokens
4. **CDN**: Servir assets estáticos via CDN
5. **Load Balancer**: Distribuir requisições entre servidores
6. **Containers**: Usar Docker para deploy consistente

---

## 🐛 Tratamento de Erros

Sistema implementa tratamento de erros em:

```
Frontend: Try/Catch + Axios interceptors
Backend: HTTPException com status codes apropriados
Validação: Pydantic para entrada, SQLAlchemy constraints
Logs: Registrados para debug
```

---

## 📝 Documentação API

Interativa em: `http://localhost:8000/docs` (Swagger UI)

---

## ✨ Melhorias Recentes

- ✅ Sistema de adicionar múltiplos alunos por responsável (com seleção visual)
- ✅ Barra de pesquisa para filtrar alunos durante edição
- ✅ Interface visual aprimorada para seleção de alunos
- ✅ Remoção simplificada de vínculos com feedback visual

---

**Last Updated**: Março 2026
