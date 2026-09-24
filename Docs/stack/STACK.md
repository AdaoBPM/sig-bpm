# BPM — Stack Padrão

Este documento define as tecnologias aprovadas para projetos internos da BPM.  
**Versões abaixo:** estáveis no npm em **junho/2026** — ao iniciar um projeto novo, prefira a última estável compatível de cada pacote.

Para exceções (libs extras, trocas de stack), documente no `SPEC.md` do projeto.

---

## Runtime

| Tecnologia | Versão recomendada | Onde |
|---|---|---|
| Node.js | **22 LTS** (ou última LTS ativa) | frontend e backend |
| TypeScript | `6.0.3` | frontend e backend |

---

## Frontend (`frontend/`)

### Core

| Pacote | Versão | Uso |
|---|---|---|
| `next` | `16.2.9` | Framework (App Router) |
| `react` | `19.2.7` | UI |
| `react-dom` | `19.2.7` | Renderização |
| `typescript` | `6.0.3` | Tipagem estática |

### UI e estilo

| Pacote | Versão | Uso |
|---|---|---|
| `tailwindcss` | `4.3.1` | Estilização utilitária |
| `@tailwindcss/postcss` | última estável | Integração Tailwind v4 com PostCSS |
| **shadcn/ui** | última estável | Componentes (CLI + Base UI — não é um pacote único) |
| `sonner` | `2.0.7` | Toasts — via componente `Toaster` em `components/ui/sonner.tsx` |
| `lucide-react` | `1.21.0` | Ícones — **única lib de ícones aprovada** |

### UI (shadcn — template inclui)

| Componente | Uso |
|---|---|
| `button`, `input`, `label`, `skeleton` | Base |
| `dialog` | Modais e confirmações |
| `sonner` + `Toaster` | Notificações toast (global em `providers.tsx`) |
| `field`, `separator` | Formulários com react-hook-form + Zod (padrão atual shadcn) |

Novos componentes:

```bash
# na pasta frontend/
npx shadcn@latest add <nome>

# na raiz do monorepo
npx shadcn@latest add <nome> -c frontend
```

### Skill shadcn/ui (assistentes de IA)

