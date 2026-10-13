"use client";

import { useId, useState } from "react";

import { degradeDoRealizado, useRotulosDoGrafico, type MesDoGrafico, type TipoGrafico } from "./GraficoRealizadoOrcado";

const OURO = "#ffcc00";
const PRETO = "var(--cor-grafico-orcado)";
/** A altura do desenho (o viewBox é 100 × 100, esticado na largura e na altura da caixa). */
const TOPO = 4;
const numero = (v: number | null): v is number => v !== null && Number.isFinite(v);

/**
 * O gráfico pequeno dos cards do Painel de Bordo (13/10/2026; antes, o GraficoRealizadoOrcado, do Recharts): o mesmo
 * desenho — as colunas do realizado (amarelo-ouro) e do orçado (preto), ou a área do realizado com o degradê e a linha
 * do orçado — num SVG simples que se estica com a caixa (viewBox sem proporção fixa), sem medir a largura nem se
 * redesenhar: o painel tem dezenas de gráficos, e os do Recharts deixavam a rolagem e o menu lateral lentos. Os meses
 * ficam em texto embaixo, e a dica do mês aparece ao passar o mouse.
 */
export function MiniGrafico({ dados, formatar, tipo = "barras" }: { dados: MesDoGrafico[]; formatar: (v: number | null) => string; tipo?: TipoGrafico }) {
  const rotulos = useRotulosDoGrafico();
  const gradiente = `mini-${useId().replace(/:/g, "")}`;
  const [foco, setFoco] = useState<number | null>(null);
  const n = dados.length;
  const valores = dados.flatMap((d) => [d.realizado, d.orcado]).filter(numero);
  const max = Math.max(0, ...valores);
  const min = Math.min(0, ...valores);
  const faixa = max - min || 1;
  const y = (v: number) => TOPO + ((max - v) / faixa) * (100 - TOPO);
  const zero = y(0);
  const faixaX = 100 / n;
  const centro = (i: number) => (i + 0.5) * faixaX;
  const area = tipo === "area";
  const umPonto = n === 1;
  const degrade = degradeDoRealizado(dados);
  // As colunas: 82% da faixa do mês (o espaço entre os meses, como o barCategoryGap de 18%), metade para cada série.
  const coluna = (faixaX * 0.82) / 2;
  const retangulo = (x: number, v: number) => ({ x, y: Math.min(y(v), zero), width: coluna, height: Math.max(Math.abs(y(v) - zero), 0.6) });
  const pontos = (k: "realizado" | "orcado") =>
    dados.flatMap((d, i) => (numero(d[k]) ? [`${centro(i)},${y(d[k] as number)}`] : [])).join(" ");
  const realizados = dados.map((d, i) => ({ i, v: d.realizado })).filter((p): p is { i: number; v: number } => numero(p.v));
  const traco = { vectorEffect: "non-scaling-stroke" as const };
  return (
    <div className="flex h-28 w-full flex-col">
      <div className="relative min-h-0 flex-1" onMouseLeave={() => setFoco(null)}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="block size-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={gradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={OURO} stopOpacity={degrade.topo} />
              <stop offset={`${degrade.zero * 100}%`} stopColor={OURO} stopOpacity={0} />
              <stop offset="100%" stopColor={OURO} stopOpacity={degrade.base} />
            </linearGradient>
          </defs>
          {/* A grade e a linha do zero (um pouco mais escura e grossa). */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={100} y1={TOPO + f * (100 - TOPO)} y2={TOPO + f * (100 - TOPO)} stroke="var(--cor-grafico-grade)" strokeWidth={1} style={traco} />
          ))}
          {foco !== null ? <rect x={foco * faixaX} y={0} width={faixaX} height={100} style={{ fill: "var(--color-gray-100)" }} /> : null}
          {!area ? (
            dados.map((d, i) => {
              const x0 = centro(i) - coluna;
              return (
                <g key={i}>
                  {numero(d.realizado) ? <rect {...retangulo(x0, d.realizado)} fill={OURO} /> : null}
                  {numero(d.orcado) ? <rect {...retangulo(x0 + coluna, d.orcado)} style={{ fill: PRETO }} /> : null}
                </g>
              );
            })
          ) : umPonto ? (
            <>
              {numero(dados[0].realizado) ? (
                <rect {...retangulo(50 - coluna / 2, dados[0].realizado)} fill={`url(#${gradiente})`} stroke={OURO} strokeWidth={2} style={traco} />
              ) : null}
              {numero(dados[0].orcado) ? <line x1={0} x2={100} y1={y(dados[0].orcado)} y2={y(dados[0].orcado)} strokeWidth={2} style={{ ...traco, stroke: PRETO }} /> : null}
            </>
          ) : (
            <>
              {realizados.length > 1 ? (
                <path
                  d={`M${centro(realizados[0].i)},${zero} ${realizados.map((p) => `L${centro(p.i)},${y(p.v)}`).join(" ")} L${centro(realizados[realizados.length - 1].i)},${zero} Z`}
                  fill={`url(#${gradiente})`}
                />
              ) : null}
              <polyline points={pontos("realizado")} fill="none" stroke={OURO} strokeWidth={2} style={traco} />
              <polyline points={pontos("orcado")} fill="none" strokeWidth={2} style={{ ...traco, stroke: PRETO }} />
            </>
          )}
          <line x1={0} x2={100} y1={zero} y2={zero} stroke="#9ca3af" strokeWidth={1.5} style={traco} />
        </svg>
        {/* A dica: o mês sob o mouse, pela posição dele na largura do gráfico. */}
        <div
          className="absolute inset-0"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setFoco(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))));
          }}
        />
        {foco !== null ? (
          <div
            className="pointer-events-none absolute bottom-full z-20 mb-1 rounded-sm border border-gray-200 bg-white px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm"
            style={{ left: `${centro(foco)}%`, transform: `translateX(${foco === 0 && n > 1 ? "0" : foco === n - 1 && n > 1 ? "-100%" : "-50%"})` }}
          >
            <p className="font-bold text-gray-900">{dados[foco].mes}</p>
            {(["realizado", "orcado"] as const).map((k) => (
              <p key={k} className="flex items-center gap-1.5 text-gray-700">
                <span className="inline-block size-2.5 rounded-[2px]" style={{ background: k === "realizado" ? OURO : PRETO }} />
                {rotulos[k]}: {formatar(dados[foco][k])}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="grid pt-1 text-center text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {dados.map((d, i) => (
          <span key={i} className="truncate">
            {d.mes}
          </span>
        ))}
      </div>
    </div>
  );
}
