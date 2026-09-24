# Processo de Entrevista

Este documento define como conduzir a entrevista inicial com o usuário antes de qualquer planejamento ou código. Siga rigorosamente este processo.

---

## Objetivo

Descobrir o que o usuário **realmente** precisa construir — não apenas o que ele pediu. O que as pessoas pedem e o que elas precisam são coisas diferentes. A entrevista fecha essa lacuna antes de qualquer código existir.

---

## Quando Aplicar

- Sempre que o usuário iniciar um novo projeto neste repositório
- Quando o pedido for vago ("quero um sistema", "faz um dashboard pra mim")
- Quando o usuário descrever o projeto mas faltarem informações técnicas essenciais
- Quando houver ambiguidade sobre o tipo de projeto, usuários, dados ou integrações

---

## Processo

### Passo 1 — Formule uma hipótese inicial

Antes de perguntar qualquer coisa, escreva internamente sua melhor interpretação do que o usuário quer, com um número de confiança (0–100%):

```
HIPÓTESE: [uma frase sobre o que o usuário quer construir]
CONFIANÇA: ~X% — falta: [o que ainda não sabe]
```

Seja honesto com o número. Se não consegue prever as próximas respostas do usuário, o número é baixo.

---

### Passo 2 — Identifique o tipo de projeto

Antes de mergulhar nos detalhes, confirme o tipo de projeto. Isso determina qual cenário de entrevista carregar.

| O usuário quer... | Tipo |
|---|---|
| Página de divulgação, captação de leads, apresentação de produto/serviço | `landing-page` |
| Painel com métricas, gráficos, acompanhamento de indicadores | `dashboard` |
| Sistema com cadastros, fluxos, permissões, gestão de entidades | `sistema-interno` |

Confirme com o usuário antes de avançar:

> "Pelo que você descreveu, parece que estamos falando de um **[tipo]**. Está correto?"

Se o usuário corrigir, ajuste. Após a confirmação, leia o arquivo de cenário correspondente em `Docs/entrevista/scenarios/`.

**Formulário opcional:** se o usuário já preencheu `Docs/projeto/FORMULARIO-RASCUNHO-NEGOCIO.md`, use como contexto — mas **não pule** as perguntas da entrevista.

---

### Passo 3 — Faça uma pergunta por vez

**Regra fundamental: uma pergunta por vez, com sua hipótese anexada.**

Formato obrigatório:
```
Q: [uma pergunta focada e específica]
HIPÓTESE: [sua suposição sobre a resposta, com o raciocínio que a gerou]
```

Por que uma pergunta por vez:
- O usuário não consegue reagir a múltiplas hipóteses ao mesmo tempo
- A terceira pergunta frequentemente depende da resposta da primeira
- Listas de perguntas incentivam respostas superficiais

Por que anexar a hipótese:
- O usuário reage mais rápido a uma hipótese errada do que gera uma resposta do zero
- Expõe suas suposições — que é exatamente o que a entrevista deve revelar

---

### Passo 4 — Interprete as respostas com cuidado

Fique atento a respostas que soam corretas mas são vagas:

| Sinal de alerta | O que fazer |
|---|---|
| "Quero que seja escalável" | Perguntar: "O que 'escalável' significa neste caso?" |
| "Igual ao sistema atual mas melhor" | Perguntar: "O que especificamente precisa ser diferente?" |
| "Quero algo moderno" | Perguntar: "Modernidade para você significa visual, performance ou facilidade de uso?" |
| "Padrão do mercado" | Perguntar: "Tem algum sistema existente que você gosta como referência?" |

Quando ouvir respostas genéricas, pergunte:
> "Se não precisasse justificar para ninguém, o que você realmente precisaria?"

---

### Passo 5 — Reescreva a intenção confirmada

Quando a confiança atingir ~95%, escreva de volta o que entendeu. Use o formato:

