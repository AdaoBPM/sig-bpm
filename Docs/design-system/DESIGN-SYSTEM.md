# BPM Pré-Moldados — Design System & UI Guidelines

Este documento define as regras visuais e de interface do sistema da BPM Pré-Moldados. **Para qualquer geração de código de UI, siga estritamente estas diretrizes sem exceção.**

---

## 1. Princípios de Design

- **Industrial e Sólido:** A interface deve refletir estabilidade, precisão e robustez — características fundamentais de peças pré-moldadas.
- **Alta Legibilidade:** O sistema é focado em produtividade. Informações cruciais devem ter alto contraste.
- **Geometria:** Evite formas excessivamente arredondadas. Prefira cantos mais retos e estruturas em bloco.

---

## 2. Logo BPM

### Arquivo oficial

| Item | Valor |
|---|---|
| **Caminho** | `frontend/public/logo-bpm.svg` |
| **Uso público** | `/logo-bpm.svg` (via Next.js `public/`) |
| **Formato** | SVG — **sempre preferir este arquivo**; nunca recriar o logo em CSS ou texto |
| **Cor do símbolo** | Amarelo `#FFCB05` (asset oficial) — compatível com token `bpm-primary` (`#FFCC00`) |

### Onde usar

| Contexto | Orientação |
|---|---|
| **Sidebar** (fundo escuro) | Logo com altura ~32–40px, `priority` se above-the-fold |
| **Tela de login** | Logo centralizado ou acima do formulário, altura ~40–48px |
| **Landing pages** | Header ou hero — respeitar área de respiro mínima |
| **Favicon** | Derivar do SVG se necessário; manter proporção |

### Implementação (Next.js)

```tsx
import Image from "next/image";

<Image
  src="/logo-bpm.svg"
  alt="BPM Pré-Moldados"
  width={100}
  height={56}
  className="h-8 w-auto"
  priority
/>
```

### Regras

1. **SEMPRE** usar `logo-bpm.svg` — nunca substituir por texto “BPM” quando o logo couber no layout
2. **NUNCA** distorcer proporções (`w-auto` + altura fixa)
3. **NUNCA** aplicar filtros, gradientes ou recolorir o SVG
4. **NUNCA** usar logo sobre fundo amarelo — prefira fundo branco, cinza claro ou preto (`bpm-secondary`)
5. Texto alternativo fixo: `"BPM Pré-Moldados"`

Componente reutilizável do template: `frontend/src/components/layout/BpmLogo.tsx`

---

## 3. Tokens de Cores

### Cores Principais (Brand)
| Token | Classe Tailwind | Hex | Uso |
|---|---|---|---|
| Primary | `bg-bpm-primary` | `#FFCC00` | Botões primários, destaques, estados ativos |
| Primary Hover | `bg-bpm-primary-hover` | `#E6B800` | Hover do botão primário |
| Texto sobre Primary | `text-black` | `#000000` | **Nunca usar texto branco sobre amarelo** |
| Secondary | `bg-bpm-secondary` | `#111111` | Fundo secundário, navbar, sidebar |
| Secondary Hover | `bg-bpm-secondary-hover` | `#222222` | Hover de elementos escuros |
| Texto sobre Secondary | `text-white` | `#FFFFFF` | Texto em fundos escuros |

### Superfícies e Fundos
| Token | Classe Tailwind | Uso |
|---|---|---|
| Background App | `bg-gray-50` | Fundo principal da aplicação |
| Background Card | `bg-white` | Cards, modais, superfícies elevadas |
| Borda Sutil | `border-gray-200` | Separações sutis, cards padrão |
| Borda Alto Contraste | `border-black` | Cards de destaque, elementos importantes |

### Texto
| Token | Classe Tailwind | Uso |
|---|---|---|
| Texto Principal | `text-gray-900` ou `text-black` | Títulos, labels importantes |
| Texto Secundário | `text-gray-600` | Descrições, subtítulos |
| Texto Desabilitado | `text-gray-400` | Texto inativo |

### Status (Feedback Visual)
| Token | Classe Tailwind | Uso |
|---|---|---|
| Sucesso | `text-green-700`, `bg-green-50`, `border-green-200` | Confirmações, operações bem-sucedidas |
| Erro | `text-red-700`, `bg-red-50`, `border-red-200` | Erros, validações falhas |
| Alerta | `text-yellow-800`, `bg-yellow-50`, `border-yellow-200` | Avisos, atenção |
| Info | `text-blue-700`, `bg-blue-50`, `border-blue-200` | Informações neutras |

---

## 4. Tipografia

- **Fonte Padrão:** `Inter` (primeira opção) ou `Roboto` (segunda opção) — sans-serif geométrica e limpa
- **Importação:** `import { Inter } from 'next/font/google'`

### Hierarquia Tipográfica
| Nível | Classes | Uso |
|---|---|---|
| H1 — Título de Página | `text-2xl font-extrabold tracking-tight text-gray-900` | Um por página |
| H2 — Título de Seção | `text-xl font-bold tracking-tight text-gray-900` | Seções principais |
| H3 — Subtítulo | `text-lg font-bold text-gray-900` | Subseções |
| Body | `text-base font-normal text-gray-600` | Texto corrido |
| Small | `text-sm font-normal text-gray-600` | Labels, metadata |
| Caption | `text-xs text-gray-400` | Texto auxiliar, rodapés |

**Regras:**
- Títulos usam `font-bold` ou `font-extrabold` com `tracking-tight`
- Nunca pular níveis de heading (h1 → h3 sem h2)
- Nunca usar estilos de heading para conteúdo que não é heading

---

## 5. Forma e Estrutura

