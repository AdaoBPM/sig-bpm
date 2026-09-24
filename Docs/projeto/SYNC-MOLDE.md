# Sincronizar melhorias do molde com projetos filhos

> Projetos criados via **Use this template** são repositórios **independentes**. Não recebem updates automáticos do `projeto-padrao-bpm`.

---

## Quando sincronizar

- Correção de segurança no template
- Melhoria em `Docs/skills/` ou `CONVENTIONS.md`
- Novo componente de referência útil para vários projetos
- Ajuste de dependências (Next, Express)

**Não** sincronizar cegamente: cada projeto tem `SPEC.md` próprio.

---

## Estratégias

### 1. Cherry-pick (recomendado para poucos commits)

No **projeto filho**:

```bash
git remote add molde https://github.com/bpmghb/projeto-padrao-bpm.git
git fetch molde
git cherry-pick <hash-do-commit-no-molde>
```

Resolva conflitos priorizando o **SPEC do projeto filho**.

### 2. Merge seletivo de pastas

Copiar apenas o que interessa:

| Pasta | Risco de conflito | Nota |
|---|---|---|
| `Docs/skills/` | Baixo | Geralmente seguro |
| `Docs/stack/` | Baixo | Revisar CONVENTIONS |
| `frontend/src/components/ui/` | Médio | Pode sobrescrever customizações |
| `backend/src/` | Alto | Quase sempre manual |

```bash
git checkout molde/main -- Docs/skills/SPEC-DRIVEN.md
```

### 3. Documentar diff para a IA

No projeto filho, peça à IA:

```
Compare nosso repo com as convenções atuais em [colar trecho do molde].
Liste o que devemos adotar sem quebrar nosso SPEC.md.
```

---

## O que nunca fazer

- Force push do molde no repo do projeto filho
- Substituir `SPEC.md` do filho pelo exemplo do molde
- Merge completo `molde/main` → `main` sem revisão humana/TI

---

## Fluxo sugerido para TI

1. Melhoria mergeada no `projeto-padrao-bpm`
2. Comunicado interno (o que mudou, por quê)
3. Projetos ativos: TI ou dev faz cherry-pick ou atualização guiada
4. Projetos novos: já nascem com a versão atual via template

---

## Versionamento (opcional)

TI pode taguear releases do molde:

```bash
git tag -a molde-v1.1.0 -m "CI docs, form exemplo, auditoria"
git push origin molde-v1.1.0
```

Projetos filhos referenciam: “Baseado em molde-v1.0.0”.

---

## Feedback piloto → molde

Use [PILOTO-CHECKLIST.md](./PILOTO-CHECKLIST.md) e abra issue **melhoria no molde** (ver `.github/ISSUE_TEMPLATE/`).
