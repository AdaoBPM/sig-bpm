"use client";

import { createContext, useContext, useId, useState } from "react";

import { Seletor } from "./SeletorPeriodo";

export type MesDoGrafico = { mes: string; realizado: number | null; orcado: number | null };

/**
 * Os nomes das duas séries (13/10/2026): Realizado e Orçado em Resultados Realizados; no Painel de Bordo dos cenários,
 * Cenário e Comparado. Valem no gráfico (a dica), na legenda e nos cards do painel.
 */
export type RotulosDasSeries = { realizado: string; orcado: string };
export const RotulosDoGrafico = createContext<RotulosDasSeries>({ realizado: "Realizado", orcado: "Orçado" });
export const useRotulosDoGrafico = () => useContext(RotulosDoGrafico);

/**
 * O tipo dos gráficos (Painel de Bordo, caixa Tipo de Gráficos): Barras, o modelo da planilha (colunas do realizado e
 * do orçado), ou Área (10/10/2026): o realizado numa área amarela, opaca no máximo do período e transparente no zero,
 * com o contorno de cima em amarelo-ouro, e o orçado numa linha preta.
 */
export type TipoGrafico = "barras" | "area";

/** A escolha do tipo, guardada neste navegador; a mesma no Painel de Bordo e em Indicadores (11/10/2026). */
const CHAVE_TIPO = "sig.painel.tipoGrafico";
export function useTipoGrafico() {
  const [tipo, setTipo] = useState<TipoGrafico>(() => {
    try {
      return window.localStorage.getItem(CHAVE_TIPO) === "area" ? "area" : "barras";
    } catch {
      // Sem armazenamento (janela privada, ou no servidor): Barras.
      return "barras";
    }
  });
  const escolher = (t: TipoGrafico) => {
    setTipo(t);
    try {
      window.localStorage.setItem(CHAVE_TIPO, t);
    } catch {
      // Sem armazenamento: a escolha só não é lembrada.
    }
  };
  return [tipo, escolher] as const;
}

/**
 * Os rótulos dos valores mensais nos gráficos (caixa Rótulos: Com ou Sem, 13/10/2026), guardados neste navegador; os
 * mesmos nos dois painéis e no gráfico do indicador em Indicadores.
 */
const CHAVE_ROTULOS = "sig.painel.rotulos";
export function useRotulosDosValores() {
  const [com, setCom] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(CHAVE_ROTULOS) === "com";
    } catch {
      return false; // sem armazenamento: Sem
    }
  });
  const escolher = (sim: boolean) => {
    setCom(sim);
    try {
      window.localStorage.setItem(CHAVE_ROTULOS, sim ? "com" : "sem");
    } catch {
      // sem armazenamento: a escolha só não é lembrada
    }
  };
  return [com, escolher] as const;
}
export function SeletorRotulos({ com, onMudar }: { com: boolean; onMudar: (sim: boolean) => void }) {
  return (
    <Seletor
      rotulo="Rótulos"
      valor={com ? "com" : "sem"}
      onMudar={(v) => onMudar(v === "com")}
      largura="w-24"
      opcoes={[
        { valor: "com", rotulo: "Com" },
        { valor: "sem", rotulo: "Sem" },
      ]}
    />
  );
}

/** A lista Tipo, na linha do título (Painel de Bordo e Indicadores). */
export function SeletorTipoGrafico({ tipo, onMudar }: { tipo: TipoGrafico; onMudar: (t: TipoGrafico) => void }) {
  return (
    <Seletor
      rotulo="Tipo"
      valor={tipo}
      onMudar={(v) => onMudar(v === "area" ? "area" : "barras")}
      largura="w-28"
      opcoes={[
        { valor: "barras", rotulo: "Barras" },
        { valor: "area", rotulo: "Área" },
      ]}
    />
  );
}

/**
 * As paradas do degradê do realizado, na altura da forma (do maior valor acima do zero ao menor abaixo dele): a
 * opacidade das pontas (o valor sobre o maior em módulo) e onde fica o zero (transparente).
 */
export function degradeDoRealizado(dados: MesDoGrafico[]) {
  const valores = dados.map((d) => d.realizado).filter((v): v is number => v !== null);
  const max = Math.max(0, ...valores);
  const min = Math.min(0, ...valores);
  const maior = Math.max(max, -min);
  if (maior === 0) return { topo: 0, zero: 1, base: 0 };
  return { topo: max / maior, zero: max / (max - min), base: -min / maior };
}

const OURO = "var(--color-bpm-primary)";
const PRETO = "var(--cor-grafico-orcado)";
/** O contorno cinza dos quadradinhos (o ring-black/10 de antes), por fora do quadrado. */
const contorno = <rect x={-0.5} y={-0.5} width={13} height={13} rx={2.5} fill="none" stroke="rgb(0 0 0 / 0.1)" strokeWidth={1} />;

/**
 * O quadradinho de cor das legendas e dos sinais do painel (13/10/2026): em SVG, e não no fundo de um <span>, porque o
 * Firefox desenhava a imagem do Copiar como Imagem sem o fundo dos quadradinhos (ficavam em branco); o SVG sai como os
 * gráficos.
 */
export function Quadradinho({ cor, titulo }: { cor: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 12 12" className="inline-block size-3 shrink-0 overflow-visible" role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      {titulo ? <title>{titulo}</title> : null}
      <rect width={12} height={12} rx={2} style={{ fill: cor }} />
      {contorno}
    </svg>
  );
}

/** O quadradinho da área: o degradê amarelo, forte em cima e transparente embaixo, com o contorno de cima em amarelo-ouro. */
function QuadradinhoDaArea() {
  const id = `legenda-area-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 12 12" className="inline-block size-3 shrink-0 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: OURO }} />
          <stop offset="100%" style={{ stopColor: OURO, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <rect width={12} height={12} rx={2} fill={`url(#${id})`} />
      <rect width={12} height={2} style={{ fill: OURO }} />
      {contorno}
    </svg>
  );
}

/** A legenda das cores: o realizado em amarelo-ouro e o orçado em preto (na Área, a área amarela e a linha preta). */
export function LegendaRealizadoOrcado({ tipo = "barras" }: { tipo?: TipoGrafico }) {
  const rotulos = useRotulosDoGrafico();
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        {tipo === "area" ? <QuadradinhoDaArea /> : <Quadradinho cor={OURO} />}
        {rotulos.realizado}
      </span>
      <span className="inline-flex items-center gap-1.5">
        {tipo === "area" ? (
          <svg viewBox="0 0 12 2" className="inline-block h-0.5 w-3 shrink-0" aria-hidden>
            <rect width={12} height={2} style={{ fill: PRETO }} />
          </svg>
        ) : (
          <Quadradinho cor={PRETO} />
        )}
        {rotulos.orcado}
      </span>
    </>
  );
}
