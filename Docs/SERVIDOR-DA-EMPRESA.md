# Servidor da Empresa — Registro para o TI

O SIG BPM do servidor 192.168.0.16 (frontend na porta 3010, docker compose) recebe o código do GitHub pelo deploy
automático (timer `sig-bpm-deploy`). O deploy leva **só o código**: a base de dados do servidor é própria, separada da
produção local (notebook, porta 3000). Por isso, toda alteração de dados feita na produção local (migração, script de
dados, recarga pela tela) precisa ser repetida no servidor.

Este documento junta tudo o que o TI precisa: o estado da base do servidor, as alterações a aplicar nela, em ordem, e
os pontos para a troca do SQLite pelo PostgreSQL. Ele é atualizado a cada publicação.

## A produção agora é o servidor (20/10/2026, regras do TI — Eduardo Domingos)

- **Produção:** http://192.168.0.16:3010 (servidor `srv-docker`). Banco SQLite em `/root/dados/sig-bpm/dados/dev.db`;
  uploads em `/root/dados/sig-bpm/dados/uploads/`. O notebook é só desenvolvimento: não usar `npm run producao` nele
  como produção, senão os dados se separam.
- **Deploy automático:** a cada 2 minutos um timer do systemd verifica a `master`. Commit novo → build, back-up do
  banco em `dados/backups/`, `prisma migrate deploy` e troca dos containers (log em `/root/dados/sig-bpm/deploy.log`).
  Ou seja, **enviar à master é publicar**. O deploy faz `git reset --hard origin/master`: código nunca se edita no
  servidor. Alterações de dados (scripts, recargas) continuam precisando rodar no servidor. Só o root (TI) para o timer.
- **Acesso:** `ssh srv-docker` (usuário `adao`, chave `~/.ssh/srv-docker` no notebook). Liberado para ler e editar,
  com as regras abaixo.
- **Servidor compartilhado:** roda também GDoc, intranet, n8n, evolution-api, Rocket.Chat, zabbix-mcp-server e um CRM.
  O usuário `adao` está no grupo `docker` (equivale a root). Disco em ~72% (22 GB livres); cada build gera imagens de
  vários GB.
- **Pode:** tudo dentro de `/root/dados/sig-bpm` e nos containers `sig-bpm-backend` e `sig-bpm-frontend`, sempre com
  `docker compose …` a partir de `/root/dados/sig-bpm`; logs com `docker compose logs --tail=100 backend`; scripts com
  `docker compose exec backend npx tsx scripts/<script>.ts …`; copiar arquivos para `/root/dados/sig-bpm/dados/`.
