# OperaLog — Gestão de Operações Logísticas

Sistema completo de gestão operacional para a Produslog.
Desenvolvido por WM · 2025

---

## Stack

- **Backend:** Node.js + Express
- **Banco:** PostgreSQL (Railway)
- **Frontend:** HTML + CSS + JS (vanilla)
- **Auth:** JWT
- **Deploy:** Railway

---

## Configuração Local

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

### 3. Criar banco de dados
Execute o arquivo `database/schema.sql` no seu PostgreSQL.

### 4. Rodar em desenvolvimento
```bash
npm run dev
```

---

## Deploy no Railway

### 1. Criar projeto no Railway
- Acesse railway.app
- New Project → Deploy from GitHub
- Selecione o repositório do OperaLog

### 2. Adicionar PostgreSQL
- No projeto Railway: New → Database → PostgreSQL
- Railway configura o DATABASE_URL automaticamente

### 3. Configurar variáveis de ambiente no Railway
```
JWT_SECRET=sua_chave_secreta_forte_aqui
NODE_ENV=production
```

### 4. Executar o schema
- No Railway, abra o PostgreSQL
- Vá em Data → Query
- Cole e execute o conteúdo de `database/schema.sql`

### 5. Deploy
- O Railway faz deploy automaticamente a cada push no GitHub

---

## Módulos

| Módulo | Rota | Descrição |
|--------|------|-----------|
| Login | `/` | Autenticação trilíngue |
| Dashboard | `/dashboard.html` | KPIs e visão geral |
| Operações | `/operacoes.html` | Gestão IN HOUSE |
| Transportadoras | `/transportadoras.html` | PET e scores |
| Ocorrências | `/ocorrencias.html` | Feed e registro |
| PDCA | `/pdca.html` | Board de planos |

---

## API

Base URL: `https://seu-app.railway.app/api`

### Autenticação
```
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/usuarios (admin)
```

### Dashboard
```
GET /api/dashboard
```

### Operações
```
GET    /api/operacoes
POST   /api/operacoes
PUT    /api/operacoes/:id
DELETE /api/operacoes/:id
```

### Transportadoras
```
GET  /api/transportadoras
POST /api/transportadoras
POST /api/transportadoras/:id/pet
```

### Ocorrências
```
GET /api/ocorrencias
POST /api/ocorrencias
PUT  /api/ocorrencias/:id/resolver
```

### PDCA
```
GET /api/pdca
POST /api/pdca
PUT  /api/pdca/:id/avancar
PUT  /api/pdca/:id/voltar
```

---

## Credenciais Padrão

```
Email: admin@operalog.app
Senha: operalog2025
```

⚠️ Altere a senha após o primeiro login.

---

## Idiomas Suportados

- 🇧🇷 Português BR
- 🇵🇹 Português PT
- 🇪🇸 Español

---

OperaLog · WM · 2025
