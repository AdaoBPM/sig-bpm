"use client";

import { useEffect, useState } from "react";

import type { Bloco } from "../services/relatoriosExecutivosService";

/**
 * Copiar e colar os blocos dos slides (24/10/2026, pedido do Adão). O bloco copiado vai à área de transferência do sistema
 * num tipo do SIG (o JSON, com o relatório de origem: cola em qualquer página, aba ou relatório, até em outra aba do
 * navegador) e como texto (para colar em outro programa), e fica guardado no navegador para o Colar do menu da edição (o
 * botão não lê a área de transferência).
 */
export const TIPO_DA_COPIA = "application/x-sig-bpm-blocos";
const CHAVE = "sig-bpm:re-copia";
const EVENTO = "sig-bpm:re-copia";

/** A cópia: o relatório de origem, os blocos e, guardados no navegador, o texto que foi junto e quando. */
export type Copia = { relatorioId: string; blocos: Bloco[]; texto?: string; em?: number };

const TIPOS = new Set(["PAINEL", "INDICADOR", "ANOTACAO", "FOTO", "VIDEO", "TEXTO", "SUMARIO", "TABELA"]);

/** A cópia lida (da área de transferência ou do navegador), só com os blocos de tipo e medidas válidos; sem nenhum, null. */
export function copiaDe(texto: string | null | undefined): Copia | null {
  try {
    const x = JSON.parse(texto ?? "") as Partial<Copia>;
    const blocos = (Array.isArray(x.blocos) ? x.blocos : []).filter(
      (b) => !!b && TIPOS.has(b.tipo) && [b.x, b.y, b.w, b.h].every((n) => Number.isInteger(n) && n >= 0) && b.w >= 1 && b.h >= 1,
    );
    if (typeof x.relatorioId !== "string" || !blocos.length) return null;
    return { relatorioId: x.relatorioId, blocos, ...(typeof x.texto === "string" ? { texto: x.texto } : {}), ...(typeof x.em === "number" ? { em: x.em } : {}) };
  } catch {
    return null;
  }
}

/** A última cópia guardada no navegador (a do Colar do menu). */
export function lerCopia() {
  try {
    return copiaDe(localStorage.getItem(CHAVE));
  } catch {
    return null;
  }
}

export function guardarCopia(c: Copia) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(c));
  } catch {
    // Sem o armazenamento do navegador, fica só a área de transferência (o Ctrl+V).
  }
  window.dispatchEvent(new Event(EVENTO));
}

const normalizar = (t: string) => t.replace(/\r\n/g, "\n").trim();

/**
 * Sem o tipo do SIG na colagem (a área de transferência que só guarda o texto), a última cópia do SIG, se o texto colado é
 * o que foi com ela, nos últimos 10 min.
 */
export function copiaPeloTexto(texto: string) {
  const c = lerCopia();
  return c?.texto && normalizar(c.texto) === normalizar(texto) && Date.now() - (c.em ?? 0) < 10 * 60_000 ? c : null;
}

/** A última cópia, atualizada ao copiar (nesta ou em outra aba do navegador). */
export function useCopia() {
  const [copia, setCopia] = useState<Copia | null>(null);
  useEffect(() => {
    const ler = () => setCopia(lerCopia());
    ler();
    window.addEventListener(EVENTO, ler);
    window.addEventListener("storage", ler);
    return () => {
      window.removeEventListener(EVENTO, ler);
      window.removeEventListener("storage", ler);
    };
  }, []);
  return copia;
}

/** O texto do bloco, para colar em outro programa. */
export function textoDoBloco(b: Bloco) {
  if (b.tipo === "ANOTACAO") return [b.titulo, b.texto].filter(Boolean).join("\n");
  if (b.tipo === "TEXTO") return b.texto;
  if (b.tipo === "FOTO") return b.legenda;
  if (b.tipo === "VIDEO") return b.legenda || b.url;
  if (b.tipo === "PAINEL") return b.titulo;
  if (b.tipo === "INDICADOR") return b.nome;
  return "";
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const BLOCOS_DE_TEXTO = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "blockquote", "pre"]);

/**
 * A formatação básica do texto colado de outro programa (24/10/2026): negrito, itálico, sublinhado, os parágrafos, as
 * quebras de linha e as listas; sem as fontes, os tamanhos, as cores, as margens e os estilos do Word e das páginas (que
 * viriam em cada trecho). O resultado ainda passa pelo limparHtml.
 */
export function formatacaoBasica(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("style, script, head, title, meta").forEach((e) => e.remove());
  const saida = (no: Node): string => {
    if (no.nodeType === Node.TEXT_NODE) return escapar((no.textContent ?? "").replace(/[ \t\r\n]+/g, " "));
    if (!(no instanceof HTMLElement)) return "";
    const tag = no.tagName.toLowerCase();
    if (tag === "br") return "<br>";
    let r = [...no.childNodes].map(saida).join("");
    const st = no.style;
    // O Google Docs embrulha tudo num <b style="font-weight:normal">.
    if (((tag === "b" || tag === "strong") && st.fontWeight !== "normal") || /^(bold|[6-9]00)$/.test(st.fontWeight)) r = `<b>${r}</b>`;
    if (tag === "i" || tag === "em" || st.fontStyle === "italic") r = `<i>${r}</i>`;
    if (tag === "u" || st.textDecoration.includes("underline")) r = `<u>${r}</u>`;
    if (tag === "li") return `<li>${r}</li>`;
    if (tag === "ul" || tag === "ol") return `<${tag}>${r}</${tag}>`;
    if (BLOCOS_DE_TEXTO.has(tag)) return `<div>${r.trim() || "<br>"}</div>`;
    if (tag === "td" || tag === "th") return `${r} `;
    return r;
  };
  return saida(doc.body).trim();
}