- **Nunca:** `docker system prune`, `docker volume prune`, `docker image prune -a`, `docker rm`/`stop`/`restart` sem
  `compose`, ou qualquer comando que atinja containers de fora do SIG; parar ou reiniciar o Docker ou o servidor; mexer
  fora de `/root/dados/sig-bpm`; alterar `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `deploy.sh` ou
  `sig-bpm.env` sem combinar com o TI (existem só no servidor); exibir ou copiar o `sig-bpm.env`.
- **Antes de gravar no banco de produção:** (1) simular (sem `--gravar`) e mostrar ao Adão; (2) pedir a aprovação dele;
  (3) conferir no `deploy.log` e no `docker compose ps` que não há deploy em andamento; (4) back-up:
  `cp dados/dev.db "dados/backups/dev-$(date +%F-%H%M)-antes-<motivo>.db"`; (5) gravar e conferir na tela. Para voltar:
  `docker compose stop backend && cp dados/backups/<arquivo>.db dados/dev.db && docker compose start backend`.
- **Trocar o banco inteiro (notebook → servidor):** nunca sozinho; o TI para o timer e confere a auditoria antes.
- **Em dúvida, ou se algo fora do SIG quebrar:** parar e avisar o TI (eduardo.domingos@bpm.com.br).

## Estado da base do servidor

- **19/10/2026, 17:48:** cópia inteira da base de produção local para o servidor (`Backups/2026-10-19 copia para o
  servidor/dev.db`, com o `LEIA-ME para o TI.txt`): 75 migrações, a última `20261019180000_indices_de_reajuste`;
  código no commit `be82694` (etiqueta `publicado-2026-10-19-descricao-dos-indices`).
- **A confirmar com o TI:** se a cópia foi aplicada no servidor. Se não foi, o servidor está antes dela, e o mais
  simples é fazer uma cópia nova (ver "Alternativa" abaixo).
- **A cópia levou só o banco**, sem a pasta `backend/uploads` (cerca de 400 MB): as planilhas importadas, que a
  Importação em Lote relê para comparar os meses, e as fotos e vídeos dos Relatórios Executivos. No servidor, essa pasta
  fica no `UPLOAD_DIR` do `.env`. Sem ela, as fotos dos relatórios não aparecem e a prévia do lote importa de novo o que
  não mudou.

## Alterações de dados a aplicar no servidor

Na ordem. Antes de cada bloco, guardar uma cópia da base do servidor.

### 1. Recarga dos centros de custo (feita aqui em 20/10/2026, 09:13)

- **O quê:** a planilha `SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO.xlsx` (salva em 14/10/2026), com as classificações
  corrigidas de 12 centros de custo. Não muda contas nem a Estrutura da DRE.
- **Como:** pela tela, em Cadastros da Controladoria → Recarregar, com a planilha. Sem reabrir os meses e sem
  reapurar (decisão do usuário).
- **Conferência:** nos Cenários Analíticos / Premissas / Centros de Custo, nenhum centro com asterisco.

### 2. Migrações de 20/10/2026 (publicação `publicado-2026-10-20-ql-encargos-e-video`)

- `20261019200000_quadro_de_lotacao`: cria a tabela do Quadro de Lotação por centro de custo.
- `20261019220000_encargos_e_condicao_de_pagamento`: cria a Condição de Pagamento dos investimentos e os Encargos e
  Benefícios dos cenários; **apaga** as colunas Ganho Previsto e Receita Bruta Prevista dos investimentos e passa a
  lotação gravada nos cenários para Colaboradores CLT.
- **Como:** na pasta `backend`, `npx prisma migrate deploy` (se o deploy automático não o fizer sozinho — a confirmar).
  Sem elas, as telas dos Cenários Analíticos quebram.

### 3. Quadro de Lotação de JAN–AGO/2026 (feito aqui em 20/10/2026, 10:09)

- **O quê:** a aba Quadro de Lotação do `SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO).xlsx` gravada nas listas de
  janeiro a agosto, sem reabrir os meses e sem recalcular os indicadores.
- **Como:** depois das migrações, na pasta `backend`, primeiro a simulação e depois a gravação:

  ```
  NODE_ENV=production npx tsx scripts/carregarQuadroDeLotacao.ts "<caminho>/SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO).xlsx" 2026 1-8
  NODE_ENV=production npx tsx scripts/carregarQuadroDeLotacao.ts "<caminho>/SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO).xlsx" 2026 1-8 --gravar
  ```

- **Conferência (o que saiu aqui):** 287 linhas no total.

  | Mês | Centros | CLT | PJ | Total |
  |---|---|---|---|---|
  | 01/2026 | 36 | 244 | 32 | 276 |
  | 02/2026 | 36 | 244 | 32 | 276 |
  | 03/2026 | 36 | 244 | 32 | 276 |
  | 04/2026 | 36 | 248 | 33 | 281 |
  | 05/2026 | 36 | 243 | 33 | 276 |
  | 06/2026 | 36 | 245 | 33 | 278 |
  | 07/2026 | 36 | 245 | 33 | 278 |
  | 08/2026 | 35 | 258 | 34 | 292 |

### 4. Limite de envio dos vídeos (desde 20/10/2026)

Os Relatórios Executivos aceitam vídeos de até 200 MB. O SIG BPM já aceita envios de até 210 MB; se houver um proxy na
frente do servidor (nginx ou similar), ele precisa aceitar também (no nginx, `client_max_body_size 210m;`).

### 5. Capa, Texto Livre, Sumário e Imagem de Fundo (publicação `publicado-2026-10-20-capa-e-sumario`)

Nada a rodar no servidor: não há migração nem script. A aba Capa é criada sozinha em cada relatório quando ele é
listado ou aberto (`completarAbas`); o valor novo `CAPA` do enum `AbaRelatorioExecutivo` não muda o SQLite (a coluna
é texto). Na troca para o PostgreSQL, a migração inicial já cria o enum com ele.

### Alternativa: uma cópia nova da base

Até 20/10/2026, nenhum usuário gravou dados na produção local depois da cópia de 19/10, além dos itens 1 e 3 acima
(conferido no log de auditoria). Se o servidor também não recebeu gravações próprias, uma cópia nova da base local
(e da pasta `uploads`) substitui os itens 1 a 3 de uma vez, pelo mesmo procedimento do `LEIA-ME para o TI.txt` de
19/10. Tudo o que foi gravado só no servidor se perde nesse caso.

## Em aberto com o TI

1. Se o deploy automático roda `prisma migrate deploy`.
2. Qual base é a oficial: a do servidor ou a local (porta 3000). Hoje as duas recebem dados separadamente.
3. Se a cópia de 19/10 foi aplicada e se a pasta `uploads` foi levada.

## Troca do SQLite pelo PostgreSQL

O código foi escrito para ser portável; o procedimento está em
[backend/prisma/PORTABILIDADE.md](../backend/prisma/PORTABILIDADE.md). Em resumo:

- **No código:** `provider = "postgresql"` no `schema.prisma`, o `DATABASE_URL` do PostgreSQL e o adaptador
  `PrismaPg` (o `@prisma/adapter-pg` já está instalado) no lugar do `PrismaBetterSqlite3`, em
  `backend/src/config/prisma.ts`. O código não usa SQL cru nem funções próprias do SQLite.
- **Migrações:** as 77 migrações atuais são SQL do SQLite e não rodam no PostgreSQL. Gera-se uma migração inicial
  limpa contra o PostgreSQL (`npx prisma migrate dev --name init`), e daí em diante as migrações novas são geradas para
  ele.
- **Dados:** os dados do SQLite precisam ser levados para o PostgreSQL uma vez (por exemplo com `pgloader`, ou um
  script que leia pelo Prisma de um banco e grave no outro). Conferir depois as contagens das tabelas e os totais da
  DRE de um mês fechado.
- **Scripts próprios do SQLite, a refazer:** `backend/scripts/backupDoBanco.mjs` (`npm run db:backup`, cópia com
  `VACUUM INTO`), `backend/scripts/copiarBancoDeProducao.mjs` (cópia para o desenvolvimento) e
  `backend/scripts/migrarProducao.mjs`. No PostgreSQL, viram `pg_dump` / `pg_restore`.
- **Os scripts de dados** (como o `carregarQuadroDeLotacao.ts`) usam o Prisma e funcionam igual: basta o
  `DATABASE_URL` apontar para o banco certo.
- **A ganhar com a troca:** com uma única base PostgreSQL no servidor, a produção e os scripts passam a gravar
  direto nela, e as alterações de dados deixam de ser repetidas em duas bases (o motivo deste registro).

## Histórico das publicações com dados

| Data | Publicação | Para o servidor |
|---|---|---|
| 19/10/2026 | `substituirBalanceteDetalhado.ts` (JAN–AGO/2026) | Rodado pelo TI no servidor em 19/10 |
| 19/10/2026 | Cópia inteira da base local (`be82694`) | A confirmar |
| 20/10/2026 | Recarga dos centros de custo | Item 1 acima |
| 20/10/2026 | `publicado-2026-10-20-ql-encargos-e-video` | Itens 2 a 4 acima |
| 20/10/2026 | `publicado-2026-10-20-capa-e-sumario` | Nada a rodar (item 5) |
