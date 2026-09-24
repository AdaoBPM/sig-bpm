# Cenário: Sistema Interno

Leia este arquivo após confirmar com o usuário que o projeto é um sistema interno — CRM, gestão de pedidos, controle de estoque, ou qualquer sistema com cadastros, fluxos e permissões.

---

## Contexto do Cenário

Sistemas internos da BPM geralmente se encaixam em um destes perfis:
- Gestão de pedidos (criação, acompanhamento, aprovação, entrega)
- CRM simplificado (cadastro de clientes, histórico, follow-up)
- Controle de produção (ordens, etapas, apontamentos)
- Gestão de estoque (entradas, saídas, inventário)
- Gestão de RH interno (colaboradores, escalas, ocorrências)
- Sistema de aprovação (requisições, workflows com etapas)

---

## Perguntas Específicas para Sistemas Internos

### Entidades Principais
- **Quais são as "coisas" que o sistema gerencia?** (ex: pedidos, clientes, produtos, funcionários, obras)
- Para cada entidade: quais são os dados mais importantes que precisam ser registrados?
- Quais entidades se relacionam entre si? (ex: um pedido pertence a um cliente e tem vários produtos)

### Fluxo e Status
- As entidades têm um ciclo de vida? (ex: pedido vai de "novo" → "aprovado" → "em produção" → "entregue")
- Quem pode mudar o status? Qualquer usuário ou só quem tem permissão específica?
- Precisa de histórico de alterações? (ex: log de quem mudou o status e quando)
- Precisa de notificações quando algo muda? (e-mail, dentro do sistema)

### Permissões e Usuários
- Quem vai usar o sistema? Quais departamentos ou cargos?
- Diferentes usuários precisam ver ou fazer coisas diferentes?
  - Exemplo: vendedor cria pedido, gerente aprova, financeiro vê relatório
- Precisa de login com autenticação? Ou é interno sem senha?
- Tem integração com Active Directory / SSO da empresa?

### Operações CRUD
- Para cada entidade: quais operações o sistema precisa? (criar, editar, excluir, listar, detalhar)
- Alguma operação tem regras especiais? (ex: não pode excluir pedido aprovado, não pode editar depois de X horas)
- Precisa de importação em massa? (Excel, CSV)
- Precisa de exportação? (relatórios em PDF/Excel)

### Dados e Integrações
- Tem banco de dados existente ou é um sistema novo do zero?
- Precisa integrar com algum sistema externo? (ERP, financeiro, e-mail, WhatsApp)
- Tem dados históricos que precisam ser migrados?

### Relatórios
- Precisa de algum relatório imprimível ou exportável?
- Quais métricas ou resumos são importantes para a gestão?

---

**Estratégia de autenticação:** NextAuth.js (quando login necessário) ou middleware simples de token.

**Estratégia de dados:**
- Listagens e detalhes: Server Components + Prisma direto (sem API)
- Criação/edição/exclusão: Server Actions com validação Zod
- Operações complexas de negócio: chamar o backend Express via fetch

---

## Mapeamento de Entidades (faça isso antes do SPEC)

Para cada entidade identificada na entrevista, preencha:

```
Entidade: [Nome]
Campos: [lista de campos com tipo]
Status possíveis: [se tiver ciclo de vida]
Quem cria: [perfil de usuário]
Quem edita: [perfil de usuário]
Quem visualiza: [perfil de usuário]
Relações: [se relaciona com quais outras entidades]
Regras especiais: [restrições de negócio]
```

Apresente este mapeamento ao usuário para confirmação antes de gerar o SPEC.

---

## Checklist antes de gerar o SPEC

- [ ] Todas as entidades identificadas
- [ ] Relacionamentos entre entidades mapeados
- [ ] Ciclos de vida / status definidos
- [ ] Permissões por perfil de usuário confirmadas — ver [`Docs/seguranca/RBAC.md`](../../seguranca/RBAC.md)
- [ ] Dados pessoais mapeados (se houver) — ver [`Docs/seguranca/LGPD.md`](../../seguranca/LGPD.md)
- [ ] Eventos de auditoria definidos (se financeiro/RH/aprovações) — ver [`Docs/seguranca/AUDITORIA-LOGS.md`](../../seguranca/AUDITORIA-LOGS.md)
- [ ] Operações CRUD definidas por entidade
- [ ] Integrações externas identificadas
- [ ] Necessidades de relatório/exportação confirmadas
- [ ] Mapeamento de entidades apresentado e confirmado pelo usuário
- [ ] Fora do escopo definido explicitamente
