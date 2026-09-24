# Contribuindo com o molde BPM

> **Quem commita aqui:** equipe de **TI** que mantém `projeto-padrao-bpm`.  
> **Funcionários de negócio:** trabalham no **repositório cópia** do próprio projeto — não neste molde.

---

## Princípios

1. O molde é **referência + processo**, não produto final
2. Toda mudança de código deve servir **exemplos** ou **DX** (developer experience)
3. Documentação em `Docs/` tem a mesma prioridade que código
4. Sem CI/CD obrigatório no molde até política TI definir pipeline

---

## Como propor mudanças

1. Abra uma issue usando o template **Melhoria no molde**
2. Branch a partir de `main`: `melhoria/descricao-curta`
3. PR com:
   - O que mudou e por quê
   - Impacto em projetos que usaram template antigo ([SYNC-MOLDE.md](./Docs/projeto/SYNC-MOLDE.md))
   - Se atualizou `AGENTS.md`, `CONVENTIONS.md` ou exemplos visuais

---

## O que não mergear

- Código específico de um único projeto de negócio
- Credenciais, `.env` reais, dados de produção
- RF/RNF fixos no código (pertencem ao `SPEC.md` de cada projeto)
- Pipeline CI/CD sem aprovação explícita da TI

---

## Estrutura de revisão

| Área | Revisor |
|---|---|
| `Docs/` | TI + owner do processo |
| `frontend/`, `backend/` | Dev TI |
| Segurança | Ver `Docs/seguranca/` |

`CODEOWNERS` define aprovações automáticas no GitHub.

---

## Rodar localmente

```bash
npm run setup
npm install
npm run dev
npm run build
npm test          # testes smoke (sem CI no molde por padrão)
```

---

## Releases do template

1. Merge em `main`
2. Tag opcional `molde-vX.Y.Z`
3. Comunicar áreas ([SYNC-MOLDE.md](./Docs/projeto/SYNC-MOLDE.md))

---

## Dúvidas de uso (não contribuição)

Funcionários: [COMO-CRIAR-SEU-PROJETO.md](./Docs/projeto/COMO-CRIAR-SEU-PROJETO.md) e issue template **Dúvida de uso**.
