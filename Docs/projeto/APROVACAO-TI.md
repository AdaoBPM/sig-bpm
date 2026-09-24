# Aprovação TI — Portão antes do desenvolvimento

> **Público:** equipe de TI da BPM.  
> **Quando usar:** após o solicitante confirmar o `SPEC.md` — **antes** de qualquer implementação.

Este documento **não repete** a entrevista nem o SPEC. Ele confirma que o projeto foi analisado pela TI e está autorizado a entrar em desenvolvimento.

---

## Posição no fluxo

```
Entrevista (IA) → SPEC.md confirmado pelo solicitante → [ESTE DOCUMENTO] → Implementação
```

A IA **não deve implementar código** enquanto este checklist não estiver aprovado pela TI, salvo orientação explícita da TI para protótipo descartável.

---

## Identificação do projeto

```
Nome do sistema:      _______________________________________________
Solicitante (área):   _______________________________________________
Responsável TI:       _______________________________________________
Data da análise:      ___/___/______
Repositório / branch: _______________________________________________
SPEC.md confirmado:   [ ] Sim — data: ___/___/______
```

---

## Bloco 1 — Verificação do SPEC

Confirme que o `SPEC.md` na raiz do projeto está completo e coerente.

| # | Item | OK | N/A |
|---|---|---|---|
| 1.1 | Objetivo e usuários definidos claramente | [ ] | |
| 1.2 | Seção **"O que NÃO está incluído"** preenchida | [ ] | |
| 1.3 | Tipo de projeto coerente (`landing-page`, `dashboard`, `sistema-interno`) | [ ] | |
| 1.4 | Integrações externas identificadas (TOTVS, e-mail, etc.) | [ ] | [ ] |
| 1.5 | Dados pessoais / LGPD avaliados (se aplicável) | [ ] | [ ] |
| 1.6 | Critérios de sucesso mensuráveis | [ ] | |
| 1.6b | Anexo `CRITERIOS-SUCESSO.md` preenchido (se projeto grande) | [ ] | [ ] |
| 1.7 | Stack alinhada ao `Docs/stack/STACK.md` ou exceções documentadas no SPEC | [ ] | |

---

## Bloco 2 — Viabilidade técnica

| # | Item | OK | N/A | Observação |
|---|---|---|---|---|
| 2.1 | Escopo da V1 é realizável com a stack padrão | [ ] | | |
| 2.2 | Integrações necessárias têm acesso/credenciais viáveis | [ ] | [ ] | |
| 2.3 | Não duplica sistema existente sem justificativa | [ ] | | |
| 2.4 | Ambiente de homologação previsto antes de produção | [ ] | | |
| 2.5 | Estimativa de prazo registrada | [ ] | | |
| 2.6 | Riscos técnicos documentados (se houver) | [ ] | [ ] | |

**Riscos identificados:**

```
_____________________________________________________________________________
_____________________________________________________________________________
```

---

## Bloco 3 — Segurança e dados

| # | Item | OK | N/A |
|---|---|---|---|
| 3.1 | Dados pessoais: medidas LGPD definidas (se aplicável) — ver `Docs/seguranca/LGPD.md` | [ ] | [ ] |
| 3.2 | Autenticação necessária? Coerente com o SPEC | [ ] | [ ] |
| 3.3 | Permissões por perfil definidas (se sistema interno) — ver `Docs/seguranca/RBAC.md` | [ ] | [ ] |
| 3.4 | Dados sensíveis não expostos indevidamente | [ ] | |
| 3.5 | Retenção / exclusão de dados considerada | [ ] | [ ] |
| 3.6 | Auditoria de eventos sensíveis definida (se aplicável) — ver `Docs/seguranca/AUDITORIA-LOGS.md` | [ ] | [ ] |

---

## Bloco 4 — Governança

| # | Item | OK | N/A |
|---|---|---|---|
| 4.1 | Repositório Git definido (org BPM ou fork autorizado) — **cópia do molde**, não commits em `projeto-padrao-bpm` | [ ] | |
| 4.2 | Responsável técnico pelo projeto nomeado | [ ] | |
| 4.3 | Prioridade acordada com a gestão da área | [ ] | |
| 4.4 | Solicitante ciente de que auth/dashboard do template são **referência**, não escopo fixo | [ ] | |

---

## Bloco 5 — Decisão

```
[ ] APROVADO — pode iniciar implementação incremental
[ ] APROVADO COM RESSALVAS — ver observações abaixo
[ ] AGUARDANDO — pendências antes de desenvolver
[ ] NÃO APROVADO — projeto pausado ou encerrado nesta fase
```

**Observações / ressalvas:**

```
_____________________________________________________________________________
_____________________________________________________________________________
```

**Pendências (se AGUARDANDO):**

```
_____________________________________________________________________________
_____________________________________________________________________________
```

---

## Assinaturas

```
Responsável TI:      _______________________________  Data: ___/___/______

Responsável negócio: _______________________________  Data: ___/___/______
```

---

## Para a IA (Cursor / Claude)

Quando o solicitante confirmar o SPEC, informe:

> "O SPEC está confirmado. Antes de implementar, o projeto precisa passar pela **Aprovação TI** (`Docs/projeto/APROVACAO-TI.md`). Aguarde a TI preencher e aprovar este checklist — ou confirme explicitamente que a TI já aprovou."

**Não inicie o Passo 1 de implementação** sem uma destas confirmações:

- "TI aprovou" / "checklist TI preenchido" (com contexto claro), ou
- Instrução explícita da TI para protótipo descartável fora do fluxo formal

---

## O que não verificar aqui

| Tema | Onde está |
|---|---|
| Entrevista e descoberta | `Docs/entrevista/INTERVIEW.md` |
| Conteúdo do escopo | `SPEC.md` |
| RF/RNF detalhados | `Docs/skills/SPEC-DRIVEN.md` |
| Critérios de go-live | `Docs/projeto/CRITERIOS-SUCESSO.md` |
| Como criar repo do solicitante | `Docs/projeto/COMO-CRIAR-SEU-PROJETO.md` |
| Como implementar | `Docs/skills/INCREMENTAL.md` |
| Stack e pastas | `Docs/stack/STACK.md`, `CONVENTIONS.md` |
| RNFs detalhados (projetos grandes) | Complemento futuro — preencher se TI exigir |
