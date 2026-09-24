# Banco de dados — quando e como usar

> O molde **funciona sem PostgreSQL** em dev (auth template). O banco entra quando o `SPEC.md` exigir persistência.

---

## Onde fica o schema

| Pacote | Caminho | Quando |
|---|---|---|
| Backend | `backend/prisma/schema.prisma` | Sistema interno com API Express (padrão) |
| Frontend | `frontend/prisma/schema.prisma` | Landing/CRUD só Next.js (raro) |

**Regra:** um único `schema.prisma` por projeto — ver [CONVENTIONS.md](./CONVENTIONS.md).

---

## Modelos no template

| Modelo | Uso |
|---|---|
| `Usuario` | Auth real (substitui template user quando populado) |
| `AuditLog` | Auditoria de negócio (quando `ENABLE_AUDIT=true` e DB disponível) |

Novos modelos: adicionar após SPEC aprovado, módulo a módulo.

---

## Configuração local

1. Instale PostgreSQL 15+ (ou use instância TI)
2. Copie env: `npm run setup`
3. Edite `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bpm_template
```

4. Aplique schema:

```bash
npm run db:push --prefix backend
```

5. (Opcional) Prisma Studio:

```bash
npm run db:studio --prefix backend
```

---

## Sem banco em dev

- Login: `ENABLE_TEMPLATE_AUTH=true` + `admin@bpm.com` / `admin123`
- Auditoria: log em **console** do backend (não persiste)
- Prisma: rotas que exigem DB falham graciosamente ou usam fallback template

---

## Migrations vs db push

| Abordagem | Quando usar |
|---|---|
| `db push` | Protótipo, homolog inicial, projetos pequenos |
| `prisma migrate` | Produção com histórico versionado (política TI) |

O molde expõe `db:push` nos scripts. Migrar para `migrate` quando TI exigir.

---

## Seeds

O molde **não** inclui seed automático — evita dados fictícios em homolog por engano.

Criar `backend/prisma/seed.ts` no projeto quando o SPEC definir usuários iniciais.

---

## SQL Server (TOTVS RM)

- **Não** modelar no Prisma como SG principal
- Acesso via `backend/src/config/mssql.ts` e `totvsService.ts`
- Consultas legado apenas no backend

---

## Checklist TI — novo ambiente

- [ ] `DATABASE_URL` por ambiente (dev/homolog/prod isolados)
- [ ] Usuário DB com permissão mínima
- [ ] Backup automático
- [ ] `ENABLE_TEMPLATE_AUTH=false` em homolog/prod
- [ ] Connection pool adequado (Prisma adapter pg já configurado)

---

## Referências

- [CONVENTIONS.md](./CONVENTIONS.md) — Prisma e camadas
- [Docs/seguranca/AUDITORIA-LOGS.md](../seguranca/AUDITORIA-LOGS.md) — modelo `AuditLog`
- [Docs/projeto/DEPLOY.md](../projeto/DEPLOY.md) — produção
