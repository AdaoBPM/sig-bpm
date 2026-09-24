# Skill: Revisão de Código

Use este checklist ao final de cada feature ou entrega antes de considerar o trabalho concluído.

---

## Quando Aplicar

- Ao final de cada passo relevante de implementação
- Antes de declarar uma feature como concluída
- Quando o usuário solicitar revisão explícita

---

## Checklist de Revisão

### 1. Correção Funcional
- [ ] O código faz o que o SPEC diz que deve fazer?
- [ ] Os casos de borda estão tratados? (dados vazios, valores nulos, erros de rede)
- [ ] Os estados de loading, erro e vazio estão implementados em todos os componentes de dados?
- [ ] As validações com Zod estão ativas e testadas?

### 2. Stack e Convenções
- [ ] A estrutura de pastas segue `Docs/stack/CONVENTIONS.md`?
- [ ] Nenhum arquivo `.js` foi criado (apenas `.ts` e `.tsx`)?
- [ ] Nenhum `any` foi usado sem justificativa?
- [ ] Props de componentes estão tipadas explicitamente?

### 3. Design System
- [ ] As cores usadas são apenas as definidas em `Docs/design-system/DESIGN-SYSTEM.md`?
- [ ] Não há texto branco sobre o amarelo primário (`#FFCC00`)?
- [ ] Não há `rounded-xl`, `rounded-2xl` ou `rounded-full` em cards/botões?
- [ ] Não há gradientes decorativos?
- [ ] Não há sombras pesadas (`shadow-lg`, `shadow-xl`)?
- [ ] Os ícones são todos de `lucide-react`?
- [ ] A tipografia segue a hierarquia definida (headings com `font-bold tracking-tight`)?
- [ ] O espaçamento segue a escala do Tailwind (sem valores arbitrários como `px-[13px]`)?

### 4. Segurança
- [ ] Nenhum segredo ou variável de ambiente está hardcoded no código?
- [ ] Inputs do usuário são validados antes de chegar ao banco de dados?
- [ ] Server Actions validam os dados recebidos com Zod?
- [ ] O `.env` está no `.gitignore`?

### 5. Performance
- [ ] Server Components são usados onde possível (dados que não precisam de interatividade)?
- [ ] TanStack Query está configurado com `queryKey` corretos (invalida o cache quando necessário)?
- [ ] Não há N+1 queries no Prisma? (usar `include` para relações em vez de queries aninhadas)
- [ ] Listas longas têm paginação ou limite de registros?

### 6. Qualidade de Código
- [ ] Nenhum componente tem mais de 200 linhas? (se sim, dividir)
- [ ] Funções têm nomes descritivos em português ou inglês consistente?
- [ ] Não há `console.log` esquecidos?
- [ ] Código morto (comentado ou inacessível) foi removido?
- [ ] Separação entre Container (lógica de dados) e Presentation (renderização) foi respeitada?

---

## Formato do Relatório de Revisão

Após aplicar o checklist, apresente um resumo:

```markdown
## Revisão de Código — [Nome do Passo/Feature]

**Resultado:** APROVADO | REQUER AJUSTES

### Itens que precisam de atenção
- [Arquivo:linha] — [Descrição do problema e como corrigir]

### Pontos positivos
- [O que foi bem implementado]

### Próximos passos
- [O que será ajustado antes de continuar]
```

---

## Prioridades de Correção

| Prioridade | Critério | Ação |
|---|---|---|
| **Crítico** | Segurança, dados incorretos, crash | Corrigir antes de continuar |
| **Importante** | Violação do design system, convenção errada, estado de borda faltando | Corrigir antes de entregar |
| **Sugestão** | Melhoria de clareza, otimização preventiva | Registrar e corrigir quando conveniente |
