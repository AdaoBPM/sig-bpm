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
 * O passo prático da escala (19/10/2026): o menor entre 0,1, 0,2, 0,5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1.000,
 * 2.500… que não seja menor que o pedido (acima de 10, os múltiplos de 1, 2,5 e 5; abaixo, de 1, 2 e 5).
 */
export function passoPratico(bruto: number): number {
  if (!(bruto > 0) || !Number.isFinite(bruto)) return 1;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const multiplos = potencia >= 10 ? [1, 2.5, 5, 10] : [1, 2, 5, 10];
  for (const m of multiplos) if (m * potencia >= bruto * (1 - 1e-9)) return m * potencia;
  return 10 * potencia;
}

/**
 * A escala prática (19/10/2026), na unidade mostrada (milhões, milhares, %, m³…): de um múltiplo do passo abaixo do menor
 * valor (ou do zero) a um acima do maior, com uns quatro intervalos, e as casas das marcas (nenhuma com o passo inteiro).
 */
export function escalaPratica(menor: number, maior: number): { min: number; max: number; marcas: number[]; casas: number } {
  const lo = Math.min(0, menor);
  const hi = Math.max(0, maior);
  const passo = passoPratico((hi - lo) / 4);
  const min = Math.floor(lo / passo + 1e-9) * passo;
  const max = hi > 0 ? Math.ceil(hi / passo - 1e-9) * passo : 0;
  const topo = max - min > 0 ? max : passo;
  const marcas: number[] = [];
  for (let v = min; v <= topo + passo * 1e-6; v += passo) marcas.push(Math.abs(v) < passo * 1e-6 ? 0 : Number(v.toPrecision(12)));
  const casas = passo >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(passo) - 1e-9));
  return { min, max: topo, marcas, casas };
}

/**
 * O gráfico dos cards do Painel de Bordo e do indicador em Indicadores (13/10/2026; antes, o GraficoRealizadoOrcado, do Recharts): o mesmo
 * desenho — as colunas do realizado (amarelo-ouro) e do orçado (preto), ou a área do realizado com o degradê e a linha
 * do orçado — num SVG simples que se estica com a caixa (viewBox sem proporção fixa), sem medir a largura nem se
 * redesenhar: o painel tem dezenas de gráficos, e os do Recharts deixavam a rolagem e o menu lateral lentos. Os meses
 * ficam em texto embaixo, e a dica do mês aparece ao passar o mouse.
 */
