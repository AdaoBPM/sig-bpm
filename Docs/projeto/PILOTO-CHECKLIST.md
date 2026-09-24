# Checklist do piloto — validar o molde em ~30 minutos

> **Para:** quem testa o template pela primeira vez (funcionário ou TI).  
> **Objetivo:** confirmar que o fluxo **cópia → Cursor → entrevista → SPEC → dev local** funciona antes de escalar para outras áreas.

Marque ✅ ou ❌ e anote fricções no final.

---

## 1. Repositório (5 min)

- [ ] Repositório criado via **Use this template** (não é o molde `projeto-padrao-bpm`)
- [ ] Repositório é **privado** e você tem acesso de write
- [ ] Pasta aberta no **Cursor** (File → Open Folder no repo **seu**)

**Anotações:**

---

## 2. Ambiente local (10 min)

```bash
npm run setup    # copia .env de exemplo (se ainda não existir)
npm install
npm run dev
```

- [ ] Node.js **22+** (`node -v`)
- [ ] `npm run setup` concluiu sem erro
- [ ] `npm run dev` sobe frontend (`:3000`) e backend (`:3001`)
- [ ] http://localhost:3000 abre a aplicação
- [ ] Login dev: `admin@bpm.com` / `admin123`
- [ ] http://localhost:3000/exemplo/landing abre **sem** login
- [ ] http://localhost:3001/api/docs abre Swagger (se backend ativo)

**Se falhou:** ver [COMO-CRIAR-SEU-PROJETO.md § Troubleshooting](./COMO-CRIAR-SEU-PROJETO.md#troubleshooting)

**Anotações:**

---

## 3. Referências visuais no molde (5 min)

| Rota | O que validar |
|---|---|
| `/dashboard` | KPIs, filtro de período, tabela, export CSV mock |
| `/pedidos/listagem` | DataTable com loading/erro/vazio |
| `/exemplo/formulario` | Field + react-hook-form + Zod |
| `/exemplo/landing` | Formulário lead público |

- [ ] Dashboard carrega KPIs e gráfico
- [ ] Listagem de pedidos mostra tabela mock
- [ ] Formulário de referência valida campos (teste enviar vazio)
- [ ] Landing envia lead (toast ou mensagem de sucesso)

**Anotações:**

---

## 4. Entrevista com IA (5 min — sem código)

Cole a mensagem de [MENSAGENS-PRONTAS.md](./MENSAGENS-PRONTAS.md) (dashboard ou sua área).

- [ ] IA leu `Docs/entrevista/INTERVIEW.md` e fez **uma pergunta por vez**
- [ ] IA **não** começou a codar antes do SPEC
- [ ] Cenário correto em `Docs/entrevista/scenarios/`

**Anotações:**

---

## 5. SPEC e TI (5 min — simulação)

- [ ] IA gerou rascunho de `SPEC.md` (ou explicou que gerará após entrevista completa)
- [ ] Você sabe onde está [APROVACAO-TI.md](./APROVACAO-TI.md)
- [ ] Entendeu que **implementação só após** confirmação do SPEC + TI

Compare com exemplo: [exemplos/SPEC-dashboard-producao.md](./exemplos/SPEC-dashboard-producao.md)

**Anotações:**

---

## 6. Resultado do piloto

| Pergunta | Sim / Não |
|---|---|
| Um leigo consegue seguir [COMO-CRIAR-SEU-PROJETO.md](./COMO-CRIAR-SEU-PROJETO.md)? | |
| A primeira mensagem no Cursor foi clara? | |
| `npm run dev` foi o maior bloqueio? | |
| Falta algum exemplo visual para sua área? | |

**Top 3 fricções encontradas:**

1.
2.
3.

**Enviar feedback para TI** (issue no molde ou canal interno) com este checklist preenchido.

---

## Próximo passo após piloto OK

1. Área inicia projeto real no **repo próprio**
2. Entrevista completa → SPEC confirmado → [APROVACAO-TI](./APROVACAO-TI.md)
3. Implementação incremental com a IA
