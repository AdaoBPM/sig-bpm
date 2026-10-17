"use client";

import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { AArrowDown, AArrowUp, Bold, ChevronDown, Italic, List, Palette, Underline } from "lucide-react";

/**
 * O texto formatado das anotações e das legendas das fotos dos Relatórios Executivos (17/10/2026): negrito, itálico,
 * sublinhado, o tamanho da fonte, a cor e os marcadores. Fica em HTML, limpo pelo DOMPurify antes de aparecer (só as
 * marcas de formatação passam: nada de scripts, links ou imagens).
 */
const PERMITIDOS = { ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "span", "font", "br", "div", "p", "ul", "ol", "li"], ALLOWED_ATTR: ["style", "color", "size"] };
export const limparHtml = (html: string) => (typeof window === "undefined" ? "" : DOMPurify.sanitize(html, PERMITIDOS));

/** O texto simples de antes (sem formatação) em HTML: os caracteres escapados e as quebras de linha. */
const deTexto = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

/** As cores da fonte, na ordem pedida. */
export const CORES_DA_FONTE = [
  { nome: "Preto", cor: "#111827" },
  { nome: "Cinza Médio", cor: "#6b7280" },
  { nome: "Amarelo-Ouro", cor: "#ffcc00" },
  { nome: "Verde", cor: "#16a34a" },
  { nome: "Azul", cor: "#2563eb" },
  { nome: "Amarelo", cor: "#eab308" },
  { nome: "Laranja", cor: "#f97316" },
  { nome: "Vermelho", cor: "#dc2626" },
];

/** Os marcadores das listas: o símbolo antes de cada item. */
export const MARCADORES = [
  { nome: "Quadrado", simbolo: "■" },
  { nome: "Seta", simbolo: "➜" },
  { nome: "Check", simbolo: "✓" },
  { nome: "Erro", simbolo: "✗" },
];

/** As listas com os marcadores (o símbolo vem no estilo da lista) e o recuo delas. */
const CLASSE_DO_TEXTO = "[&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:pl-0.5";

/**
 * O texto formatado: na edição, um campo editável (o HTML vai ao `onMudar` a cada alteração, com o texto simples); na
 * leitura, o HTML limpo. Sem `html`, o texto simples de antes.
 */
