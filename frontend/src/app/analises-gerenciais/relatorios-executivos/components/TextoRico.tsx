"use client";

import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Bold, ChevronDown, Italic, List, Palette, Underline } from "lucide-react";

/**
 * O texto formatado das anotações e das legendas das fotos dos Relatórios Executivos (17/10/2026): negrito, itálico,
 * sublinhado, o tamanho da fonte, a cor e os marcadores. Fica em HTML, limpo pelo DOMPurify antes de aparecer (só as
 * marcas de formatação passam: nada de scripts, links ou imagens).
 */
const PERMITIDOS = { ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "span", "font", "br", "div", "p", "ul", "ol", "li"], ALLOWED_ATTR: ["style", "color", "size"] };
export const limparHtml = (html: string) => (typeof window === "undefined" ? "" : DOMPurify.sanitize(html, PERMITIDOS));

/** O texto simples de antes (sem formatação) em HTML: os caracteres escapados e as quebras de linha. */
const deTexto = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

/**
 * As cores da fonte, na ordem pedida. Padrão (17/10/2026; antes, Preto) tira a cor escolhida: o texto volta à cor do tema
 * (preto; branco no Escuro). No Escuro, o cinza e o vermelho ficam mais claros (globals.css, `.texto-rico`).
 */
export const COR_PADRAO = "#111827";
export const CORES_DA_FONTE = [
  { nome: "Padrão", cor: COR_PADRAO },
  { nome: "Cinza", cor: "#6b7280" },
  { nome: "Ouro", cor: "#ffcc00" },
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
const CLASSE_DO_TEXTO = "texto-rico [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:pl-0.5";

/** Tira a cor Padrão do texto (os trechos voltam à cor do tema) e desfaz os spans que ficaram sem estilo. */
function tirarCorPadrao(campo: HTMLElement) {
  campo.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    if (el.style.color !== "rgb(17, 24, 39)") return;
    el.style.removeProperty("color");
    if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
    if (el.tagName === "SPAN" && !el.attributes.length) el.replaceWith(...el.childNodes);
  });
  campo.querySelectorAll("font[color]").forEach((el) => {
    if (el.getAttribute("color")?.toLowerCase() === COR_PADRAO) el.replaceWith(...el.childNodes);
  });
}

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

/** Os tamanhos da fonte, em px (17/10/2026: numerados na barra). O texto das anotações e das legendas é de 14 (o padrão, com asterisco na lista). */
export const TAMANHOS = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];
export const TAMANHO_PADRAO = 14;

/** O tamanho, em px, do texto onde está a seleção (ou do campo, sem seleção nele). */
function tamanhoDaSelecao(campo: HTMLElement) {
  const sel = window.getSelection();
  let n: Node | null = sel && sel.rangeCount && campo.contains(sel.anchorNode) ? sel.anchorNode : campo;
  if (n && n.nodeType === Node.TEXT_NODE) n = n.parentNode;
  return Math.round(parseFloat(getComputedStyle((n as HTMLElement) ?? campo).fontSize));
}

/**
 * Põe a fonte da seleção no tamanho escolhido (em px). Se a seleção é todo o trecho que já tem um tamanho, muda o dele
 * (sem um span dentro do outro, que deixava a linha alta); no tamanho do campo, o trecho perde a marca. Senão, envolve a
 * seleção num span novo, tirando os tamanhos de dentro dela (o tamanho escolhido vale para todo o trecho).
 */
