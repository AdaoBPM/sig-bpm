# Skill: Geração de SPEC

Este documento define como gerar o `SPEC.md` após a entrevista e antes de qualquer código.

---

## Quando Usar

Após atingir ~95% de confiança na entrevista, use este processo para gerar o documento de especificação do projeto.

**Nunca gere código antes de ter um SPEC confirmado pelo usuário.**

---

## O que é o SPEC

O `SPEC.md` é o contrato entre você (IA) e o usuário. Ele define:
- O que será construído
- O que **não** será construído nesta versão
- As entidades, telas e fluxos principais (conforme o tipo de projeto)
- A stack e dependências confirmadas
- Os critérios de sucesso

Após confirmado, o SPEC guia toda a implementação. Qualquer mudança de escopo deve ser discutida e atualizada no SPEC — nunca implementada silenciosamente.

A interface visual segue `Docs/design-system/DESIGN-SYSTEM.md` por padrão — não repita tokens de cor no SPEC, salvo exceções acordadas com o usuário.

---

## Como Montar o SPEC

Use o template base abaixo e **inclua apenas as seções aplicáveis** ao tipo confirmado na entrevista:

| Tipo | Seções obrigatórias além do núcleo comum |
|---|---|
| `landing-page` | Conteúdo e Seções, Formulário e Destino dos Dados |
| `dashboard` | Fontes de Dados e KPIs, Gráficos e Filtros |
| `sistema-interno` | Entidades e Dados (formato completo), Autenticação e Permissões |

**Núcleo comum (todos os tipos):** Objetivo, Usuários, Problema, Escopo V1, Telas e Fluxos, Integrações e Acesso, Stack, Variáveis de Ambiente, Critérios de Sucesso, Plano de Implementação.

Remova do SPEC final as seções que não se aplicam — não deixe blocos vazios com "N/A".

---

## Requisitos Funcionais e Não Funcionais (RF/RNF)

O molde **não exige** RF001–RF003 fixos (auth, usuários, RBAC). Cada projeto define seus próprios requisitos a partir da entrevista.

| Tamanho do projeto | O que usar |
|---|---|
| Landing page, dashboard pequeno, MVP simples | Seção **Critérios de Sucesso** no SPEC + checkboxes de escopo |
| Sistema interno com vários módulos ou API exposta | Seções **Requisitos Funcionais** e **Requisitos Não Funcionais** abaixo |
| Go-live formal com métricas de negócio | Anexo [`Docs/projeto/CRITERIOS-SUCESSO.md`](../projeto/CRITERIOS-SUCESSO.md) |
| API REST consumível por outros sistemas | Anexo [`Docs/projeto/anexos/RNF-API-SEGURA.md`](../projeto/anexos/RNF-API-SEGURA.md) |
| Dados pessoais (LGPD) | [`Docs/seguranca/LGPD.md`](../seguranca/LGPD.md) — inventário no SPEC |
| Múltiplos perfis / permissões | [`Docs/seguranca/RBAC.md`](../seguranca/RBAC.md) — matriz no SPEC |
| Trilha de compliance / aprovações | [`Docs/seguranca/AUDITORIA-LOGS.md`](../seguranca/AUDITORIA-LOGS.md) |

**Formato RF (quando incluir):**

```markdown
## RF001 — [Nome]
**Prioridade:** P1 | P2 | P3
**Perfil:** [quem usa]

**Descrição:** [o que o sistema faz]

**Critério de aceite:**
- [ ] [mensurável e testável]
- [ ] [mensurável e testável]
```

**Prioridades:** P1 = bloqueia lançamento · P2 = importante, pode ir para V2 · P3 = desejável

**Formato RNF (quando incluir):**

```markdown
## RNF001 — [Categoria: Performance | Segurança | Disponibilidade]
| Requisito | Valor |
|---|---|
| [métrica] | [limite] |
```

RNFs padrão do template (auth com JWT, HTTPS, Zod, rate limit) já estão na stack — **documente no SPEC apenas exceções ou metas específicas** (ex.: "relatório X em < 5s", "99% uptime").

---

## Template do SPEC.md