export function TextoRico({
  html,
  texto,
  editavel,
  placeholder,
  rotulo,
  className,
  registrar,
  onMudar,
}: {
  html?: string;
  texto: string;
  editavel: boolean;
  placeholder?: string;
  rotulo: string;
  className?: string;
  /** O campo editável, para a barra de formatação do bloco. */
  registrar?: (el: HTMLDivElement | null) => void;
  onMudar?: (html: string, texto: string) => void;
}) {
  const conteudo = html ?? deTexto(texto);
  const campo = useRef<HTMLDivElement | null>(null);
  // O campo editável recebe o HTML só quando não está em uso (senão, o cursor pularia a cada tecla).
  useEffect(() => {
    const el = campo.current;
    if (!el || !editavel || document.activeElement === el) return;
    const limpo = limparHtml(conteudo);
    if (el.innerHTML !== limpo) el.innerHTML = limpo;
  }, [conteudo, editavel]);
  if (!editavel) {
    return <div className={`${CLASSE_DO_TEXTO} ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: limparHtml(conteudo) }} />;
  }
  return (
    <div
      ref={(el) => {
        campo.current = el;
        registrar?.(el);
      }}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      aria-label={rotulo}
      data-placeholder={placeholder}
      onInput={(e) => onMudar?.(limparHtml(e.currentTarget.innerHTML), e.currentTarget.innerText)}
      className={`${CLASSE_DO_TEXTO} outline-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] ${className ?? ""}`}
    />
  );
}

/** Aplica um comando à seleção do campo; sem seleção nele, a todo o texto. Depois, avisa a alteração. */
function aplicar(campo: HTMLElement | null, fazer: (sel: Selection) => void) {
  if (!campo) return;
  const sel = window.getSelection();
  if (!sel) return;
  if (!sel.rangeCount || !campo.contains(sel.anchorNode) || sel.isCollapsed) {
    campo.focus();
    const r = document.createRange();
    r.selectNodeContents(campo);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  fazer(sel);
  campo.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Aumenta ou diminui a fonte da seleção (um passo de 20%), envolvendo-a num span com o tamanho relativo. */
function mudarFonte(sel: Selection, fator: number) {
  const r = sel.getRangeAt(0);
  const span = document.createElement("span");
  span.style.fontSize = `${fator}em`;
  span.appendChild(r.extractContents());
  r.insertNode(span);
  sel.removeAllRanges();
  const nova = document.createRange();
  nova.selectNodeContents(span);
  sel.addRange(nova);
}

/** Põe (ou tira, se já tem o mesmo) a lista com o marcador na seleção. */
function marcar(sel: Selection, campo: HTMLElement, simbolo: string) {
  const lista = () => {
    let n: Node | null = sel.anchorNode;
    while (n && n !== campo) {
      if (n instanceof HTMLUListElement) return n;
      n = n.parentNode;
    }
    return null;
  };
  const tipo = `"${simbolo}  "`;
  const atual = lista();
  if (atual && atual.style.listStyleType === tipo) {
    document.execCommand("insertUnorderedList");
    return;
  }
  if (!atual) document.execCommand("insertUnorderedList");
  const ul = lista();
  if (ul) ul.style.listStyleType = tipo;
}

/**
 * Os botões da formatação (17/10/2026), na barra do bloco: negrito, itálico, sublinhado, aumentar e diminuir a fonte, a
 * cor e os marcadores. O clique não tira o foco do texto (a seleção fica); as listas de cores e de marcadores abrem ali
 * mesmo, sem menu (o menu levaria o foco).
 */
export function BarraDeTexto({ campo, botao }: { campo: () => HTMLElement | null; botao: string }) {
  const [aberta, setAberta] = useState<"cor" | "marcador" | null>(null);
  const semFoco = (e: React.MouseEvent) => e.preventDefault();
  const exec = (cmd: string, valor?: string, comCss = false) =>
    aplicar(campo(), () => {
      document.execCommand("styleWithCSS", false, comCss ? "true" : "false");
      document.execCommand(cmd, false, valor);
    });
  const item = "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100";
  return (
    <>
      <button type="button" className={botao} onMouseDown={semFoco} onClick={() => exec("bold")} title="Negrito" aria-label="Negrito">
        <Bold className="size-4" />
      </button>
      <button type="button" className={botao} onMouseDown={semFoco} onClick={() => exec("italic")} title="Itálico" aria-label="Itálico">
        <Italic className="size-4" />
      </button>
      <button type="button" className={botao} onMouseDown={semFoco} onClick={() => exec("underline")} title="Sublinhado" aria-label="Sublinhado">
        <Underline className="size-4" />
      </button>
      <button type="button" className={botao} onMouseDown={semFoco} onClick={() => aplicar(campo(), (s) => mudarFonte(s, 1.2))} title="Aumentar a fonte" aria-label="Aumentar a fonte">
        <AArrowUp className="size-4" />
      </button>
      <button type="button" className={botao} onMouseDown={semFoco} onClick={() => aplicar(campo(), (s) => mudarFonte(s, 1 / 1.2))} title="Diminuir a fonte" aria-label="Diminuir a fonte">
        <AArrowDown className="size-4" />
      </button>
      <span className="relative">
        <button type="button" className={`${botao} w-auto gap-0 px-0.5`} onMouseDown={semFoco} onClick={() => setAberta((a) => (a === "cor" ? null : "cor"))} title="Cor da fonte" aria-label="Cor da fonte" aria-expanded={aberta === "cor"}>
          <Palette className="size-4" />
          <ChevronDown className="size-3" />
        </button>
        {aberta === "cor" ? (
          <span className="absolute top-full right-0 z-20 mt-1 grid w-40 rounded-sm border border-gray-200 bg-white p-1 shadow-md">
            {CORES_DA_FONTE.map((c) => (
              <button
                key={c.cor}
                type="button"
                className={item}
                onMouseDown={semFoco}
                onClick={() => {
                  exec("foreColor", c.cor, true);
                  setAberta(null);
                }}
              >
                <span className="size-3.5 shrink-0 rounded-[2px] border border-gray-300" style={{ background: c.cor }} />
                {c.nome}
              </button>
            ))}
          </span>
        ) : null}
      </span>
      <span className="relative">
        <button type="button" className={`${botao} w-auto gap-0 px-0.5`} onMouseDown={semFoco} onClick={() => setAberta((a) => (a === "marcador" ? null : "marcador"))} title="Marcadores" aria-label="Marcadores" aria-expanded={aberta === "marcador"}>
          <List className="size-4" />
          <ChevronDown className="size-3" />
        </button>
        {aberta === "marcador" ? (
          <span className="absolute top-full right-0 z-20 mt-1 grid w-36 rounded-sm border border-gray-200 bg-white p-1 shadow-md">
            {MARCADORES.map((m) => (
              <button
                key={m.nome}
                type="button"
                className={item}
                onMouseDown={semFoco}
                onClick={() => {
                  const el = campo();
                  if (el) aplicar(el, (s) => marcar(s, el, m.simbolo));
                  setAberta(null);
                }}
              >
                <span className="w-4 text-center text-sm">{m.simbolo}</span>
                {m.nome}
              </button>
            ))}
          </span>
        ) : null}
      </span>
    </>
  );
}
