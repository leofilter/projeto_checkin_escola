# CLAUDE.md — Sistema de Check-in Escolar

## Fluxo obrigatório para TODA solicitação de melhoria

**REGRA PRINCIPAL**: Quando o usuário pedir qualquer melhoria, mudança ou nova feature, SEMPRE executar os 4 agentes em paralelo para análise coordenada. Nenhum agente trabalha isolado — todos analisam o impacto da mudança na sua área.

### Ordem de execução

1. **Fase 1 — Análise paralela** (rodar os 4 agentes ao mesmo tempo):
   - **Arquiteto**: analisa o impacto da mudança no sistema, define se precisa de migration, novos endpoints, novos componentes. Produz o plano de execução.
   - **Segurança**: avalia se a mudança introduz riscos (exposição de dados, falha de auth, LGPD). Produz restrições obrigatórias.
   - **Backend**: analisa o código atual do backend, identifica o que precisa mudar (models, schemas, routes, services). Verifica compatibilidade com o banco de dados e contratos de API existentes.
   - **Frontend**: analisa o código atual do frontend, identifica o que precisa mudar (pages, components, services/api.ts). Verifica se os endpoints que vai consumir existem ou precisam ser criados.

2. **Fase 2 — Implementação coordenada** (sequencial, respeitando dependências):
   - Se há mudança no banco: Backend implementa migration + models primeiro
   - Se há novo endpoint: Backend implementa route + schema primeiro
   - Frontend implementa depois, consumindo os endpoints reais
   - Segurança revisa o código final

### O que cada agente DEVE verificar em toda mudança

| Agente | Verificação obrigatória |
|--------|------------------------|
| **Arquiteto** | Schema do banco coerente? Migration necessária? Contrato de API definido? Separação de camadas respeitada? |
| **Backend** | Models.py atualizado? Schemas.py com tipagem correta? Route retorna o formato que o frontend espera? Services com lógica isolada? |
| **Frontend** | Chamada em api.ts usa o endpoint correto? Interface TypeScript bate com o schema do backend? Estado gerenciado corretamente? UI responsiva? |
| **Segurança** | Endpoint tem verificação de role? Dados sensíveis protegidos? Input validado? Logs sem dados sensíveis? |

### Contrato de comunicação Backend ↔ Frontend

Toda response da API segue este formato — NUNCA mudar sem atualizar ambos os lados:
```json
{
  "data": { ... },
  "message": "string",
  "status": 200
}
```

Headers obrigatórios:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

Campos que NUNCA devem aparecer em responses da API:
- `senha_hash`
- `face_encoding` (completo)
- JWT `SECRET_KEY`

---

## Agentes disponíveis

| Agente | Arquivo | Especialidade |
|--------|---------|---------------|
| **Backend** | `.claude/agents/backend.md` | Python, FastAPI, SQLAlchemy async, facenet-pytorch, Pydantic |
| **Frontend** | `.claude/agents/frontend.md` | React 19, TypeScript, Tailwind v4, Vite, html5-qrcode |
| **Arquiteto** | `.claude/agents/architect.md` | Design de sistema, migrations, contratos de API, escalabilidade |
| **Segurança** | `.claude/agents/security.md` | OWASP Top 10, LGPD, proteção de menores, auditoria de código |

---

## Comandos rápidos
- Iniciar projeto: `start.bat` (raiz)
- Backend: `cd backend && python -m uvicorn main:app --reload --port 8000`
- Frontend: `cd frontend && npm run dev`
- API docs: http://localhost:8000/docs
- Login admin: admin@escola.com / admin123

## Regras invioláveis do projeto
- bcrypt DEVE ser versão 4.0.1 (incompatível com passlib na v5+)
- NÃO usar face_recognition/dlib (não compila no Windows)
- NÃO usar deepface/TensorFlow (Long Paths no Windows)
- Tailwind CSS v4: usa `@import "tailwindcss"`, NÃO usa tailwind.config.js
- Toda operação de banco DEVE ser async (AsyncSession)
- Face encoding armazenado como JSON TEXT no SQLite (~2KB)
- QR token via `secrets.token_urlsafe(32)`, expira 23:59:59 do dia