```markdown
# SPEC — [Nome do Projeto]

**Data:** [data de criação]
**Tipo:** [landing-page | dashboard | sistema-interno]
**Status:** Aguardando confirmação | Confirmado | Em desenvolvimento | Concluído

---

## Objetivo

[Uma ou duas frases descrevendo o que o sistema faz e para quem.]

## Usuários

[Quem vai usar o sistema. Ex: "Funcionários do setor comercial — aproximadamente 5 usuários."]

## Problema que Resolve

[O que existia antes e por que o sistema atual é necessário.]

---

## Escopo desta Versão (V1)

### O que ESTÁ incluído
- [ ] [Feature 1]
- [ ] [Feature 2]
- [ ] [Feature 3]

### O que NÃO está incluído (fora do escopo)
- [Item explicitamente fora desta versão]
- [Item para versão futura]

---

## Telas e Fluxos

| Tela | Rota | Descrição |
|---|---|---|
| [Nome] | `/rota` | [O que o usuário faz aqui] |

### Fluxo Principal
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

---

<!-- INCLUIR APENAS PARA: landing-page -->

## Conteúdo e Seções

| Seção | Descrição | Conteúdo pronto? |
|---|---|---|
| Hero | [headline, CTA principal] | Sim / IA deve sugerir |
| [Benefícios / FAQ / etc.] | [descrição] | Sim / IA deve sugerir |

**Referência visual:** [URL ou sistema de referência, se houver]

## Formulário e Destino dos Dados

| Campo | Obrigatório | Validação especial |
|---|---|---|
| [nome] | Sim/Não | [ex: e-mail, telefone com máscara] |

**Destino dos dados:** [e-mail, webhook, planilha, CRM, etc.]
**SEO necessário:** Sim/Não — [meta tags, Open Graph, sitemap]
**Analytics:** [Google Analytics, Meta Pixel, nenhum]

---

<!-- INCLUIR APENAS PARA: dashboard -->

## Fontes de Dados e KPIs

| Fonte | Tipo | Frequência de atualização | Acesso disponível? |
|---|---|---|---|
| [ERP / banco / API / CSV] | [PostgreSQL / REST / arquivo] | [tempo real / horária / diária] | Sim / Pendente |

### KPIs Principais
| KPI | Descrição | Alerta visual? |
|---|---|---|
| [nome] | [o que mede] | Sim/Não — [condição] |

**Dados mock na V1:** Sim/Não — [quais KPIs usarão dados fictícios até a integração real]

## Gráficos e Filtros

| Visualização | Tipo | Dados |
|---|---|---|
| [nome] | [barras / linhas / pizza / tabela] | [fonte] |

**Filtros:** [período, filial, produto, vendedor, etc.]
**Período padrão ao abrir:** [hoje / últimos 7 dias / mês atual]
**Comparar períodos:** Sim/Não
**Exportação:** [PDF / Excel / CSV / nenhuma]
**Biblioteca de gráficos aprovada:** [Recharts / Chart.js — se aplicável]

---

<!-- INCLUIR APENAS PARA: sistema-interno -->

## Entidades e Dados

Para cada entidade identificada na entrevista:

### [Nome da Entidade]

**Campos:**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | UUID | Sim | Identificador único |
| [campo] | [tipo] | [S/N] | [descrição] |

**Status possíveis:** [novo → aprovado → entregue] ou N/A
**Quem cria:** [perfil de usuário]
**Quem edita:** [perfil de usuário]
**Quem visualiza:** [perfil de usuário]
**Relações:** [ex: pertence a Cliente, tem vários Itens]
**Regras especiais:** [ex: não pode excluir após aprovação]

---

## Autenticação e Permissões

**Login necessário:** Sim/Não
**Estratégia:** [NextAuth.js / token simples / SSO / sem autenticação]
**Perfis de usuário:**

| Perfil | Pode fazer |
|---|---|
| [ex: Vendedor] | [criar pedido, ver próprios pedidos] |
| [ex: Gerente] | [aprovar pedido, ver todos os pedidos] |

---

## Integrações e Acesso

| Sistema / Recurso | Finalidade | Status |
|---|---|---|
| [ERP / e-mail / WhatsApp / planilha] | [o que faz] | Disponível / Pendente / Fora do escopo V1 |

**Migração de dados históricos:** Sim/Não — [detalhes]
**Notificações:** [e-mail / dentro do sistema / nenhuma]

---

## Stack e Dependências

Use a stack padrão definida em `Docs/stack/STACK.md` e as convenções de `Docs/stack/CONVENTIONS.md`.
**Liste aqui apenas o que foge do padrão** ou decisões específicas deste projeto.

**Arquitetura:**
- [ ] Apenas Next.js (Server Actions + Prisma no mesmo projeto)
- [ ] Next.js + backend Express separado

**Quando usar backend separado:**
- Operações de negócio complexas ou long-running
- Integrações com sistemas legados que não cabem em Server Actions
- Necessidade de filas, jobs ou processamento assíncrono

**Quando NÃO usar backend separado:**
- Landing pages (quase sempre)
- Dashboards com dados vindos de uma única fonte acessível pelo Next.js
- CRUD simples com Prisma direto no Next.js

**Exceções à stack padrão neste projeto:**
- [ex: Recharts para gráficos — se aprovado na entrevista]
- [nenhuma]

---

## Variáveis de Ambiente

| Variável | Onde | Descrição |
|---|---|---|
| `DATABASE_URL` | frontend ou backend | Conexão com o banco |
| [outra] | [frontend/backend] | [descrição] |

---

## Critérios de Sucesso

- [ ] [Critério 1 — mensurável, preferencialmente de negócio]
- [ ] [Critério 2 — mensurável]

> Projetos maiores: complementar com `Docs/projeto/CRITERIOS-SUCESSO.md`

---

<!-- INCLUIR SE: sistema-interno com múltiplos módulos OU TI solicitar RF formal -->

## Requisitos Funcionais

| Código | Nome | Prioridade | Status |
|---|---|---|---|
| RF001 | [Nome] | P1 | Pendente |

### RF001 — [Nome]
**Prioridade:** P1
**Perfil:** [quem usa]

**Descrição:** [texto]

**Critério de aceite:**
- [ ] 
- [ ] 

---

<!-- INCLUIR SE: metas de performance, segurança extra ou API exposta -->

## Requisitos Não Funcionais

| Código | Categoria | Resumo |
|---|---|---|
| RNF001 | Performance | [ex: telas < 3s] |
| RNF002 | Segurança | [ex: ver anexo API] |

### RNF001 — [Categoria]
| Requisito | Valor |
|---|---|
| | |

**Anexos (se aplicável):**
- API segura: `Docs/projeto/anexos/RNF-API-SEGURA.md`
- Segurança: `Docs/seguranca/` (LGPD, RBAC, Auditoria — marcar no SPEC quais se aplicam)

## Anexos de segurança (marcar no SPEC)

- [ ] LGPD — [`Docs/seguranca/LGPD.md`](../seguranca/LGPD.md)
- [ ] RBAC — [`Docs/seguranca/RBAC.md`](../seguranca/RBAC.md)
- [ ] Auditoria — [`Docs/seguranca/AUDITORIA-LOGS.md`](../seguranca/AUDITORIA-LOGS.md)

---

## Plano de Implementação

[Preencher **após** confirmação do SPEC, antes do primeiro passo de código]

### Passo 1 — [Nome]
[Descrição em 1-2 frases. Resultado verificável pelo usuário.]

### Passo 2 — [Nome]
[Descrição em 1-2 frases.]

...
```