```
Aqui está o que entendi que você quer construir:

- Objetivo:       [uma linha — o que o sistema faz]
- Usuários:       [quem vai usar]
- Dados:          [de onde vêm, o que é armazenado, LGPD se aplicável]
- Integrações:    [TOTVS, e-mail, planilhas, APIs externas]
- Ambiente:       [dispositivos, rede, restrições de uso]
- Sucesso:        [como saberemos que funcionou]
- Fora do escopo: [o que NÃO será construído nesta versão]

Posso avançar para o SPEC com base nisso?
```

A linha **"Fora do escopo"** é obrigatória. Metade dos mal-entendidos vem de discordância silenciosa sobre o que **não** será feito.

---

### Passo 6 — Confirmação explícita

O gate é um "sim" explícito. Os seguintes **não** são confirmação:

- "Pode ser" → Repergunte com opções concretas
- "Tá bom" → Pergunte: "Tem algo que você mudaria?"
- "Vai em frente" → Só aceite se a reafirmação foi clara e específica
- Silêncio → Não é confirmação

---

## O Teste de 95%

Você atingiu a confiança necessária quando consegue responder **sim** a esta pergunta:

> "Consigo prever a reação do usuário às próximas três perguntas que faria?"

Se sim, escreva a reafirmação de intenção (Passo 5). Se não, continue com mais perguntas.

---

## Perguntas Universais (para qualquer tipo de projeto)

Independente do cenário, estas perguntas **precisam** ser respondidas antes do SPEC (uma por vez, com hipótese):

### Essenciais

1. **Quem usa?** Funcionários internos? Clientes externos? Quantas pessoas aproximadamente?
2. **Precisa de login?** Autenticação simples ou múltiplos níveis de permissão?
3. **De onde vêm os dados?** Banco novo? Integração? Planilha? Manual?
4. **Qual o prazo ou prioridade?** Define o escopo da V1.
5. **Tem referência visual?** Algum sistema bem feito como modelo?

### Dados e conformidade

6. **Dados pessoais?** Nome, CPF, contato de funcionários ou clientes → implica LGPD; registrar no SPEC e consultar `Docs/seguranca/LGPD.md`.
7. **Retenção e exclusão:** por quanto tempo guardar dados? algo que nunca pode ser apagado (auditoria/legal)?
8. **Tipos sensíveis:** financeiro, RH, documentos — afetam permissões e segurança.

### Integrações BPM (perguntar se relevante)

9. **TOTVS RM?** Só leitura, criar registros, sincronizar cadastros? Credenciais existem?
10. **Outros internos:** Senior (RH), n8n, e-mail corporativo, planilhas compartilhadas?
11. **Externos:** WhatsApp, APIs de terceiros, webhooks?

### Ambiente e uso

12. **Dispositivos:** só desktop, mobile, ambos?
13. **Rede/offline:** precisa funcionar sem internet ou fora da rede BPM?
14. **Restrições físicas:** ambiente ruidoso, operador com luvas, tela visível à distância, etc.?

> Nem toda pergunta se aplica a todo projeto. Para **landing page**, pule login/RBAC. Para **dashboard**, priorize fonte de dados. Use o cenário específico para aprofundar.

---

## O que fazer após a confirmação

1. Gere o `SPEC.md` seguindo `Docs/skills/SPEC-DRIVEN.md`
2. Aguarde confirmação explícita do SPEC pelo solicitante
3. Informe que o projeto segue para **Aprovação TI** (`Docs/projeto/APROVACAO-TI.md`)
4. **Não escreva código** até a TI aprovar — ou o solicitante confirmar explicitamente que a TI já aprovou

---

## Sinais de Alerta (Red Flags)

- Você fez mais de 2 perguntas em uma mensagem — isso é batching, não entrevista
- Uma pergunta sem hipótese anexada — você está pesquisando, não comprometendo-se
- Você aceitou "como você achar melhor" como resposta final — repergunte com opções concretas
- Você começou a planejar ou escrever código antes da confirmação do SPEC — pare e volte
- Você implementou antes da **Aprovação TI** — pare e aguarde
- Sua confiança não subiu após 3+ rodadas — você está fazendo as perguntas erradas, reformule
