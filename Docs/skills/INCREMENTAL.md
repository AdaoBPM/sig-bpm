# Skill: Implementação Incremental

Este documento define como implementar projetos em passos pequenos, verificáveis e confirmados pelo usuário.

---

## Pré-requisitos

Antes do Passo 1:

- [ ] Entrevista concluída (`Docs/entrevista/INTERVIEW.md`)
- [ ] `SPEC.md` confirmado pelo solicitante
- [ ] **Aprovação TI** registrada (`Docs/projeto/APROVACAO-TI.md`) — ou confirmação explícita de que a TI já aprovou
- [ ] Plano de Implementação no SPEC confirmado pelo usuário

---

## Princípio Central

**Nunca entregue tudo de uma vez.**

Cada passo deve ser pequeno o suficiente para que o usuário consiga verificar se está correto antes de avançar. Um passo grande demais cria um estado difícil de corrigir.

---

## A Ordem Certa de Implementação

### Para qualquer tipo de projeto, siga esta ordem:

```
1. Estrutura base do projeto (pastas, configs, dependências)
2. Banco de dados / Schema Prisma (se houver)
3. Lógica de negócio / Server Actions / API routes
4. Telas e componentes (do mais simples ao mais complexo)
5. Autenticação e permissões (se houver) — ver `Docs/seguranca/RBAC.md`
6. LGPD / auditoria (se marcado no SPEC) — ver `Docs/seguranca/`
7. Refinamentos visuais e estados de borda
8. Revisão final
```

---

## Como Executar Cada Passo

### Antes de cada passo:
```
Próximo passo: [nome do passo]
O que vou fazer: [descrição em 1-2 frases]
Resultado esperado: [o que o usuário vai poder ver/testar]

Posso avançar?
```

### Durante o passo:
- Implemente apenas o que foi descrito — nada além
- Se descobrir algo que precisa ser feito antes, pare e informe
- Não "aproveite" para fazer outras coisas enquanto está no passo

### Após cada passo:
```
Passo [X] concluído.

O que foi feito:
- [item 1]
- [item 2]

Como verificar:
- [instrução para o usuário testar]

Próximo passo planejado: [nome do passo seguinte]

Posso continuar?
```

---

## Tamanho Ideal de um Passo

Um passo está no tamanho certo quando:
- Pode ser descrito em 1-2 frases
- Gera algo que o usuário consegue ver ou testar
- Leva no máximo 15-20 minutos para implementar
- Se der errado, é fácil de reverter

**Exemplos de passos bem dimensionados:**
- "Criar o schema Prisma com as entidades Pedido e Cliente"
- "Implementar a listagem de pedidos com dados mockados"
- "Conectar a listagem ao banco de dados real"
- "Adicionar o formulário de criação de pedido"
- "Implementar a validação do formulário com Zod"

**Exemplos de passos grandes demais:**
- "Implementar o módulo de pedidos completo"
- "Criar todas as telas do sistema"
- "Fazer o backend"

---

## Tratamento de Descobertas Durante a Implementação

Se durante a implementação você descobrir algo que não estava no SPEC:

1. **Pare** — não implemente silenciosamente
2. **Informe** o usuário:
   > "Durante a implementação de [passo atual], identifiquei que [descoberta]. Isso não estava no SPEC. Antes de continuar, preciso decidir: [opção A] ou [opção B]?"
3. **Aguarde** a decisão
4. Se necessário, **atualize o SPEC** antes de continuar

---

## Estrutura Inicial Obrigatória (Passo 1)

Para qualquer projeto, o Passo 1 sempre é configurar a estrutura base. Use os templates em `Frontend/` e `Backend/` como ponto de partida.

### Checklist do Passo 1 — Frontend
- [ ] Next.js inicializado com App Router e TypeScript
- [ ] Tailwind CSS configurado com as cores BPM (ver `Docs/design-system/DESIGN-SYSTEM.md`)
- [ ] shadcn/ui inicializado
- [ ] lucide-react instalado
- [ ] TanStack Query configurado (QueryClientProvider no layout)
- [ ] Estrutura de pastas criada conforme `Docs/stack/CONVENTIONS.md`
- [ ] `.env.example` criado com todas as variáveis necessárias
- [ ] `.gitignore` incluindo `.env`

### Checklist do Passo 1 — Backend (quando necessário)
- [ ] Express configurado com TypeScript
- [ ] Prisma inicializado e conectado ao banco
- [ ] Zod instalado
- [ ] Middleware de CORS configurado
- [ ] Middleware de tratamento de erros configurado
- [ ] Estrutura de pastas criada conforme `Docs/stack/CONVENTIONS.md`
- [ ] `.env.example` criado

---

## Regras

- Nunca pular o pedido de confirmação entre passos
- Nunca implementar mais de um passo sem parar para verificar
- Nunca começar o passo seguinte enquanto o anterior não foi confirmado
- Se o usuário pedir para "ir em frente em tudo", explique por que os checkpoints existem e ofereça passos maiores como alternativa — mas nunca implemente tudo sem nenhum checkpoint
