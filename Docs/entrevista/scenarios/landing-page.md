# Cenário: Landing Page

Leia este arquivo após confirmar com o usuário que o projeto é uma landing page.

---

## Contexto do Cenário

Landing pages da BPM geralmente se encaixam em um destes perfis:
- Apresentação institucional de produto ou serviço
- Página de captação de leads com formulário
- Apresentação de proposta comercial específica
- Página de evento ou promoção temporária

---

## Perguntas Específicas para Landing Pages

Use estas perguntas como guia — não precisa fazer todas. Priorize as que faltam após a conversa inicial.

### Objetivo Principal
- Qual é a única ação que você quer que o visitante faça? (preencher formulário, ligar, baixar, comprar)
- Como o sucesso será medido? (número de formulários preenchidos, ligações geradas, etc.)

### Conteúdo
- Você já tem o texto (copy) da página, ou a IA deve sugerir?
- Tem imagens, fotos de produto ou vídeo que devem ser incluídos?
- Tem logotipo e assets visuais da BPM prontos?

### Formulário (se houver)
- Quais campos o formulário deve ter? (nome, e-mail, telefone, empresa, cargo, mensagem)
- Para onde vai o dado do formulário? (e-mail, planilha, CRM, webhook)
- Precisa de validação especial? (CNPJ, telefone com máscara, etc.)

### Seções e Estrutura
- Quais seções a página precisa ter? (hero, benefícios, depoimentos, FAQ, contato, rodapé)
- Tem menu de navegação ou é uma página de scroll único?
- Precisa ser responsiva para mobile? (sempre sim — confirmar apenas para priorização)

### Técnico
- Precisa de SEO? (meta tags, Open Graph, sitemap)
- Precisa de analytics? (Google Analytics, Meta Pixel)
- Vai ter mais páginas no futuro ou é uma página única isolada?
- Precisa de internacionalização (PT + EN)?

### Referências
- Tem alguma landing page de concorrente ou empresa admirada como referência visual?

---


**Estratégia de renderização:** SSG (Static Site Generation) com `revalidate` se o conteúdo mudar raramente. ISR se o conteúdo for atualizado com frequência.

---

## Checklist antes de gerar o SPEC

- [ ] Objetivo principal confirmado
- [ ] Ação do formulário definida (destino dos dados)
- [ ] Se houver formulário com dados pessoais: retenção e base legal — [`Docs/seguranca/LGPD.md`](../../seguranca/LGPD.md)
- [ ] Seções da página listadas
- [ ] Requisitos técnicos (SEO, analytics) confirmados
- [ ] Referência visual coletada (se houver)
- [ ] Fora do escopo definido explicitamente
 