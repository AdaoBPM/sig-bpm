# Anexo — RNF: API Segura (opcional)

> **Quando usar:** o SPEC prever API REST consumível por outros sistemas ou módulo com operações sensíveis (usuários, financeiro, integrações).

> **Não é obrigatório no molde.** Projetos landing page ou CRUD interno simples podem omitir este anexo.

---

## Identificação

```
Módulo / API:    _______________________________________________
Versão:          1.0
Data:            ___/___/______
RFs relacionados: _______________________________________________
```

---

## RNF-API-001 — Autenticação e autorização

| Requisito | Obrigatório | Detalhe |
|---|---|---|
| Autenticação | Sim | JWT via header `Authorization: Bearer <token>` → `401` se inválido |
| Autorização no backend | Sim | Validar permissão **antes** do controller — não confiar só no frontend |
| Endpoints públicos | Explícito | Apenas rotas documentadas como públicas (ex.: health, login) |
| HTTPS em produção | Sim | Tráfego com token apenas sobre HTTPS |
| Dados sensíveis na resposta | Não | Nunca retornar senha, hash, tokens internos ou segredos de integração |
| Rate limiting | Sim | Especialmente em login e rotas de escrita |
| SQL parametrizado | Sim | Prisma ou queries parametrizadas — zero concatenação |

**Permissões (exemplo):**

| Código | Operação |
|---|---|
| `[modulo]:[recurso]:visualizar` | GET |
| `[modulo]:[recurso]:editar` | POST / PATCH |

---

## RNF-API-002 — Contrato e documentação

| Requisito | Valor |
|---|---|
| Formato de resposta | JSON consistente (`data`, `error`, `meta` conforme `CONVENTIONS.md`) |
| Códigos HTTP | `401`, `403`, `404`, `422`, `500` documentados |
| Paginação | `pagina`, `limite`, `total` em listagens |
| Documentação OpenAPI | **Padrão no backend** — `/api/docs` e `/api/docs.json` (`openapi.ts`) |
| Versionamento | Prefixo `/api/v1/` quando API for estável para consumo externo |

---

## RNF-API-003 — Auditoria (operações sensíveis)

| Requisito | Obrigatório |
|---|---|
| Log de quem executou | Sim — user id + timestamp |
| Inativação / exclusão lógica | Preferir soft delete com `deletado_por`, `deleted_at` |
| Motivo opcional | Campo texto curto em operações destrutivas |

---

## RNF-API-004 — Desempenho mínimo

| Operação | Meta |
|---|---|
| Listagem paginada | < 2 s (p95) |
| Escrita simples | < 1 s (p95) |
| Integração externa (TOTVS) | < 15 s — exibir loading ou job assíncrono se maior |

---

## Validação

- Checklist de segurança no `Docs/projeto/APROVACAO-TI.md` (Bloco 3)
- Política de auditoria: [`Docs/seguranca/AUDITORIA-LOGS.md`](../seguranca/AUDITORIA-LOGS.md)
- Revisão com `Docs/skills/CODE-REVIEW.md` antes do merge

---

## Referência no SPEC

No `SPEC.md`, inclua na seção de integrações ou stack:

```markdown
## Anexos de requisitos
- RNFs de API: `Docs/projeto/anexos/RNF-API-SEGURA.md` (módulo Usuários)
```
