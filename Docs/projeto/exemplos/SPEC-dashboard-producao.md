# SPEC — Dashboard de Produção (exemplo fictício)

> **Este arquivo é referência** — não é o contrato do seu projeto.  
> A IA deve gerar um `SPEC.md` na **raiz** do seu repositório após a entrevista real.

---

## Metadados

| Campo | Valor |
|---|---|
| Projeto | Dashboard Produção — Chão de Fábrica |
| Tipo | `dashboard` |
| Solicitante | Maria Silva — Supervisão de Produção |
| Versão SPEC | 1.0 |
| Data | 2026-06-26 |
| Status | **Exemplo** — aguardaria confirmação + TI em projeto real |

---

## 1. Problema

Supervisores acompanham produção e refugo em planilhas dispersas. Precisam de um painel único com números do dia e tendência da semana, atualizado ao fim de cada turno.

---

## 2. Objetivo (V1)

Painel web interno com login BPM, exibindo KPIs e gráfico de produção vs meta, filtrável por período (7 / 30 dias). Sem integração TOTVS na V1 — dados inseridos manualmente ou importados via planilha (definir na V1.1).

---

## 3. Usuários

| Perfil | Quantidade | Permissões |
|---|---|---|
| Supervisor | ~8 | `dashboard:view`, `producao:edit` |
| Gerente produção | ~3 | `dashboard:view`, `producao:edit`, `relatorios:export` |
| Visualização | ~15 | `dashboard:view` |

---

## 4. Escopo V1 — incluído

- [ ] Login com usuários BPM (template auth em dev; Postgres em homolog)
- [ ] Dashboard com 3 KPIs: produção do dia, % meta, refugo
- [ ] Gráfico linha: produção vs meta (7 dias padrão; filtro 30 dias)
- [ ] Tabela “últimos lançamentos” (mock ou CRUD simples)
- [ ] Export CSV dos dados visíveis no filtro
- [ ] Auditoria de acesso à tela (`ACESSO` — ver AUDITORIA-LOGS.md)
- [ ] Layout BPM (sidebar, cores oficiais)

---

## 5. Escopo V1 — explicitamente fora

- Integração TOTVS RM / SOAP
- App mobile
- Notificações push / e-mail automático
- Edição em tempo real no chão de fábrica (tablets offline)
- Multi-filial

---

## 6. Requisitos funcionais (RF)

| ID | Descrição | Prioridade |
|---|---|---|
| RF-01 | Usuário autenticado acessa `/dashboard` com KPIs do período selecionado | Must |
| RF-02 | Filtro de período altera KPIs e gráfico sem recarregar página inteira | Must |
| RF-03 | Supervisor registra lançamento manual (data, quantidade, turno) | Should |
| RF-04 | Gerente exporta CSV do período filtrado | Should |
| RF-05 | Usuário sem permissão não vê botão de export | Must |

---

## 7. Requisitos não funcionais (RNF)

| ID | Descrição |
|---|---|
| RNF-01 | Tempo de carregamento inicial < 3s em rede interna |
| RNF-02 | HTTPS em homolog/prod |
| RNF-03 | Logs de acesso sem dados sensíveis (AUDITORIA-LOGS.md) |
| RNF-04 | RBAC no backend para rotas de escrita |

Detalhes de API: `Docs/projeto/anexos/RNF-API-SEGURA.md` (se aplicável).

---

## 8. Dados

| Fonte V1 | Destino |
|---|---|
| Entrada manual / import CSV futuro | PostgreSQL (`LancamentoProducao`) |
| Auth | Tabela `usuarios` + permissões |

Sem TOTVS na V1.

---

## 9. Critérios de sucesso

Ver também [CRITERIOS-SUCESSO.md](../CRITERIOS-SUCESSO.md).

- 80% dos supervisores usam o painel ao menos 1x por turno após 2 semanas
- Redução de 50% no tempo para montar relatório semanal (vs planilha)
- Zero incidente de acesso não autorizado em homolog

---

## 10. Riscos e dependências

| Risco | Mitigação |
|---|---|
| Dados manuais desatualizados | Treinamento + responsável por turno |
| Postgres não disponível em dev | Template auth + mock até TI provisionar |

---

## 11. Aprovações

| Papel | Nome | Data | Status |
|---|---|---|---|
| Negócio | Maria Silva | — | Exemplo |
| TI | — | — | Pendente em projeto real |

---

## 12. Referências no molde

- Visual: `/dashboard`, `/pedidos/listagem`, `/exemplo/formulario`
- Docs: `scenarios/dashboard.md`, `DESIGN-SYSTEM.md`, `INCREMENTAL.md`
