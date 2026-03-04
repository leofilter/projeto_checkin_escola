# 🛠️ Guia Técnico - Sistema de Check-in Escolar

## 📚 Índice
1. [Configuração do Ambiente](#configuração-do-ambiente)
2. [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
3. [Autenticação e Autorização](#autenticação-e-autorização)
4. [Serviços de Negócio](#serviços-de-negócio)
5. [Reconhecimento Facial](#reconhecimento-facial)
6. [Endpoints da API](#endpoints-da-api)
7. [Frontend - Páginas Principais](#frontend---páginas-principais)
8. [Tratamento de Erros](#tratamento-de-erros)
9. [Performance e Otimizações](#performance-e-otimizações)
10. [Troubleshooting](#troubleshooting)

---

## Configuração do Ambiente

### Pré-requisitos
- Python 3.10+
- Node.js 18+
- Git

### Backend Setup

```bash
# 1. Criar ambiente virtual
python -m venv venv

# 2. Ativar ambiente
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 3. Instalar dependências
cd backend
pip install -r requirements.txt

# 4. Criar arquivo .env
cp .env.example .env
# Editar .env com suas configurações

# 5. Executar migrations
python migrate_v2.py

# 6. Iniciar servidor
python -m uvicorn main:app --reload
```

### Frontend Setup

```bash
# 1. Instalar dependências
cd frontend
npm install

# 2. Executar desenvolvimento
npm run dev

# 3. Build para produção
npm run build
```

---

## Estrutura do Banco de Dados

### Diagrama ER

```
┌──────────────┐         ┌───────────────┐
│   usuarios   │         │    alunos     │
├──────────────┤         ├───────────────┤
│ id (PK)      │<────┐   │ id (PK)       │
│ email        │     └───│ usuario_pai_id│
│ senha_hash   │         │ nome          │
│ nome         │         │ turma         │
│ role         │         │ data_nascim.  │
│ ativo        │         └───┬───────────┘
│ criado_em    │             │ (1:M)
└──────────────┘             │
                    ┌────────┴────────┐
                    │                 │
            ┌───────▼─────────┐   ┌──▼──────────────┐
            │  responsaveis   │   │ autorizacoes    │
            ├─────────────────┤   ├─────────────────┤
            │ id (PK)         │   │ id (PK)         │
            │ nome            │   │ aluno_id (FK)   │
            │ cpf             │   │ responsavel_id  │
            │ telefone        │   │ data_autoriz.   │
            │ parentesco      │   │ data_validade   │
            │ face_encoding   │   │ ativo           │
            │ aluno_id (FK)   │   └─────────────────┘
            └─────────────────┘

            ┌──────────────────────────┐
            │ registros_movimentacao   │
            ├──────────────────────────┤
            │ id (PK)                  │
            │ aluno_id (FK)            │
            │ responsavel_id (FK)      │
            │ tipo_movimentacao        │
            │ data_hora                │
            │ observacoes              │
            │ confirma_facial          │
            └──────────────────────────┘
```

### Índices Implementados
- `usuarios.email` - for rápida autenticação
- `responsaveis.cpf` - para busca de responsável
- `alunos.usuario_pai_id` - para relacionamento pai-filho

---

## Autenticação e Autorização

### Sistema JWT

**Geração de Token:**
```python
# Em auth.py
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```

**Validação de Token:**
```python
def get_current_user(token: str = Depends(oauth2_scheme)):
    tries = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    username = payload.get("sub")
    # Validação ocorre aqui...
```

### Middleware de Autenticação

Decoradores disponíveis:
- `@require_admin` - Apenas administradores
- `@require_porteiro` - Porteiros e admins
- `@get_current_user` - Qualquer usuário autenticado

---

## Serviços de Negócio

### 1. Facial Recognition Service

**Arquivo:** `backend/services/facial_recognition.py`

```python
# Encode do rosto
face_encoding = encode_face(image_path)

# Comparação de rostos
matches = compare_faces(
    known_encoding=stored_encoding,
    face_encoding=captured_encoding,
    tolerance=0.6  # Quanto menor, mais rígido
)

# Distância euclidiana
distance = face_distance(stored_encoding, captured_encoding)
confidence = 1 - distance  # Confiança em porcentagem
```

**Modelos Usados:**
- FaceNet com PyTorch
- Pre-trained model: `facenet-pytorch`
- Detecção: MTCNN (Multi-task Cascaded Convolutional Networks)

**Fluxo:**
1. Foto é capturada via webcam
2. MTCNN detecta rostos na imagem
3. FaceNet extrai embeddings (face_encoding)
4. Compara com encodings armazenados no BD
5. Retorna match (sim/não) e confiança (%)

### 2. QR Code Service

**Arquivo:** `backend/services/qrcode_service.py`

```python
# Gerar QR para responsável
qr = generate_qr_code(cpf_responsavel)

# Dados no QR:
# {
#   "type": "responsavel",
#   "cpf": "123.456.789-00",
#   "timestamp": "2024-03-04T10:30:00"
# }

# Ler QR (Frontend com html5-qrcode)
decoder.decodeContinuously(resultCallback, errorCallback)
```

### 3. Email Service

**Arquivo:** `backend/services/email_service.py`

Envia notificações de:
- Confirmação de chegada
- Solicitação de autorização
- Alertas de segurança

---

## Reconhecimento Facial

### Fluxo Completo

**Enrollment (Cadastro):**
```
1. Admin vai em Responsáveis → Cadastrar Facial
2. Seleciona foto do responsável
3. Sistema detecta rosto com MTCNN
4. Extrai embeddings com FaceNet (512 dimensões)
5. Armazena em Base64 no campo face_encoding
```

**Verificação (Check-in):**
```
1. Responsável tira selfie na portaria
2. Sistema detecta rosto
3. Extrai embeddings
4. Busca responsável por CPF no BD
5. Compara embeddings:
   - Se distance < 0.6 → Match (Confiança > 40%)
   - Se não → Recusa facial, solicita autorização manual
```

**Parâmetros Críticos:**
- `tolerance`: 0.6 (padrão, 0.5 mais rígido, 0.7 mais tolerante)
- `face_distance`: Euclidean distance entre embeddings
- Embeddings: 512-dimensional vector

### Tratamento de Erros
```python
try:
    faces = detector.detect_faces(image)
    if not faces:
        return {"match": False, "reason": "Nenhum rosto detectado"}
    
    if len(faces) > 1:
        return {"match": False, "reason": "Múltiplos rostos detectados"}
        
    encoding = facenet.get_embedding(faces[0])
    # Compara encoding...
except Exception as e:
    logger.error(f"Erro reconhecimento facial: {e}")
    return {"match": False, "reason": "Erro ao processar imagem"}
```

---

## Endpoints da API

### Auth
```
POST /auth/login
  Body: {email, senha}
  Response: {access_token, role, nome, user_id}

POST /auth/logout (não implementado, apenas remover token do cliente)
GET /auth/me
  Response: {id, email, nome, role}
```

### Alunos
```
GET /alunos
  Query: ?usuario_pai_id=123
  Response: [{id, nome, turma, data_nascimento, ...}]

POST /alunos
  Body: {nome, turma, data_nascimento, usuario_pai_id}
  Response: Aluno criado

GET /alunos/{id}
PUT /alunos/{id}
DELETE /alunos/{id}

POST /alunos/{id}/foto
  Body: FormData com arquivo de imagem
  Response: {foto_path}
```

### Responsáveis
```
GET /responsaveis
  Query: ?aluno_id=123
  Response: [{id, nome, cpf, telefone, parentesco, ...}]

POST /responsaveis
  Body: {nome, cpf, telefone, parentesco, aluno_id}
  Response: Responsável criado

PUT /responsaveis/{id}
  Body: {nome, telefone, parentesco}
  Response: Responsável atualizado

DELETE /responsaveis/{id}
  Response: 200 OK

POST /responsaveis/{id}/face-enroll
  Body: FormData com foto do rosto
  Response: {face_encoding}
```

### Check-in
```
POST /checkin
  Body: {aluno_id, responsavel_id, tipo_movimentacao}
  Response: {id, aluno_id, data_hora, ...}

GET /checkin/historico
  Query: ?aluno_id=123&data_inicio=2024-01-01
  Response: [Registros de movimentação]
```

### Chegada (Público)
```
GET /chegada/buscar-por-cpf/{cpf}
  Response: {responsavel_id, nome, parentesco, filhos}

POST /chegada/confirmar
  Body: {responsavel_id, filhos_ids, foto_selfie}
  Response: {sucesso, alunos_confirmados}
```

### Autorizações
```
GET /autorizacoes
  Query: ?aluno_id=123
  Response: [{id, responsavel, data_validade, ativo}]

POST /autorizacoes
  Body: {aluno_id, responsavel_id, data_validade}
  Response: Autorização criada

DELETE /autorizacoes/{id}
```

### Registros
```
GET /registros
  Query: ?aluno_id=123&data_inicio=2024-01-01&tipo=chegada
  Response: [Histórico de movimentações]
```

---

## Frontend - Páginas Principais

### Login.tsx
- Campo email
- Campo senha (masked)
- Botão login
- Redirecionamento baseado em role

### Pages Admin

#### Alunos.tsx
- Tabela com lista de alunos
- Formulário para adicionar novo
- Editar/Deletar
- Upload de foto do aluno

#### Responsaveis.tsx
- Tabela agrupada por CPF
- Modal de edição com:
  - Seleção visual de múltiplos alunos
  - Barra de pesquisa para filtrar alunos
  - Remoção de vínculos com confirmação
  - Cadastro de reconhecimento facial
- Botão de cadastro facial

#### Usuarios.tsx
- CRUD de usuários do sistema
- Atribuição de roles

### Pages Pai

#### Dashboard.tsx
- Card com créditos de autorizações
- Últimas movimentações do filho
- Botão para nova autorização

#### NovaAutorizacao.tsx
- Seleção de responsável
- Data de validade
- Confirmar autorização

### Pages Portaria

#### Portaria.tsx
- Câmera/Scanner para captura
- Identificação de aluno (foto ou QR)
- Seleção de tipo (chegada/saída)
- Validação de autorização
- Confirmação visual

### Pages Chegada (Público)

#### Chegada.tsx
- Entrada de CPF do responsável
- Seleção visual de filhos (checkboxes)
- Captura de selfie
- Processamento de reconhecimento facial
- Resultado (sucesso/falha)

---

## Tratamento de Erros

### Frontend
```typescript
try {
  const res = await api.post('/endpoint', data);
  // sucesso
} catch (error) {
  if (error.response?.status === 401) {
    // Token expirado, fazer logout
  } else if (error.response?.status === 403) {
    // Sem permissão
  } else if (error.response?.status === 400) {
    // Erro de validação
    setError(error.response.data.detail);
  }
}
```

### Backend
```python
# Validação de entrada
class UserCreate(BaseModel):
    email: EmailStr  # Valida formato de email
    senha: str = Field(..., min_length=6)

# Tratamento de erro
if not usuario:
    raise HTTPException(
        status_code=404,
        detail="Usuário não encontrado"
    )

# Logging
logger.error(f"Erro ao processar: {e}")
```

---

## Performance e Otimizações

### Backend
1. **Índices no BD**: Em campos de busca frequente
2. **Lazy Loading**: Relations carregadas sob demanda
3. **Async/Await**: Operações I/O não bloqueantes
4. **Caching**: Tokens JWT evitam queries desnecessárias
5. **Pagination**: Listagens com limit/offset

### Frontend
1. **Code Splitting**: Routes com lazy loading
2. **Memoization**: React.memo para componentes
3. **State Management**: Localstate em vez de global quando possível
4. **Image Optimization**: Compressão de fotos
5. **Bundle Size**: Tree-shaking de dependências

### Banco de Dados
```python
# ❌ Evitar (N+1 queries)
usuarios = session.query(Usuario).all()
for user in usuarios:
    print(user.alunos)  # Query extra por usuário

# ✅ Usar (eager loading)
usuarios = session.query(Usuario).options(
    joinedload(Usuario.alunos)
).all()
```

---

## Troubleshooting

### Problema: ImportError - facenet_pytorch
**Solução:**
```bash
pip install facenet-pytorch torch torchvision
# Se ainda falhar, baixar pre-trained model manualmente
```

### Problema: Reconhecimento facial não funciona
**Checklist:**
- [ ] Foto tem boa iluminação
- [ ] Rosto é visível e central
- [ ] Formato de imagem suportado (JPG/PNG)
- [ ] Face_encoding foi salvo no BD
- [ ] Tolerance está em 0.6

### Problema: QR Code não escaneia
**Solução:**
```javascript
// Verificar se navegador tem permissão de câmera
if (!navigator.mediaDevices?.getUserMedia) {
  console.error('Câmera não suportada');
}
```

### Problema: Token expirado a cada requisição
**Solução:**
Aumentar `ACCESS_TOKEN_EXPIRE_MINUTES` em .env

### Problema: Erro de CORS
**Solução:**
Verificar `origins` em FastAPI CORS middleware:
```python
allow_origins=["http://localhost:5173", "https://seu-dominio.com"]
```

### Problema: Banco de dados vazio
**Solução:**
```bash
# Rodar migração
python migrate_v2.py

# Seed de dados de teste
python -c "from main import seed_admin; asyncio.run(seed_admin())"
```

---

## 🔗 Referências

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/)
- [FaceNet PyTorch](https://github.com/timesler/facenet-pytorch)
- [JWT.io](https://jwt.io/)

---

**Última Atualização**: Março 2026
