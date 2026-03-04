# 📝 CHANGELOG

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato baseia-se em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [1.2.0] - 2026-03-04

### ✨ Adicionado
- **Seleção Visual Múltipla de Alunos**: Na edição de responsáveis, agora é possível adicionar múltiplos alunos de uma vez com interface visual intuitiva
- **Barra de Pesquisa de Alunos**: Campo de busca dinâmica na seção "Adicionar alunos" para filtrar por nome em tempo real (case-insensitive)
- **Documentação de Arquitetura**: Arquivo completo [ARCHITECTURE.md](ARCHITECTURE.md) descrevendo toda a estrutura do projeto
- **Guia Técnico Detalhado**: Arquivo [TECHNICALGUIDE.md](TECHNICALGUIDE.md) com instruções de setup, endpoints, serviços e troubleshooting
- **Changelog Oficial**: Este arquivo para rastreamento de versões

### 🔄 Alterado
- **Modal de Edição de Responsáveis**: Refatorado componente "Adicionar alunos" de um dropdown para seleção visual com checkboxes
- **Estado do Responsáveis.tsx**: Adicionado `editAlunosParaAdicionar` e `editSearchAlunos` para melhor rastreamento de múltiplas seleções
- Função `saveEdit()` agora processa múltiplos alunos com `Promise.all()`
- Interface de seleção com feedback visual (borda azul, background destacado)

### ✅ Melhorias
- Experiência de usuário ao gerenciar vínculos de responsáveis agora é equivalente ao fluxo de check-in
- Performance ao adicionar múltiplos alunos (requisições paralelas)
- Validação mantém responsável com pelo menos um aluno vinculado

### 🐛 Corrigido
- Estado de seleção limpo corretamente ao abrir/fechar modal

---

## [1.1.0] - 2026-02-XX

### ✨ Adicionado
- Sistema completo de reconhecimento facial com Facenet-PyTorch
- Cadastro de foto e face_encoding para responsáveis
- Verificação facial durante check-in de chegada
- Sistema de autorizações com data de validade

### 🔄 Alterado
- Estrutura de responsáveis para suportar múltiplos alunos por CPF

---

## [1.0.0] - 2026-01-XX

### ✨ Adicionado
- Sistema base de check-in escolar
- Autenticação JWT com múltiplos papéis (admin, pai, porteiro)
- CRUD completo de:
  - Usuários
  - Alunos
  - Responsáveis
  - Autorizações
  - Registros de movimentação
- Geração e leitura de QR Codes
- Interface frontend com React + TypeScript
- Banco de dados com SQLAlchemy ORM
- Dashboard administrativo
- Página pública de check-in por CPF

---

## [Próximas Versões - Roadmap]

### 🗓️ v1.3.0 (Próximo)
- [ ] Integração de SMS para notificações
- [ ] Relatórios em PDF (movimentações, presenças)
- [ ] Exportação de dados em Excel
- [ ] Dashboard com gráficos de presenças

### 🗓️ v2.0.0 (Futuro)
- [ ] App mobile nativo (React Native)
- [ ] Sincronização offline
- [ ] Integração com sistemas de gestão escolar
- [ ] Biometria por impressão digital
- [ ] Suporte a múltiplas escolas
- [ ] Sistema de mensagens em tempo real (WebSocket)

---

## Convenções de Commit

Este projeto segue as convenções de commit do [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Mudanças em documentação
- `style:` Mudanças de formatação, sem mudança de código
- `refactor:` Refatoração de código existente
- `perf:` Melhorias de performance
- `test:` Adição ou mudança de testes
- `chore:` Atualizações de dependências, configurações

Exemplos:
```
feat: adicionar seleção visual múltipla de alunos
fix: corrigir filtro de pesquisa
docs: atualizar arquitetura
```

---

**Versão Atual**: 1.2.0
**Última Atualização**: Março 4, 2026