### Border Radius (Arredondamento)
| Classe | Valor | Uso permitido |
|---|---|---|
| `rounded-sm` | 2px | Cards, botões, inputs — **padrão** |
| `rounded` | 4px | Alternativa aceitável |

**NUNCA usar:**
- `rounded-xl`, `rounded-2xl`, `rounded-3xl` — foge do aspecto industrial
- `rounded-full` em cards, botões ou containers — reservado apenas para avatares/badges circulares

### Sombras
| Classe | Uso |
|---|---|
| `shadow-sm` | Botões, pequenos destaques |
| Sem sombra + `border border-gray-200` | **Padrão para cards** |

**Evitar:** `shadow-md`, `shadow-lg`, `shadow-xl` — sombras difusas contradizem a estética industrial.

---

## 6. Comportamento de Componentes

### Botões

```tsx
// Botão Primário — Amarelo BPM
<Button className="bg-bpm-primary hover:bg-bpm-primary-hover text-black font-bold rounded-sm shadow-sm">
  Confirmar Pedido
</Button>

// Botão Secundário — Borda preta
<Button variant="outline" className="border border-black text-black hover:bg-gray-100 rounded-sm">
  Cancelar
</Button>

// Botão Ghost
<Button variant="ghost" className="text-gray-700 hover:bg-gray-100 rounded-sm">
  Ver detalhes
</Button>

// Botão Destrutivo
<Button className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-sm">
  Excluir
</Button>
```

### Cards
```tsx
// Card padrão
<div className="bg-white border border-gray-200 rounded-sm p-6">
  ...
</div>

// Card de destaque
<div className="bg-white border border-black rounded-sm p-6">
  ...
</div>
```

### Inputs e Formulários
```tsx
// Input padrão
<Input className="border-gray-300 rounded-sm focus:border-black focus:ring-1 focus:ring-black" />

// Label
<Label className="text-sm font-medium text-gray-900">Nome do Cliente</Label>

// Mensagem de erro
<p className="text-sm text-red-600 mt-1">Campo obrigatório</p>
```

### Tabelas
```tsx
<table className="w-full border-collapse">
  <thead>
    <tr className="border-b border-gray-200 bg-gray-50">
      <th className="text-left text-xs font-bold text-gray-600 uppercase tracking-wide px-4 py-3">
        Coluna
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-sm text-gray-900">Valor</td>
    </tr>
  </tbody>
</table>
```

### Estados Obrigatórios

Todo componente de listagem ou dados **deve** implementar os três estados:

```tsx
// Loading — usar skeleton, nunca spinner isolado para conteúdo
<div className="h-12 bg-gray-100 rounded-sm animate-pulse" />

// Erro
<div className="border border-red-200 bg-red-50 rounded-sm p-4">
  <p className="text-sm text-red-700">Erro ao carregar dados. Tente novamente.</p>
</div>

// Vazio
<div className="text-center py-12">
  <p className="text-sm font-medium text-gray-900">Nenhum item encontrado</p>
  <p className="text-sm text-gray-600 mt-1">Crie o primeiro item para começar.</p>
</div>
```

---

## 7. Navegação e Layout

### Sidebar (sistemas internos)
```tsx
// Fundo escuro Secondary
<aside className="bg-bpm-secondary w-64 min-h-screen">
  // Logo — usar logo-bpm.svg (ver seção 2)
  <div className="p-4 border-b border-bpm-secondary-hover">
    <Image src="/logo-bpm.svg" alt="BPM Pré-Moldados" width={100} height={56} className="h-8 w-auto" />
  </div>
  // Item ativo
  <a className="flex items-center gap-3 px-4 py-2.5 bg-bpm-primary text-black font-bold text-sm">
    <Icone className="h-4 w-4" />
    Menu Item
  </a>
  // Item inativo
  <a className="flex items-center gap-3 px-4 py-2.5 text-gray-400 hover:text-white hover:bg-bpm-secondary-hover text-sm">
    <Icone className="h-4 w-4" />
    Menu Item
  </a>
</aside>
```

---

## 8. Configuração Tailwind (`globals.css`)

O projeto usa **Tailwind CSS v4**. As cores BPM devem ser definidas como tokens em `@theme`:

```css
@import "tailwindcss";

@theme {
  --color-bpm-primary: #FFCC00;
  --color-bpm-primary-hover: #E6B800;
  --color-bpm-secondary: #111111;
  --color-bpm-secondary-hover: #222222;
}
```

Isso gera automaticamente as classes `bg-bpm-primary`, `hover:bg-bpm-primary-hover`, `bg-bpm-secondary`, etc.

**Nunca use valores arbitrários** (`bg-[#FFCC00]`) quando existir um token BPM correspondente.

---

## 9. Regras Absolutas para a IA

1. **NUNCA** colocar texto branco (`text-white`) sobre o amarelo primário (`bg-bpm-primary`) — contraste insuficiente
2. **NUNCA** usar `rounded-xl`, `rounded-2xl`, `rounded-full` em cards, botões ou containers
3. **NUNCA** usar gradientes decorativos — flat design apenas
4. **NUNCA** usar sombras pesadas (`shadow-lg`, `shadow-xl`) — preferir bordas sólidas
5. **NUNCA** usar cores fora dos tokens definidos neste documento
6. **SEMPRE** usar `lucide-react` para ícones — nenhuma outra lib de ícones
7. **SEMPRE** implementar os três estados: loading (skeleton), erro e vazio
8. **SEMPRE** usar `font-bold` ou `font-extrabold` com `tracking-tight` em títulos
9. **SEMPRE** usar `frontend/public/logo-bpm.svg` para a marca — nunca substituir por texto ou ícone genérico quando o logo couber no layout
