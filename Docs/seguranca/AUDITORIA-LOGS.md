# Auditoria e logs

> **Para quem não é da área de TI:** **Auditoria** registra *quem fez o quê* (negócio/compliance). **Log técnico** ajuda a TI a diagnosticar erros. São complementares.

> **Para a IA:** O molde tem **stub** (`useRegistrarAcessoTela`). Implementação completa de `audit_log` só quando o SPEC exigir.

---

## Quando se aplica

| Situação | Auditoria de negócio | Log técnico |
|---|---|---|
| Login / logout | Recomendado | Sim (warn/error) |
| CRUD com dados sensíveis | Sim | Sim |
| Aprovação / reprovação | Sim | Sim |
| Financeiro / RH | Sim | Sim |
| Landing só com lead | Opcional (envio formulário) | Erros de API |
| Dashboard read-only interno | Opcional (acesso a relatório) | Sim |

---

## Dois tipos de registro

| Tipo | Conteúdo | Consumidor | Retenção típica |
|---|---|---|---|
| **Auditoria** | Ação + usuário + entidade + antes/depois | Gestão, RH, jurídico | 12 meses – 5 anos (definir no SPEC) |
| **Técnico** | Erros, warnings, fluxo de app | TI | 30–90 dias |

---

## Eventos a auditar (quando SPEC marcar auditoria)

| Evento | Código sugerido | Registrar |
|---|---|---|
| Login OK | `LOGIN` | userId, IP, user-agent |
| Login falha | `LOGIN_FALHA` | IP, e-mail tentado (não senha) |
| Logout | `LOGOUT` | userId, IP |
| Criação | `CRIACAO` | entidade, id, snapshot relevante |
| Alteração | `ALTERACAO` | entidade, id, campos alterados |
| Exclusão lógica | `EXCLUSAO` | entidade, id, estado anterior |
| Aprovação / reprovação | `APROVACAO` / `REPROVACAO` | decisão, justificativa |
| Acesso dado sensível | `ACESSO` | relatório/tela, userId |
| Permissão concedida/removida | `PERMISSAO_*` | quem, para quem, código |
| Exportação LGPD | `EXPORTACAO_LGPD` | userId, titular | Ver [LGPD.md](./LGPD.md) |

Liste no SPEC **apenas** os eventos necessários à V1.

---

## Modelo sugerido (Prisma — implementar se SPEC exigir)

```prisma
model AuditLog {
  id           String   @id @default(uuid())
  acao         String
  entidade     String?
  entidadeId   String?  @map("entidade_id")
  usuarioId    String?  @map("usuario_id")
  usuarioNome  String?  @map("usuario_nome")
  ip           String?
  userAgent    String?  @map("user_agent")
  dadosAntes   Json?    @map("dados_antes")
  dadosDepois  Json?    @map("dados_depois")
  metadados    Json?
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([usuarioId, createdAt(sort: Desc)])
  @@index([entidade, entidadeId])
  @@map("audit_log")
}
```

Service no backend: falha de auditoria **não deve** abortar a operação principal — logar erro técnico e seguir.

---

## Stub no template (implementação mínima)

- **Frontend:** `useRegistrarAcessoTela` → `POST /api/proxy/auditoria/acesso`
- **Backend:** `POST /auditoria/acesso` — persiste em `audit_log` se `DATABASE_URL` existir; senão log estruturado no console
- **Controle:** `ENABLE_AUDIT` no `backend/.env`
- **Modelo Prisma:** `AuditLog` em `backend/prisma/schema.prisma`

Implementação incremental em projetos reais:

1. Endpoint `POST /api/v1/auditoria` (ou BFF equivalente)
2. Chamar de `useRegistrarAcessoTela` em telas sensíveis
3. Chamar de services após create/update/delete

---

## Log técnico (backend)

Padrão mínimo sem biblioteca extra na V1:

```typescript
console.error("[PedidosService]", { message: error.message, pedidoId });
```

Se o SPEC exigir observabilidade (Winston, Pino, Datadog):

- Nível `error` para falhas de operação
- Nível `warn` para token expirado, rate limit
- Nível `info` para eventos de fluxo (opcional)
- **Produção:** formato JSON facilita indexação

Documentar a escolha no SPEC — não é padrão fixo do molde.

---

## O que NUNCA logar

```typescript
// ❌ PROIBIDO
logger.info("login", { senha: body.password, token: jwt });

// ✅ CORRETO
logger.info("login_ok", { userId: user.id, ip: request.ip });
```

- Senhas, tokens completos, CPF em claro, dados de cartão
- Corpo inteiro de request com PII — preferir IDs e metadados

---

## Checklist auditoria (TI)

- [ ] Eventos obrigatórios listados no SPEC
- [ ] Tabela ou serviço de auditoria implementado (se aplicável)
- [ ] Login/logout registrados
- [ ] Alterações em entidades sensíveis com antes/depois ou diff
- [ ] Logs técnicos sem dados sensíveis
- [ ] Retenção de logs definida
- [ ] LGPD: acesso a exportação de dados pessoais auditado ([LGPD.md](./LGPD.md))

---

## Referências cruzadas

| Documento | Relação |
|---|---|
| [LGPD.md](./LGPD.md) | Log de acesso a dados pessoais |
| [RBAC.md](./RBAC.md) | Auditoria de mudança de permissão |
| `Docs/projeto/anexos/RNF-API-SEGURA.md` | RNFs de API + auditoria |
| `Docs/skills/CODE-REVIEW.md` | Revisar vazamento em logs |
