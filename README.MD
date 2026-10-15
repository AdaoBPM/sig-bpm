# BPM Pré-Moldados — Template de Projetos Internos

Repositório **base** para funcionários da BPM criarem ideias de aplicações internas com apoio de IA (Cursor / Claude Code).

> **Isto não é um produto pronto.** É um ponto de partida com padrões, documentação e código de referência. Todo projeto novo passa por **descoberta, especificação e avaliação do TI** antes de virar sistema de verdade.

---

## O que tem aqui

```
projeto-padrao-bpm/
├── Docs/           ← Regras, entrevista, design system, stack
├── frontend/       ← Next.js 16 (App Router, TypeScript)
├── backend/        ← Express (quando o projeto precisar de API separada)
├── package.json    ← Scripts monorepo (`npm run dev` na raiz)
├── AGENTS.md       ← Instruções para a IA (Cursor / Claude)
└── COMECE-AQUI.md  ← Guia para humanos — leia primeiro
```

---

## Por onde começar

| Você é… | Leia |
|---|---|
| **Funcionário com uma ideia (primeiro passo)** | [Docs/projeto/COMO-CRIAR-SEU-PROJETO.md](./Docs/projeto/COMO-CRIAR-SEU-PROJETO.md) |
| **Funcionário — processo e IA** | [COMECE-AQUI.md](./COMECE-AQUI.md) |
| **IA (Cursor / Claude)** | [AGENTS.md](./AGENTS.md) |
| **Dev / TI — molde e template GitHub** | [Docs/projeto/COMO-CRIAR-SEU-PROJETO.md § Caminho 3](./Docs/projeto/COMO-CRIAR-SEU-PROJETO.md#caminho-3--ti-mantém-o-molde-instrução-para-ti) |

---

## Fluxo resumido

```
Ideia → Entrevista (IA) → SPEC confirmado → Avaliação TI → Implementação incremental → Revisão
```

Detalhes em [Docs/entrevista/INTERVIEW.md](./Docs/entrevista/INTERVIEW.md).

---

## Rodar localmente (visão geral)

Na **raiz** do repositório (recomendado — sobe frontend e backend juntos):

```bash
npm run setup
npm install
npm run dev
```

> **Desde 15/10/2026, dois ambientes:** produção (`npm run producao:construir` e `npm run producao`, porta 3000, o banco
> real) e desenvolvimento (`npm run dev`, porta 3100, uma cópia do banco). Ver
> [Docs/PRODUCAO-E-DESENVOLVIMENTO.md](Docs/PRODUCAO-E-DESENVOLVIMENTO.md).

Ou separado:

```bash
# Backend (porta 3101 no desenvolvimento; 3001 na produção)
npm run dev:backend

# Frontend (porta 3100 no desenvolvimento; 3000 na produção)
npm run dev:frontend
```

Build de tudo: `npm run build`  
Testes smoke (local, sem CI): `npm test`

Login de **demonstração** (dev): `admin@bpm.com` / `admin123` — ver [COMECE-AQUI.md](./COMECE-AQUI.md).

**Exemplos no molde:**

| Rota | Conteúdo |
|---|---|
| [http://localhost:3000/dashboard](http://localhost:3000/dashboard) | KPIs, filtro, tabela, export CSV |
| [http://localhost:3000/pedidos/listagem](http://localhost:3000/pedidos/listagem) | DataTable + busca |
| [http://localhost:3000/exemplo/formulario](http://localhost:3000/exemplo/formulario) | Field + RHF + Zod |
| [http://localhost:3000/exemplo/landing](http://localhost:3000/exemplo/landing) | Landing pública (sem login) |

**Swagger (backend):** [http://localhost:3001/api/docs](http://localhost:3001/api/docs) — documentação interativa da API.

---

## Documentação principal

| Documento | Conteúdo |
|---|---|
| [Docs/projeto/COMO-CRIAR-SEU-PROJETO.md](./Docs/projeto/COMO-CRIAR-SEU-PROJETO.md) | **Comece aqui** — cópia do molde, Git, dashboard |
| [Docs/projeto/PILOTO-CHECKLIST.md](./Docs/projeto/PILOTO-CHECKLIST.md) | Validar molde em ~30 min |
| [Docs/projeto/MENSAGENS-PRONTAS.md](./Docs/projeto/MENSAGENS-PRONTAS.md) | Textos para Cursor e TI |
| [Docs/projeto/exemplos/SPEC-dashboard-producao.md](./Docs/projeto/exemplos/SPEC-dashboard-producao.md) | SPEC fictício de referência |
| [Docs/projeto/MATRIZ-TEMPLATE.md](./Docs/projeto/MATRIZ-TEMPLATE.md) | O que remover por tipo de projeto |
| [Docs/projeto/DEPLOY.md](./Docs/projeto/DEPLOY.md) | Homolog/prod (sem CI no molde) |
| [Docs/projeto/SYNC-MOLDE.md](./Docs/projeto/SYNC-MOLDE.md) | Atualizar projetos filhos |
| [Docs/stack/DATABASE.md](./Docs/stack/DATABASE.md) | PostgreSQL e Prisma |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Quem commita no molde (TI) |
| [COMECE-AQUI.md](./COMECE-AQUI.md) | Guia completo para humanos |
| [Docs/projeto/APROVACAO-TI.md](./Docs/projeto/APROVACAO-TI.md) | Checklist TI antes do desenvolvimento |
| [Docs/projeto/FORMULARIO-RASCUNHO-NEGOCIO.md](./Docs/projeto/FORMULARIO-RASCUNHO-NEGOCIO.md) | Rascunho opcional antes da entrevista |
| [Docs/projeto/CRITERIOS-SUCESSO.md](./Docs/projeto/CRITERIOS-SUCESSO.md) | Métricas de negócio e go-live |
| `Docs/projeto/anexos/RNF-API-SEGURA.md` | RNFs de API (opcional) |
| [Docs/seguranca/README.md](./Docs/seguranca/README.md) | LGPD, RBAC e auditoria (condicional) |
| [Docs/design-system/DESIGN-SYSTEM.md](./Docs/design-system/DESIGN-SYSTEM.md) | Cores, tipografia, logo |
| [Docs/stack/STACK.md](./Docs/stack/STACK.md) | Tecnologias aprovadas |
| [Docs/stack/CONVENTIONS.md](./Docs/stack/CONVENTIONS.md) | Estrutura de pastas e código |
| [Docs/skills/SPEC-DRIVEN.md](./Docs/skills/SPEC-DRIVEN.md) | Como gerar o SPEC |

---

## Importante

- **Não pule a entrevista** — a IA precisa entender o problema antes de codar.
- **Não pule o SPEC** — o escopo (incluindo o que *não* será feito) deve ser confirmado por escrito.
- **Avaliação do TI** — ideias passam por análise da equipe de tecnologia antes de produção.
- **Template ≠ projeto final** — auth, dashboard e backend existem como *referência*, não como obrigação para todo caso.
