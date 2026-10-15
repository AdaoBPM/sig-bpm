# Produção e Desenvolvimento

Desde 15/10/2026 a ferramenta roda em dois ambientes separados, com bancos separados.

| | Produção | Desenvolvimento |
|---|---|---|
| Para quê | O uso no dia a dia, por todos os usuários | Conferir as alterações antes de publicar |
| Endereço | http://localhost:3000 (na rede: http://IP-do-computador:3000) | http://localhost:3100 |
| Backend | porta 3001 | porta 3101 (Swagger em http://localhost:3101/api/docs) |
| Banco | `backend/prisma/dev.db` (o banco real) | `backend/prisma/desenvolvimento.db` (cópia do real) |
| Iniciar | `npm run producao` (na pasta `sig-bpm`) | `npm run dev` (na pasta `sig-bpm`) |
| Telas | Já compiladas: abrem em menos de 1 s | Compiladas ao abrir (Turbopack): a primeira vez demora alguns segundos |
| Cookie da sessão | `bpm_token` | `bpm_token_dev` (os dois ambientes não derrubam a sessão um do outro) |

> O nome `dev.db` do banco real é histórico. Trocar o nome fica para a migração ao servidor, quando o banco mudar de
> lugar de qualquer jeito.

## Configuração

O backend lê dois arquivos: primeiro o do ambiente (`.env.development` ou `.env.production`), depois o `.env` comum. O
que vem antes vale. **Sem `NODE_ENV`, o ambiente é o de desenvolvimento**, inclusive nos comandos do Prisma: um comando
esquecido cai na cópia, nunca no banco real.

| Arquivo | Conteúdo |
|---|---|
| `backend/.env` | Comum: `JWT_SECRET`, `JWT_EXPIRES_IN`, `ENABLE_AUDIT`, `UPLOAD_DIR`, `UPLOAD_MAX_MB`, TOTVS |
| `backend/.env.development` | `PORT=3101`, `DATABASE_URL=file:./prisma/desenvolvimento.db`, `CORS_ORIGIN=http://localhost:3100`, `ENABLE_SWAGGER=true` |
| `backend/.env.production` | `NODE_ENV=production`, `PORT=3001`, `DATABASE_URL=file:./prisma/dev.db`, `CORS_ORIGIN=http://localhost:3000`, `ENABLE_SWAGGER=false` |
| `frontend/.env.development.local` | `BACKEND_URL=http://localhost:3101` |
| `frontend/.env.production.local` | `BACKEND_URL=http://localhost:3001` |

Nenhum desses arquivos vai para o git. Os modelos estão em `backend/.env.example` e `frontend/.env.example`.

## Comandos (na pasta `sig-bpm`)

| Comando | O que faz |
|---|---|
| `npm run dev` | Inicia o desenvolvimento (3100/3101) |
| `npm run producao:construir` | Gera a versão de produção: o backend em `backend/dist` (cerca de 25 s) e o frontend em `frontend/.next` (cerca de 75 s) |
| `npm run producao` | Inicia a produção (3000/3001) a partir do que foi gerado |
| `npm run db:backup -- "C:/caminho/da/pasta"` | Back-up do banco de **produção** (uma cópia consistente, mesmo com a produção no ar) |
| `npm run db:copiar-producao` | Copia o banco de produção para o de desenvolvimento (pare o desenvolvimento antes) |
| `npm run db:migrar-producao` | Aplica as migrações no banco de **produção** (faça o back-up antes) |
| `npx prisma migrate deploy` (em `backend`) | Aplica as migrações no banco de **desenvolvimento** |

## Publicar uma alteração

1. Desenvolver e conferir em http://localhost:3100, com a cópia do banco.
2. Com migração nova: aplicar primeiro no desenvolvimento (`npx prisma migrate deploy`, em `backend`) e conferir.
3. Back-up da produção: `npm run db:backup -- "<pasta do back-up>"`.
4. Com migração nova: `npm run db:migrar-producao`.
5. Parar a produção, rodar `npm run producao:construir` e iniciar de novo com `npm run producao`. A produção fica fora
   do ar por cerca de 2 minutos.

## Migração para o servidor da empresa (a fazer)

A produção foi separada já pensando no servidor, para que os usuários a usem com o notebook desligado. O que será preciso
lá:

- **Node.js 24** e a pasta do projeto (o repositório, sem `node_modules`; `npm install` na pasta `sig-bpm` instala e gera o
  cliente do Prisma).
- **Os arquivos de configuração** de produção (`backend/.env`, `backend/.env.production`,
  `frontend/.env.production.local`), com:
  - `DATABASE_URL` apontando para o banco no servidor;
  - `UPLOAD_DIR` para a pasta dos arquivos importados, copiada do notebook (`backend/uploads`): o banco guarda o hash de cada
    arquivo importado, e o arquivo fica nessa pasta;
  - um `JWT_SECRET` novo, com pelo menos 32 caracteres (a produção recusa um segredo fraco).
- **O banco:** copiar o banco real com `npm run db:backup` e levá-lo ao servidor. A troca para PostgreSQL é opcional e
  está descrita em `backend/prisma/PORTABILIDADE.md`.
- **Gerar e iniciar:** `npm run producao:construir` e `npm run producao`, como um serviço que inicie com o servidor (por
  exemplo, PM2 ou um serviço do Windows) e que reinicie se cair.
- **Rede:** liberar a porta 3000 no firewall do servidor. A porta 3001 (o backend) não precisa ficar aberta para a
  rede: o frontend fala com o backend no próprio servidor.
- **https (recomendado):** com um certificado (direto ou por um proxy, como IIS ou nginx, que envie
  `X-Forwarded-Proto: https`), o cookie da sessão passa a ser "seguro" sozinho. Por http na rede interna, também
  funciona.
- **Back-up periódico** do banco no servidor (`npm run db:backup`, agendado).
