# Matriz — o que manter ou remover por tipo de projeto

> Use após o SPEC confirmado. O molde traz **tudo** como referência; cada projeto fica enxuto.

---

## Resumo rápido

| Tipo | Auth | Backend Express | Postgres | Proxy BFF | Exemplos `/exemplo/*` |
|---|---|---|---|---|---|
| **Landing** | Remover | Remover | Opcional (leads) | Remover | Manter landing; remover form interno |
| **Dashboard** | Manter ou simplificar | Opcional | Se houver persistência | Se houver backend | Adaptar dashboard; remover pedidos se não usar |
| **Sistema interno** | Manter | Manter | Sim (típico) | Manter | Substituir por módulos reais |

---

## Landing page pública

### Manter

- `frontend/src/app/page.tsx` ou nova rota pública
- `frontend/src/components/sections/*`
- `frontend/src/app/api/leads/` (se captura lead)
- `Docs/design-system/`, `Docs/entrevista/scenarios/landing-page.md`

### Remover / não usar

- `frontend/src/proxy.ts` (middleware auth)
- `frontend/src/context/AuthContext.tsx`, `PermissionContext.tsx`
- `frontend/src/app/api/proxy/`, `app/api/auth/`
- `frontend/src/components/layout/Sidebar.tsx`, `ProtectedLayout.tsx`
- Pasta `backend/` inteira (se SPEC não prever API)
- Rotas `/dashboard`, `/pedidos`, `/auth/login`

### Ajustar

- `app/layout.tsx` — sem providers de auth
- Navegação apenas em header/âncoras da landing

---

## Dashboard interno

### Manter

- Auth + `ProtectedLayout` + `/dashboard`
- `lib/dashboard.ts` — substituir mocks por dados reais
- Recharts, filtros, export (padrão do exemplo)
- `useRegistrarAcessoTela` em telas sensíveis (se SPEC pedir auditoria)

### Remover se não aplicável

- `/pedidos/listagem` — se não houver módulo pedidos
- `totvsService` — sem integração TOTVS no SPEC
- `backend/` — se dados vierem só de Server Actions + Prisma no frontend

### Opcional

- Backend Express — apenas se precisar jobs, TOTVS ou API compartilhada

---

## Sistema interno (CRUD, workflows)

### Manter

- Monorepo completo (frontend + backend)
- BFF `app/api/proxy/[...path]`
- Prisma no backend, RBAC, Swagger em dev
- Padrão módulo: `app/[modulo]/[feature]/`
- `DataTable`, formulários Field + RHF + Zod

### Remover

- `/exemplo/landing` — se não for marketing
- Mocks em `lib/dashboard.ts` — substituir por domínio real
- `ENABLE_TEMPLATE_AUTH` em homolog/prod

### Expandir

- Novas rotas em `backend/src/routes/`
- Atualizar `openapi.ts` a cada rota pública da API
- `Docs/seguranca/*` conforme LGPD/RBAC/auditoria

---

## Pasta `Docs/`

| Ação | Detalhe |
|---|---|
| **Manter sempre** | `entrevista/`, `skills/`, `design-system/`, `stack/` |
| **Consultar se aplicável** | `seguranca/` |
| **Arquivar** | `projeto/exemplos/` — referência, não contrato |

Nunca apagar `Docs/` — a IA depende do processo.

---

## Variáveis de ambiente por tipo

| Variável | Landing | Dashboard | Sistema interno |
|---|---|---|---|
| `BACKEND_URL` | — | Se backend | Sim |
| `DATABASE_URL` | Opcional | Se persistir | Sim |
| `ENABLE_TEMPLATE_AUTH` | — | dev only | dev only |
| `ENABLE_AUDIT` | Opcional | Se SPEC | Recomendado |

---

## Referências no código

| Exemplo template | Substituir por |
|---|---|
| `lib/dashboard.ts` | `lib/[seu-modulo].ts` |
| `pedidos/listagem` | `[seu-modulo]/listagem` |
| `exemplo/formulario` | `[modulo]/cadastro` |
| `admin@bpm.com` | Usuários reais no Postgres |