O molde inclui a [skill oficial shadcn](https://ui.shadcn.com/docs/skills) em `.agents/skills/shadcn/` (Cursor, Claude Code e outros).

| Item | Detalhe |
|---|---|
| Ativação | Automática ao trabalhar com UI / `components.json` |
| CLI no monorepo | Sempre `-c frontend` a partir da raiz |
| Identidade BPM | `Docs/design-system/DESIGN-SYSTEM.md` prevalece sobre sugestões genéricas |
| Atualizar | `npx skills add shadcn/ui` na raiz; revisar nota **BPM monorepo** no `SKILL.md` |

Não confundir com `Docs/skills/` (processo SPEC, incremental, code review).

### Formulários e validação

| Pacote | Versão | Uso |
|---|---|---|
| `react-hook-form` | `7.80.0` | Formulários no cliente |
| `zod` | `4.4.3` | Schemas e validação (forms, Server Actions) |

### Estado e dados no cliente

| Pacote | Versão | Uso |
|---|---|---|
| `@tanstack/react-query` | `5.101.1` | Cache, refetch, estado assíncrono no cliente |
| `@tanstack/react-table` | `8.21.3` | Tabelas com ordenação, filtro e paginação |
| `zustand` | `5.0.14` | Estado global leve (UI, preferências, filtros locais) |

### Gráficos e HTTP

| Pacote | Versão | Uso |
|---|---|---|
| `recharts` | `3.9.0` | Gráficos em dashboards |
| `axios` | `1.18.1` | Chamadas HTTP ao backend Express (quando existir) |

### Banco de dados (quando o Next acessa o DB direto)

Usar **apenas** quando o `SPEC.md` definir arquitetura sem backend Express separado (Server Actions + Prisma no Next).

| Pacote | Versão | Uso |
|---|---|---|
| `prisma` | `7.8.0` | ORM — CLI e migrations |
| `@prisma/client` | `7.8.0` | Client gerado para queries |

### Utilitários

| Pacote | Versão | Uso |
|---|---|---|
| `date-fns` | `4.4.0` | Formatação e manipulação de datas |

### DevDependencies comuns (frontend)

| Pacote | Uso |
|---|---|
| `eslint` + `eslint-config-next` | Lint alinhado ao Next |
| `@types/react` / `@types/react-dom` | Tipos React |
| `babel-plugin-react-compiler` | React Compiler (se habilitado no template) |

---

## Backend (`backend/`)

### Core

| Pacote | Versão | Uso |
|---|---|---|
| `express` | `5.2.1` | API HTTP |
| `typescript` | `6.0.3` | Tipagem estática |
| `nodemon` | `3.1.14` | Reload em desenvolvimento |
| `tsx` ou `ts-node` | última estável | Executar TypeScript em dev (escolher um no setup) |

### Segurança e middleware

| Pacote | Versão | Uso |
|---|---|---|
| `helmet` | `8.2.0` | Headers de segurança HTTP |
| `cors` | `2.8.6` | CORS para o frontend Next |
| `jsonwebtoken` | `9.0.3` | Tokens JWT (auth em API) |
| `bcryptjs` | `3.0.3` | Hash de senhas |

### Validação e HTTP

| Pacote | Versão | Uso |
|---|---|---|
| `zod` | `4.4.3` | Validação de body, query e params |
| `axios` | `1.18.1` | Integrações REST externas (webhooks, APIs JSON) |
| `soap` | `1.9.3` | Clientes SOAP/WSDL (TOTVS RM, serviços legados) |
| `xml2js` | `0.6.2` | Parse e geração de XML (envelopes, respostas legadas) |
| `swagger-ui-express` | `5.0.1` | Documentação interativa OpenAPI em `/api/docs` |

Documentação da API: spec em `backend/src/config/openapi.ts`, JSON em `/api/docs.json`.

### Banco de dados e cache

| Pacote | Versão | Uso |
|---|---|---|
| `prisma` | `7.8.0` | ORM — schema e migrations (`prisma.config.ts` na raiz do backend) |
| `@prisma/client` | `7.8.0` | Client gerado em `src/generated/prisma` |
| `@prisma/adapter-pg` | última estável | Driver adapter PostgreSQL (Prisma 7) |
| `pg` | `8.22.0` | Driver PostgreSQL |
| `dotenv` | última estável | Carregar `.env` no backend e Prisma CLI |
| `redis` | `6.0.1` | Cache, sessões, filas leves |

**Banco padrão:** PostgreSQL.

### Utilitários

| Pacote | Versão | Uso |
|---|---|---|
| `date-fns` | `4.4.0` | Datas em regras de negócio e respostas da API |

### DevDependencies comuns (backend)

| Pacote | Uso |
|---|---|
| `@types/node` | Tipos Node |
| `@types/express` | Tipos Express |
| `@types/cors` | Tipos CORS |
| `@types/jsonwebtoken` | Tipos JWT |
| `@types/bcryptjs` | Tipos bcrypt |
| `@types/pg` | Tipos PostgreSQL |
| `@types/xml2js` | Tipos xml2js |
| `@types/swagger-ui-express` | Tipos Swagger UI |

---

## Compartilhados (frontend + backend)

Estes pacotes podem aparecer nos dois `package.json`, mas com papéis diferentes:

| Pacote | Frontend | Backend |
|---|---|---|
| `typescript` | Tipagem de componentes e Server Actions | Tipagem de rotas e serviços |
| `zod` | Validação de forms e Server Actions | Validação de requests da API |
| `prisma` | Acesso ao DB via Next (sem Express) | Acesso ao DB via Express |
| `date-fns` | Exibição de datas na UI | Lógica e serialização na API |
| `axios` | Consumir a API interna | Consumir APIs externas |

**Regra:** não duplicar o `schema.prisma` em dois lugares. Um único schema por projeto — no `frontend/` ou no `backend/`, conforme o `SPEC.md`.

---

## O que não usar

- Outras libs de ícones (Font Awesome, Heroicons direto, etc.) — usar `lucide-react`
- Outras libs de componentes UI (MUI, Ant Design, Chakra) — usar `shadcn/ui`
- CSS-in-JS (styled-components, Emotion) — usar Tailwind
- `moment` — usar `date-fns`
- ORM alternativo (TypeORM, Sequelize) — usar Prisma
- Lib de gráficos alternativa sem aprovação no SPEC — padrão é `recharts`

---

## Quando usar só frontend vs frontend + backend

| Cenário | Arquitetura |
|---|---|
| Landing page | Apenas `frontend/` (Next.js) |
| Dashboard simples, uma fonte de dados | Apenas `frontend/` (Server Components + Prisma ou fetch) |
| Sistema interno com CRUD | `frontend/` com Prisma + Server Actions (padrão) |
| Integrações pesadas, jobs, filas, API para terceiros | `frontend/` + `backend/` Express |
| Auth JWT consumida por cliente externo | `backend/` com `jsonwebtoken` + `bcryptjs` |

Detalhes de decisão por projeto: `Docs/skills/SPEC-DRIVEN.md` (seção Stack e Dependências).

---

## Atualização de versões

1. Consultar versão estável: `npm view <pacote> version`
2. Atualizar o `package.json` correspondente (`frontend/` ou `backend/`)
3. Rodar testes / build antes de propagar para novos projetos clonados do template
4. Atualizar este documento quando a stack padrão da BPM mudar

---

## Referência rápida por pasta

```
frontend/package.json  → Next, React, Tailwind, shadcn, TanStack, Zustand,
                         Recharts, react-hook-form, Zod, axios, Prisma (opcional)

backend/package.json   → Express, Nodemon, Prisma, pg, Redis, JWT, bcrypt,
                         Helmet, CORS, Zod, axios, soap, xml2js,
                         swagger-ui-express, date-fns
```
