# RBAC — Controle de acesso por permissões

> **Para quem não é da área de TI:** RBAC define **quem pode ver e fazer o quê** — como níveis de crachá. Vendedor vê só seus pedidos; gerente aprova todos da área.

> **Para a IA:** O molde usa RBAC **simples** por padrão. RBAC completo com tabelas de perfis só entra se o SPEC exigir.

---

## Quando se aplica

| Projeto | RBAC |
|---|---|
| Landing page | Não |
| Dashboard só leitura, mesmo público | Auth opcional; permissão única |
| Sistema interno com perfis diferentes | Sim — documentar no SPEC |
| Módulo admin (usuários, perfis) | Sim — RBAC completo + [AUDITORIA-LOGS.md](./AUDITORIA-LOGS.md) |

---

## Modelo do molde (V1 típica)

Permissões como **strings** no usuário — sem tabelas extras:

```typescript
// backend — JWT / usuário
permissions: ["dashboard:view", "pedidos:view", "pedidos:create"]
```

**Padrão de código:** `modulo:funcionalidade:acao`

```
pedidos:listagem:visualizar
pedidos:listagem:criar
pedidos:aprovacao:aprovar
financeiro:contas:visualizar
```

---

## Onde validar (regra crítica)

| Camada | Papel | Arquivo de referência |
|---|---|---|
| Frontend | UX — esconder botão/rota | `PermissionGuard`, `PermissionContext` |
| Backend | **Segurança real** | `verificarPermissao("pedidos:create")` |
| Proxy Next | Sessão existe? | `proxy.ts` — **não** substitui RBAC fino |

**Nunca** confiar só no frontend. Remover botão sem bloquear a API é falha de segurança.

---

## Frontend

```tsx
import { PermissionGuard } from "@/components/shared/PermissionGuard";

<PermissionGuard permission="pedidos:create">
  <Button>Novo pedido</Button>
</PermissionGuard>
```

```tsx
const { hasPermission } = usePermissions();
if (!hasPermission("pedidos:view")) { /* redirect ou empty state */ }
```

Permissões vêm do login (`/api/auth/me`) — array no token/sessão.

---

## Backend

```typescript
// routes/pedidosRoutes.ts
router.post(
  "/",
  autenticacao,
  verificarPermissao("pedidos:create"),
  pedidosController.criar,
);
```

Middleware em `backend/src/middlewares/verificarPermissao.ts`.

---

## Matriz no SPEC

Documente no SPEC (obrigatório se houver RBAC):

| Perfil | Permissões | Observação |
|---|---|---|
| Vendedor | `pedidos:view`, `pedidos:create` | Só próprios registros (regra no service) |
| Gerente | + `pedidos:approve` | Toda a equipe |
| Admin | Todas do módulo | Restringir a TI/gestão |

**Regra de negócio extra** (ex.: “só edita próprio pedido”) fica no **service**, não só na permissão.

---

## Quando escalar para RBAC completo

Se o SPEC exigir perfis editáveis pela UI (criar perfil “Conferente”, atribuir permissões):

1. Modelar no Prisma: `Perfil`, `Permissao`, `UsuarioPerfil` (ver framework legado como inspiração)
2. Seed ou migration com permissões do catálogo
3. Tela de administração — geralmente **V2**, não molde base
4. Auditoria de atribuição de perfil — [AUDITORIA-LOGS.md](./AUDITORIA-LOGS.md)

---

## Princípios

1. **Menor privilégio** — só o necessário para o cargo
2. **Validação dupla** — frontend + backend
3. **Perfis admin** — poucos usuários; evitar “acesso total” por conveniência
4. **Coerência com entidades** — permissão alinhada ao módulo do `CONVENTIONS.md` (`pedidos/`, não genérico)

---

## Checklist RBAC (TI)

- [ ] Matriz perfil × permissão no SPEC
- [ ] Middleware `verificarPermissao` em rotas de escrita e leitura sensível
- [ ] `PermissionGuard` nas ações destrutivas na UI
- [ ] Regras “só meus registros” implementadas no service
- [ ] Testado com usuário sem permissão → `403` na API

---

## Referências

| Arquivo | Conteúdo |
|---|---|
| `Docs/stack/CONVENTIONS.md` | § Autenticação e permissões |
| `frontend/src/context/PermissionContext.tsx` | Hook `usePermissions` |
| `frontend/src/components/shared/PermissionGuard.tsx` | Guard de UI |
| `backend/src/middlewares/verificarPermissao.ts` | Guard de API |
