# Deploy e ambientes — orientação para TI

> O molde **não inclui pipeline de CI/CD**. Este documento descreve opções quando o SPEC aprovar homologação ou produção.

---

## Ambientes sugeridos

| Ambiente | Objetivo | Quem acessa |
|---|---|---|
| **dev** | Máquina do desenvolvedor | Dev + solicitante (demo local) |
| **homolog** | Validação de negócio | Área solicitante + TI |
| **prod** | Uso real | Usuários finais |

---

## O que deployar

Depende do `SPEC.md`:

| Tipo de projeto | Frontend | Backend | Banco |
|---|---|---|---|
| Landing só | Sim | Não | Opcional (leads) |
| Dashboard leitura | Sim | Opcional | Se houver API |
| Sistema interno | Sim | Sim | PostgreSQL |

Matriz do que remover do template: [MATRIZ-TEMPLATE.md](./MATRIZ-TEMPLATE.md)

---

## Variáveis de ambiente (produção)

### Frontend (`frontend/.env` ou painel do host)

```env
BACKEND_URL=https://api-interna.bpm.com.br
```

Nunca expor `JWT_SECRET` no frontend.

### Backend (`backend/.env`)

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=<mínimo 32 caracteres aleatórios>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://app-interna.bpm.com.br
ENABLE_TEMPLATE_AUTH=false
ENABLE_SWAGGER=false
ENABLE_AUDIT=true
```

TOTVS (se SPEC exigir):

```env
TOTVS_WSDL_URL=https://...
TOTVS_USER=...
TOTVS_PASSWORD=...
```

---

## Opções de hospedagem (BPM — escolher com TI)

### Opção A — VM Windows/Linux (comum em intranet)

1. Node.js 22 LTS na VM
2. `npm run build` na raiz
3. Process manager: **PM2** ou serviço Windows
4. IIS ou Nginx como reverse proxy (HTTPS)
5. PostgreSQL em servidor dedicado ou mesma VM (homolog)

```
Internet/intranet → HTTPS → Nginx/IIS → :3000 (Next) + :3001 (Express)
```

### Opção B — Frontend na Vercel + Backend em VM

- Adequado se **só** o Next.js for público/interno via VPN
- BFF e cookies: validar domínio e `CORS_ORIGIN`
- Express permanece na rede interna

### Opção C — Somente frontend (landing / dashboard estático)

- `next build` + `next start` ou export estático se aplicável
- Sem `backend/` no deploy

---

## Checklist pré-deploy (TI)

- [ ] `ENABLE_TEMPLATE_AUTH=false`
- [ ] `JWT_SECRET` forte e único por ambiente
- [ ] `ENABLE_SWAGGER=false` em prod (ou rede restrita)
- [ ] HTTPS obrigatório
- [ ] Backup PostgreSQL configurado
- [ ] Logs sem PII (AUDITORIA-LOGS.md)
- [ ] RBAC testado em homolog
- [ ] [APROVACAO-TI.md](./APROVACAO-TI.md) concluída
- [ ] [CRITERIOS-SUCESSO.md](./CRITERIOS-SUCESSO.md) revisados

---

## Banco de dados

Ver [Docs/stack/DATABASE.md](../stack/DATABASE.md) — `prisma db push` ou migrations conforme política TI.

---

## Atualizar projeto filho com melhorias do molde

Ver [SYNC-MOLDE.md](./SYNC-MOLDE.md).

---

## Docker

Não é padrão do molde. Adotar apenas se TI padronizar containers — documentar no SPEC do projeto.
