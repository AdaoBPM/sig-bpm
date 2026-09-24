# Cenário: Dashboard

Leia este arquivo após confirmar com o usuário que o projeto é um dashboard ou painel de métricas.

---

## Contexto do Cenário

Dashboards da BPM geralmente se encaixam em um destes perfis:
- Painel de acompanhamento de produção (volume, metas, andamento)
- Painel de métricas comerciais (vendas, pedidos, clientes)
- Painel de logística (entregas, estoque, movimentações)
- Painel gerencial (KPIs consolidados para tomada de decisão)

---

## Perguntas Específicas para Dashboards

### Dados — A parte mais crítica
- **De onde vêm os dados?** Esta é a pergunta mais importante. Opções comuns:
  - Banco de dados próprio (novo ou existente)
  - API de sistema externo (ERP, CRM, planilha, etc.)
  - Arquivo importado (CSV, Excel)
  - Combinação de fontes
- Se for API externa: tem documentação? Tem credenciais de acesso?
- Se for banco existente: qual banco? (MySQL, PostgreSQL, SQL Server?) Tem acesso?
- Com que frequência os dados mudam? (tempo real, a cada hora, diário)

### Métricas e Visualizações
- Quais são os 3-5 números mais importantes que precisam aparecer? (ex: volume produzido hoje, pedidos pendentes, meta do mês)
- Precisa de gráficos? Quais tipos? (barras, linhas, pizza, área)
- Precisa de tabela detalhada além dos gráficos?
- Tem algum KPI que precisa de alerta visual quando está fora do esperado?

### Filtros e Período
- O usuário precisa filtrar os dados? Por quê? (período, filial, produto, vendedor)
- Qual o período padrão ao abrir? (hoje, últimos 7 dias, mês atual)
- Precisa comparar períodos? (este mês vs. mês anterior)

### Atualização dos Dados
- Os dados precisam atualizar automaticamente sem recarregar a página?
- Qual intervalo de atualização é aceitável? (5 minutos, 1 hora, manual)

### Acesso e Permissões
- Quem pode ver o quê? Todos veem tudo ou há informações restritas?
- Precisa de login? Múltiplos perfis de acesso?

### Exportação
- Precisa exportar dados? (PDF, Excel, CSV)

---


**Estratégia de dados:**
- Dados iniciais: Server Component com fetch direto ao banco/API
- Atualização em tempo real ou por filtro do cliente: TanStack Query com `refetchInterval`
- Exportação: Server Action gerando arquivo

---

## Atenção: Bibliotecas de Gráfico

A stack padrão não inclui uma lib de gráficos. Ao identificar necessidade de gráficos, confirme com o usuário:

> "Para os gráficos, vou precisar de uma biblioteca adicional. As opções aprovadas são:
> - **Recharts** — mais simples, React-first, boa documentação
> - **Chart.js + react-chartjs-2** — mais completo, mais customizável
> Qual prefere?"

---

## Checklist antes de gerar o SPEC

- [ ] Fonte de dados identificada e acessível
- [ ] Lista de métricas/KPIs definida
- [ ] Tipos de visualização confirmados
- [ ] Frequência de atualização definida
- [ ] Filtros necessários listados
- [ ] Permissões de acesso definidas
- [ ] Necessidade de exportação confirmada
- [ ] Fora do escopo definido explicitamente
