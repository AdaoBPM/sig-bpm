# Segurança — Referência condicional

> **Não é obrigatório ler tudo.** Consulte apenas o que o SPEC e a entrevista indicarem.

Esta pasta complementa `Docs/stack/CONVENTIONS.md` (como codar) com **políticas** (quando aplicar LGPD, RBAC completo, auditoria).

---

## Quando ler cada documento

| Documento | Leia se… | Não precisa se… |
|---|---|---|
| [LGPD.md](./LGPD.md) | SPEC armazena nome, CPF, e-mail, RH, financeiro pessoal, leads identificáveis | Landing sem persistência ou só analytics anônimo |
| [RBAC.md](./RBAC.md) | `sistema-interno` com perfis diferentes (vendedor vs gerente, etc.) | Landing pública ou dashboard com acesso único |
| [AUDITORIA-LOGS.md](./AUDITORIA-LOGS.md) | Aprovações, financeiro, RH, compliance ou LGPD com histórico | CRUD simples sem trilha formal |

---

## Posição no fluxo

```
Entrevista → SPEC (marca anexos de segurança) → Aprovação TI → Implementação
```

No `SPEC.md`, indique explicitamente quais anexos se aplicam:

```markdown
## Anexos de segurança
- [ ] LGPD — inventário de dados pessoais
- [ ] RBAC — matriz de permissões
- [ ] Auditoria — eventos a registrar
```

---

## Relação com o código do template

| Tema | Referência no código | Doc de política |
|---|---|---|
| Permissões na UI | `PermissionContext`, `PermissionGuard` | [RBAC.md](./RBAC.md) |
| Permissões na API | `backend/src/middlewares/verificarPermissao.ts` | [RBAC.md](./RBAC.md) |
| Acesso a telas (stub) | `useRegistrarAcessoTela.ts` | [AUDITORIA-LOGS.md](./AUDITORIA-LOGS.md) |
| API REST exposta | `Docs/projeto/anexos/RNF-API-SEGURA.md` | [AUDITORIA-LOGS.md](./AUDITORIA-LOGS.md) |

**Implementação completa** (tabelas `audit_log`, exportação LGPD, perfis no Prisma) entra **só quando o SPEC prever** — não vem pronta no molde.

---

## Para a IA

- Durante a entrevista: se detectar dados pessoais, perfis ou fluxos sensíveis, **mencione** o doc correspondente ao montar o SPEC.
- Não implemente LGPD/RBAC/auditoria completos sem estar no SPEC confirmado e aprovado pelo TI.
- Adapte exemplos à stack: TypeScript, Prisma 7, Express 5 — não copie SQL/JS do framework legado.