function definirFonte(sel: Selection, px: number, campo: HTMLElement) {
  const r = sel.getRangeAt(0);
  const base = Math.round(parseFloat(getComputedStyle(campo).fontSize));
  const selecionar = (no: Node) => {
    sel.removeAllRanges();
    const nova = document.createRange();
    nova.selectNodeContents(no);
    sel.addRange(nova);
  };
  const desfazer = (span: HTMLElement) => {
    span.style.removeProperty("font-size");
    if (span.getAttribute("style")?.trim()) return [span] as Node[];
    const filhos = [...span.childNodes];
    span.replaceWith(...filhos);
    return filhos;
  };
  let n: Node | null = r.commonAncestorContainer;
  let trecho: HTMLElement | null = null;
  while (n && n !== campo) {
    if (n instanceof HTMLElement && n.tagName === "SPAN" && n.style.fontSize) {
      trecho = n;
      break;
    }
    n = n.parentNode;
  }
  const texto = sel.toString().trim();
  if (trecho && texto && trecho.textContent?.trim() === texto) {
    trecho.querySelectorAll<HTMLElement>("span").forEach((x) => x.style.fontSize && desfazer(x));
    if (px === base) {
      const nos = desfazer(trecho);
      if (nos.length) {
        sel.removeAllRanges();
        const nova = document.createRange();
        nova.setStartBefore(nos[0]);
        nova.setEndAfter(nos[nos.length - 1]);
        sel.addRange(nova);
      }
      return;
    }
    trecho.style.fontSize = `${px}px`;
    selecionar(trecho);
    return;
  }
  const conteudo = r.extractContents();
  conteudo.querySelectorAll<HTMLElement>("span").forEach((x) => x.style.fontSize && desfazer(x));
  if (px === base) {
    const marca = document.createElement("span");
    marca.appendChild(conteudo);
    r.insertNode(marca);
    const filhos = [...marca.childNodes];
    marca.replaceWith(...filhos);
    return;
  }
  const span = document.createElement("span");
  span.style.fontSize = `${px}px`;
  span.appendChild(conteudo);
  r.insertNode(span);
  selecionar(span);
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
  const [aberta, setAberta] = useState<"cor" | "marcador" | "tamanho" | null>(null);
  // O tamanho do texto onde está o cursor (o número entre os botões de diminuir e aumentar), a cada mudança da seleção.
  const [tamanho, setTamanho] = useState(14);
  useEffect(() => {
    const aoSelecionar = () => {
      const el = campo();
      const sel = window.getSelection();
      if (el && sel && sel.rangeCount && el.contains(sel.anchorNode)) setTamanho(tamanhoDaSelecao(el));
    };
    document.addEventListener("selectionchange", aoSelecionar);
    return () => document.removeEventListener("selectionchange", aoSelecionar);
  }, [campo]);
  const fonte = (px: number) => {
    const el = campo();
    if (!el) return;
    aplicar(el, (s) => definirFonte(s, px, el));
    setTamanho(px);
  };
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
      {/* O tamanho da fonte (17/10/2026): um botão só, com o número; a lista dos tamanhos, com o padrão marcado com asterisco. */}
      <span className="relative">
        <button
          type="button"
          className={`${botao} w-auto min-w-9 gap-0 px-1 text-xs font-semibold`}
          onMouseDown={semFoco}
          onClick={() => setAberta((a) => (a === "tamanho" ? null : "tamanho"))}
          title="Tamanho da fonte"
          aria-label={`Tamanho da fonte: ${tamanho}`}
          aria-expanded={aberta === "tamanho"}
        >
          {tamanho}
          <ChevronDown className="size-3" />
        </button>
        {aberta === "tamanho" ? (
          <span className="absolute top-full right-0 z-20 mt-1 grid w-20 rounded-sm border border-gray-200 bg-white p-1 shadow-md">
            {TAMANHOS.map((t) => (
              <button
                key={t}
                type="button"
                className={`${item} justify-center ${t === tamanho ? "font-bold text-gray-900" : ""}`}
                onMouseDown={semFoco}
                onClick={() => {
                  fonte(t);
                  setAberta(null);
                }}
              >
                {t === TAMANHO_PADRAO ? `${t}*` : t}
              </button>
            ))}
            <span className="border-t border-gray-100 px-1 pt-1 text-center text-[10px] text-gray-500">* padrão</span>
          </span>
        ) : null}
      </span>
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
                  if (c.cor === COR_PADRAO) {
                    const el = campo();
                    aplicar(el, () => {
                      document.execCommand("styleWithCSS", false, "true");
                      document.execCommand("foreColor", false, COR_PADRAO);
                      if (el) tirarCorPadrao(el);
                    });
                  } else exec("foreColor", c.cor, true);
                  setAberta(null);
                }}
              >
                <span
                  className="size-3.5 shrink-0 rounded-[2px] border border-gray-300"
                  style={{ background: c.cor === COR_PADRAO ? "linear-gradient(135deg, #111827 50%, #ffffff 50%)" : c.cor }}
                />
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
