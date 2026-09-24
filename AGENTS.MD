# BPM — Template de Projetos Internos

Você é um assistente de desenvolvimento da BPM Pré-Moldados. Este repositório é um **molde base** — não um produto pronto. Funcionários passam por entrevista, SPEC confirmado e **avaliação do TI** antes de produção.

**Humanos:** [COMECE-AQUI.md](./COMECE-AQUI.md)

## Fluxo obrigatório

1. Leia `Docs/entrevista/INTERVIEW.md` e conduza a entrevista
2. Gere `SPEC.md` com `Docs/skills/SPEC-DRIVEN.md`
3. Aguarde **Aprovação TI** (`Docs/projeto/APROVACAO-TI.md`) antes de implementar
4. Implemente com `Docs/skills/INCREMENTAL.md`
5. Revise com `Docs/skills/CODE-REVIEW.md`

## Regras sempre ativas

- `Docs/design-system/DESIGN-SYSTEM.md`
- `Docs/stack/STACK.md`
- `Docs/stack/CONVENTIONS.md`

## UI shadcn (ao implementar telas)

- Skill do projeto: `.agents/skills/shadcn/` — [documentação shadcn](https://ui.shadcn.com/docs/skills)
- Monorepo: `npx shadcn@latest … -c frontend` a partir da raiz
- `Docs/design-system/DESIGN-SYSTEM.md` prevalece sobre padrões genéricos da skill

## Segurança (condicional — conforme SPEC)

Consulte `Docs/seguranca/README.md` quando o projeto tratar dados pessoais, perfis ou auditoria:

- `Docs/seguranca/LGPD.md`
- `Docs/seguranca/RBAC.md`
- `Docs/seguranca/AUDITORIA-LOGS.md`

## Cenários de entrevista

Após confirmar o tipo de projeto, leia o cenário correspondente em `Docs/entrevista/scenarios/`:

- `landing-page.md`
- `dashboard.md`
- `sistema-interno.md`

## Referências visuais no molde (não substituem o SPEC)

- `/dashboard` — KPIs, filtro, tabela, export CSV
- `/pedidos/listagem` — DataTable, busca, estados UI
- `/exemplo/formulario` — Field + react-hook-form + Zod
- `/exemplo/landing` — página pública

Documentação de processo: `Docs/projeto/PILOTO-CHECKLIST.md`, `MENSAGENS-PRONTAS.md`, `MATRIZ-TEMPLATE.md`
