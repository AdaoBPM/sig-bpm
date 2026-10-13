"use client";

import { useId, useState } from "react";

import { degradeDoRealizado, useRotulosDoGrafico, type MesDoGrafico, type TipoGrafico } from "./GraficoRealizadoOrcado";

const OURO = "#ffcc00";
const PRETO = "var(--cor-grafico-orcado)";
/** A altura do desenho (o viewBox é 100 × 100, esticado na largura e na altura da caixa). */
const TOPO = 4;
/** Com os rótulos (na vertical, 13/10/2026), mais espaço em cima para o rótulo do maior valor. */
const TOPO_COM_ROTULOS = 34;
const numero = (v: number | null): v is number => v !== null && Number.isFinite(v);

/**
 * O gráfico pequeno dos cards do Painel de Bordo (13/10/2026; antes, o GraficoRealizadoOrcado, do Recharts): o mesmo
 * desenho — as colunas do realizado (amarelo-ouro) e do orçado (preto), ou a área do realizado com o degradê e a linha
 * do orçado — num SVG simples que se estica com a caixa (viewBox sem proporção fixa), sem medir a largura nem se
 * redesenhar: o painel tem dezenas de gráficos, e os do Recharts deixavam a rolagem e o menu lateral lentos. Os meses
 * ficam em texto embaixo, e a dica do mês aparece ao passar o mouse.
 */
export function MiniGrafico({
  dados,
  formatar,
  tipo = "barras",
  comRotulos = false,
  comEscala = false,
}: {
  dados: MesDoGrafico[];
  formatar: (v: number | null) => string;
  tipo?: TipoGrafico;
  /** Os valores escritos (caixa Rótulos, 13/10/2026): caixas brancas com o contorno da série; o realizado por cima. */
  comRotulos?: boolean;
  /** Os valores da escala à esquerda (sem os rótulos, 13/10/2026), no mesmo formato dos rótulos. */
  comEscala?: boolean;
}) {
  const rotulos = useRotulosDoGrafico();
  const gradiente = `mini-${useId().replace(/:/g, "")}`;
  const [foco, setFoco] = useState<number | null>(null);
  const n = dados.length;
  const valores = dados.flatMap((d) => [d.realizado, d.orcado]).filter(numero);
  const max = Math.max(0, ...valores);
  const min = Math.min(0, ...valores);
  const faixa = max - min || 1;
  const topo = comRotulos ? TOPO_COM_ROTULOS : TOPO;
  const y = (v: number) => topo + ((max - v) / faixa) * (100 - topo);
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
  // A escala: o valor nas linhas da grade (em cima, a cada quarto e embaixo).
  const linhasDaEscala = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ topo: topo + f * (100 - topo), valor: max - f * faixa }));
  const meses = (
    <div className="grid pt-1 text-center text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {dados.map((d, i) => (
        <span key={i} className="truncate">
          {d.mes}
        </span>
      ))}
    </div>
  );
  return (
    // A altura do card (13/10/2026): os meses ficam perto do pé dele; no mínimo, a altura de antes.
    <div className="flex h-full min-h-28 w-full">
      {comEscala ? (
        <div className="flex w-12 shrink-0 flex-col">
          <div className="relative min-h-0 flex-1">
            {linhasDaEscala.map((l) => (
              <span
                key={l.topo}
                className="absolute right-1 -translate-y-1/2 text-[9px] leading-none whitespace-nowrap text-muted-foreground"
                style={{ top: `${l.topo}%` }}
              >
                {formatar(Math.abs(l.valor) < faixa * 1e-9 ? 0 : l.valor)}
              </span>
            ))}
          </div>
          {/* O espaço da linha dos meses, para a escala acompanhar a altura do gráfico. */}
          <div className="invisible" aria-hidden>
            {meses}
          </div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
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
              <line key={f} x1={0} x2={100} y1={topo + f * (100 - topo)} y2={topo + f * (100 - topo)} stroke="var(--cor-grafico-grade)" strokeWidth={1} style={traco} />
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
          {/* Os losangos dos meses na área (13/10/2026), na cor de cada série, fora do SVG esticado para não se deformarem. */}
          {area && !umPonto
            ? (["orcado", "realizado"] as const).flatMap((k) =>
                dados.map((d, i) =>
                  numero(d[k]) ? (
                    <span
                      key={`${k}-${i}`}
                      className="pointer-events-none absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 ring-1 ring-white"
                      style={{ left: `${centro(i)}%`, top: `${y(d[k] as number)}%`, background: k === "realizado" ? OURO : PRETO }}
                    />
                  ) : null,
                ),
              )
            : null}
          {/* Os rótulos dos valores: os do orçado primeiro e os do realizado depois, por cima quando se sobrepõem. */}
          {comRotulos
            ? (["orcado", "realizado"] as const).flatMap((k) =>
                dados.map((d, i) => {
                  const v = d[k];
                  if (!numero(v)) return null;
                  // Nas colunas, sobre a coluna da série (o realizado à esquerda); na área, sobre o ponto.
                  const x = area ? centro(i) : centro(i) + (k === "realizado" ? -coluna / 2 : coluna / 2);
                  const negativo = v < 0;
                  const yv = area ? y(v) : negativo ? Math.max(y(v), zero) : Math.min(y(v), zero);
                  return (
                    <span
                      key={`r-${k}-${i}`}
                      className={`pointer-events-none absolute rounded-[2px] border bg-white py-0.5 text-[9px] leading-[11px] whitespace-nowrap text-gray-900 [writing-mode:vertical-rl] ${k === "realizado" ? "z-[2]" : "z-[1]"}`}
                      style={{
                        left: `${x}%`,
                        top: `${yv}%`,
                        // Na vertical, lido de baixo para cima (13/10/2026): o texto em pé, girado meia volta.
                        transform: negativo ? "translate(-50%, 3px) rotate(180deg)" : "translate(-50%, calc(-100% - 3px)) rotate(180deg)",
                        borderColor: k === "realizado" ? OURO : PRETO,
                      }}
                    >
                      {formatar(v)}
                    </span>
                  );
                }),
              )
            : null}
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
              className="pointer-events-none absolute bottom-full z-30 mb-1 rounded-sm border border-gray-200 bg-white px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm"
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
        {meses}
      </div>
    </div>
  );
}