export function MiniGrafico({
  dados,
  formatar,
  formatarCurto = formatar,
  tipo = "barras",
  comRotulos = false,
  comEscala = false,
  topoComRotulos = TOPO_COM_ROTULOS,
  fatorDaEscala = 1,
}: {
  dados: MesDoGrafico[];
  /** O valor com a unidade (a dica do mês). */
  formatar: (v: number | null) => string;
  /** O valor sem a unidade, com as mesmas casas (os rótulos e a escala, 13/10/2026). */
  formatarCurto?: (v: number | null) => string;
  tipo?: TipoGrafico;
  /** Os valores escritos (caixa Rótulos, 13/10/2026): caixas brancas com o contorno da série; o realizado por cima. */
  comRotulos?: boolean;
  /** Os valores da escala à esquerda (sem os rótulos, 13/10/2026), no mesmo formato dos rótulos. */
  comEscala?: boolean;
  /** O espaço em cima para os rótulos, em % da altura (o gráfico grande de Indicadores precisa de menos). */
  topoComRotulos?: number;
  /**
   * O fator do valor para a unidade mostrada na escala (19/10/2026): 1e-6 nos milhões, 1e-3 nos milhares, 100 nos
   * percentuais; as marcas práticas se escolhem nessa unidade.
   */
  fatorDaEscala?: number;
}) {
  const rotulos = useRotulosDoGrafico();
  const gradiente = `mini-${useId().replace(/:/g, "")}`;
  const [foco, setFoco] = useState<number | null>(null);
  const n = dados.length;
  const valores = dados.flatMap((d) => [d.realizado, d.orcado]).filter(numero);
  // Com a escala, os limites são as marcas práticas em volta dos valores (19/10/2026; antes, o maior e o menor valor).
  const escala = comEscala && !comRotulos ? escalaPratica(Math.min(0, ...valores) * fatorDaEscala, Math.max(0, ...valores) * fatorDaEscala) : null;
  const max = escala ? escala.max / fatorDaEscala : Math.max(0, ...valores);
  const min = escala ? escala.min / fatorDaEscala : Math.min(0, ...valores);
  const faixa = max - min || 1;
  // Com os rótulos, o espaço deles em cima dos positivos e, havendo negativos, também embaixo (13/10/2026: os rótulos dos
  // negativos saíam do gráfico, por cima dos meses).
  // O espaço cresce com o rótulo mais comprido do lado (o padrão vale para uns 4 caracteres, como "10,2"), até a metade.
  const espaco = (lado: number[]) => Math.min(50, (topoComRotulos * Math.max(4, ...lado.map((v) => formatarCurto(v).length))) / 4.5);
  const topo = comRotulos && max > 0 ? espaco(valores.filter((v) => v > 0)) : TOPO;
  const pe = comRotulos && min < 0 ? espaco(valores.filter((v) => v < 0)) : 0;
  const util = 100 - topo - pe;
  const y = (v: number) => topo + ((max - v) / faixa) * util;
  const zero = y(0);
  const faixaX = 100 / n;
  const centro = (i: number) => (i + 0.5) * faixaX;
  const area = tipo === "area";
  const umPonto = n === 1;
  const degrade = degradeDoRealizado(dados);
  // As colunas: 73% da faixa do mês, metade para cada série; o espaço entre os meses, 27% (14/10/2026: 50% maior que os
  // 18% de antes, como o barCategoryGap). No gráfico do acumulado (um só período), os mesmos 73% (23/10/2026: o acumulado tem
  // a largura de um mês nos cards; antes, 82%).
  const coluna = (faixaX * 0.73) / 2;
  const retangulo = (x: number, v: number) => ({ x, y: Math.min(y(v), zero), width: coluna, height: Math.max(Math.abs(y(v) - zero), 0.6) });
  const pontos = (k: "realizado" | "orcado") =>
    dados.flatMap((d, i) => (numero(d[k]) ? [`${centro(i)},${y(d[k] as number)}`] : [])).join(" ");
  const realizados = dados.map((d, i) => ({ i, v: d.realizado })).filter((p): p is { i: number; v: number } => numero(p.v));
  const traco = { vectorEffect: "non-scaling-stroke" as const };
  // A escala: as marcas práticas, sem casas decimais (só com o passo fracionário: 0,1, 0,2, 0,5…), nas linhas da grade.
  const marca = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: escala?.casas ?? 0, maximumFractionDigits: escala?.casas ?? 0 });
  const linhasDaEscala = escala
    ? escala.marcas.map((m) => ({ topo: y(m / fatorDaEscala), texto: marca.format(m) }))
    : [0, 0.25, 0.5, 0.75, 1].map((f) => ({ topo: topo + f * util, texto: formatarCurto(Math.abs(max - f * faixa) < faixa * 1e-9 ? 0 : max - f * faixa) }));
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
        <div className="flex w-10 shrink-0 flex-col">
          <div className="relative min-h-0 flex-1">
            {linhasDaEscala.map((l) => (
              <span
                key={l.topo}
                className="absolute right-1 -translate-y-1/2 text-[10px] leading-none font-bold whitespace-nowrap text-muted-foreground"
                style={{ top: `${l.topo}%` }}
              >
                {l.texto}
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
            {/* A grade e a linha do zero (um pouco mais escura e grossa); com os Rótulos, só a linha do zero (14/10/2026). */}
            {comRotulos
              ? null
              : // As linhas da grade nas marcas da escala (as das pontas e a do zero, não).
                (escala ? linhasDaEscala.slice(1, -1).map((l) => l.topo) : [0.25, 0.5, 0.75].map((f) => topo + f * util))
                  .filter((t) => Math.abs(t - zero) > 0.01)
                  .map((t) => <line key={t} x1={0} x2={100} y1={t} y2={t} stroke="var(--cor-grafico-grade)" strokeWidth={1} style={traco} />)}
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
          {/*
            Os rótulos dos valores (13/10/2026): o do realizado à esquerda do centro do mês e o do orçado à direita, sem se
            cruzarem. Cada um numa faixa de meia coluna (nas Barras, a da coluna da série, com o rótulo no meio dela; na
            Área, a metade do mês, com o rótulo encostado no centro); o rótulo mais largo que a faixa sai para o lado de fora.
          */}
          {comRotulos
            ? (["orcado", "realizado"] as const).flatMap((k) =>
                dados.map((d, i) => {
                  const v = d[k];
                  if (!numero(v)) return null;
                  const esquerda = k === "realizado";
                  const meia = area ? faixaX / 2 : coluna;
                  const negativo = v < 0;
                  const yv = area ? y(v) : negativo ? Math.max(y(v), zero) : Math.min(y(v), zero);
                  return (
                    <div
                      key={`r-${k}-${i}`}
                      className={`pointer-events-none absolute flex ${esquerda ? "z-[2] flex-row-reverse pr-0.5" : "z-[1] pl-0.5"}`}
                      style={{
                        left: `${esquerda ? centro(i) - meia : centro(i)}%`,
                        width: `${meia}%`,
                        top: `${yv}%`,
                        transform: negativo ? "translateY(3px)" : "translateY(calc(-100% - 3px))",
                      }}
                    >
                      <span
                        className={`shrink-0 rounded-[2px] border bg-white py-0.5 text-[12px] leading-[14px] font-bold whitespace-nowrap text-gray-900 [writing-mode:vertical-rl] ${area ? "" : "mx-auto"}`}
                        // Na vertical, lido de baixo para cima: o texto em pé, girado meia volta.
                        style={{ transform: "rotate(180deg)", borderColor: esquerda ? OURO : PRETO }}
                      >
                        {formatarCurto(v)}
                      </span>
                    </div>
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
