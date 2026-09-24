# Critérios de Sucesso do Projeto

> **Para quem não é da área de TI:** Este documento define antecipadamente o que significa "o projeto deu certo". Sem critérios claros, um sistema pode ser entregue tecnicamente correto mas não resolver o problema real.

> **Para a IA:** Use na entrevista e no `SPEC.md`. Projetos simples (landing page, dashboard pequeno) podem manter critérios só no SPEC. Projetos **sistema-interno** com múltiplos módulos podem usar este documento como anexo formal.

---

## Identificação

```
Sistema:         _______________________________________________
Solicitante:     _______________________________________________
Data:            ___/___/______
SPEC.md:         [ ] Confirmado
Aprovação TI:    [ ] Registrada (Docs/projeto/APROVACAO-TI.md)
```

---

## Critérios de Sucesso de Negócio

> Definidos **pelo responsável da área**, não pela TI.

### Redução de trabalho manual

```
Processo atual (antes): _______________________________________________
Meta (após o sistema):  _______________________________________________
Como medir:             _______________________________________________
Prazo para medir:       _____ dias/meses após o go-live
```

**Exemplos válidos:**
- "Reduzir de 2 horas para 15 minutos o fechamento de caixa"
- "Eliminar a planilha Excel de controle de X"
- "Zero registros perdidos de Y por mês"

### Centralização das informações

```
Informação hoje dispersa em: _______________________________________________
Meta pós-sistema:             _______________________________________________
```

### Outros critérios de negócio

| Critério | Situação atual | Meta | Como medir |
|---|---|---|---|
| | | | |
| | | | |

---

## Critérios de Sucesso de Usuário

> Definidos com os usuários finais.

| Critério | Meta | Como medir |
|---|---|---|
| Interface intuitiva | Usuário completa tarefa principal sem treinamento | Teste com usuário novo |
| Treinamento necessário | Máximo ___ h para uso básico | Sessão de onboarding |
| Satisfação | NPS >= ___ após 30 dias | Pesquisa |
| Erros de operação | < ___ erros/semana nos primeiros 30 dias | Logs ou feedback |

---

## Critérios de Sucesso Técnico

> Validados pela TI. **Adapte ao tamanho do projeto** — nem todo item se aplica a landing page ou MVP.

### Pré-lançamento (quando aplicável)

- [ ] Ambiente de homologação testado com casos reais
- [ ] Autenticação e permissões validadas (se houver login)
- [ ] Integrações críticas testadas (TOTVS, e-mail, etc.)
- [ ] Dados pessoais / LGPD revisados (se aplicável)
- [ ] Variáveis de ambiente documentadas
- [ ] CI/CD e monitoramento — **se exigido pelo TI** no checklist de aprovação

---

## Definition of Done (DoD)

### Por funcionalidade

1. **Implementado** conforme SPEC ou RF correspondente
2. **Revisado** — `Docs/skills/CODE-REVIEW.md` aplicado
3. **Testado** em homologação com cenário real
4. **Aceito** pelo solicitante com critério de aceite explícito

### Por projeto (go-live)

1. Escopo V1 do SPEC entregue e aceito
2. RNFs críticos atendidos (ver SPEC ou anexo RNF)
3. Aprovação TI registrada
4. Usuários-chave treinados (se sistema interno)
5. Plano de suporte inicial acordado

---

## Métricas pós-lançamento (opcional)

| Métrica | Frequência | Responsável |
|---|---|---|
| Usuários ativos | Semanal | Gestor da área / TI |
| Tempo de resposta | Diária (se monitorado) | TI |
| Erros reportados | Semanal | TI |
| Satisfação | Mensal | Gestor da área |

---

## Revisão

Revisar com o solicitante **30, 60 e 90 dias** após o go-live para verificar se os critérios foram atingidos.

---

## Relação com outros documentos

| Documento | Papel |
|---|---|
| `SPEC.md` | Critérios resumidos na seção "Critérios de Sucesso" |
| `Docs/skills/SPEC-DRIVEN.md` | RF/RNF detalhados quando o projeto exigir |
| `Docs/projeto/APROVACAO-TI.md` | Gate antes do desenvolvimento |
| `Docs/seguranca/` | LGPD, RBAC, auditoria (condicional) |
| `Docs/projeto/anexos/RNF-API-SEGURA.md` | RNFs de API quando houver módulo REST exposto |