> Os comentários HTML (`<!-- INCLUIR APENAS PARA: ... -->`) são instruções para a IA — **não inclua esses comentários no SPEC.md final**.

---

## Como Apresentar o SPEC

1. Gere o SPEC completo baseado na entrevista e no tipo de projeto confirmado
2. Inclua apenas as seções aplicáveis — remova blocos irrelevantes ao tipo
3. Apresente ao usuário com a mensagem:

> "Aqui está o SPEC do projeto baseado na nossa conversa. Leia com atenção, especialmente a seção **'O que NÃO está incluído'**. Se estiver tudo correto, confirme para eu montar o plano de implementação e começar. Se precisar ajustar algo, me diga o que mudar."

4. Aguarde resposta explícita. Apenas "ok", "confirmo" ou "pode ir" com contexto são aceitos.
5. Se o usuário pedir mudanças, atualize o SPEC e reapresente antes de avançar.
6. Após confirmação do SPEC:
   - Atualize o **Status** para `Confirmado`
   - Salve como `SPEC.md` na raiz do projeto
   - Informe que o projeto segue para **Aprovação TI** — ver `Docs/projeto/APROVACAO-TI.md`
   - **Não implemente** até a TI aprovar ou o solicitante confirmar explicitamente que a TI já aprovou
7. Após aprovação TI:
   - Preencha a seção **Plano de Implementação** com passos pequenos e verificáveis (seguindo `Docs/skills/INCREMENTAL.md`)
   - Apresente o plano ao usuário e aguarde confirmação antes do Passo 1
   - Execute cada passo conforme `Docs/skills/INCREMENTAL.md`, pedindo confirmação entre passos
   - Ao final de cada feature relevante, aplique `Docs/skills/CODE-REVIEW.md`

---

## Regras

- O SPEC deve ter sempre a seção **"O que NÃO está incluído"** preenchida
- Nunca iniciar implementação com SPEC incompleto
- Nunca iniciar implementação sem **Aprovação TI** (`Docs/projeto/APROVACAO-TI.md`), salvo instrução explícita da TI
- Nunca iniciar o Passo 1 sem o **Plano de Implementação** preenchido e confirmado
- Se o escopo mudar durante a implementação, pause e atualize o SPEC antes de continuar
- Atualize os checkboxes de **"O que ESTÁ incluído"** conforme as features forem entregues
- O SPEC é um documento vivo — mantenha o **Status** e o plano atualizados conforme o projeto avança
