"use client";

import { useId, useMemo, useState } from "react";
import { Tooltip as Dica } from "@base-ui/react/tooltip";

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
  acumulado = false,
  comparados,
  corDoOrcado = PRETO,
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
  /** O gráfico do acumulado (23/10/2026): a legenda (ACUM.) em negrito e ela e os rótulos 2 px maiores. */
  acumulado?: boolean;
  /**
   * As séries comparadas no lugar do orçado (31/10/2026: os cards PROVA dos Relatórios Executivos, com até quatro
   * cenários), cada uma com o nome e a cor; os valores vêm em `comparados` de cada mês, na mesma ordem.
   */
  comparados?: Array<{ rotulo: string; cor: string }>;
  /** A cor do orçado (31/10/2026: a do cenário, nos cards padrão dos slides com cards PROVA); sem ela, a do tema. */
  corDoOrcado?: string;
}) {
  const rotulos = useRotulosDoGrafico();
  const gradiente = `mini-${useId().replace(/:/g, "")}`;
  const [foco, setFoco] = useState<number | null>(null);
  const n = dados.length;
  // A dica do mês (31/10/2026) presa à faixa dele no gráfico, desenhada por cima de tudo (a dica da Base UI, no corpo da
  // página): dentro do card, ela era cortada pela borda dele (o Zoom, os cards de Indicadores dos Relatórios Executivos, a
  // caixa do acumulado), e, nos cards PROVA, com uma linha por cenário, é mais alta.
  const [grafico, setGrafico] = useState<HTMLDivElement | null>(null);
  const faixaDoMes = useMemo(
    () =>
      foco === null || !grafico
        ? null
        : {
            getBoundingClientRect: () => {
              const r = grafico.getBoundingClientRect();
              return DOMRect.fromRect({ x: r.left + (foco * r.width) / n, y: r.top, width: r.width / n, height: r.height });
            },
          },
    [foco, grafico, n],
  );
  // O realizado primeiro e, depois dele, o orçado ou as séries comparadas.
  const series: Array<{ rotulo: string; cor: string; valor: (d: MesDoGrafico) => number | null }> = [
    { rotulo: rotulos.realizado, cor: OURO, valor: (d) => d.realizado },
    ...(comparados
      ? comparados.map((c, j) => ({ rotulo: c.rotulo, cor: c.cor, valor: (d: MesDoGrafico) => d.comparados?.[j] ?? null }))
      : [{ rotulo: rotulos.orcado, cor: corDoOrcado, valor: (d: MesDoGrafico) => d.orcado }]),
  ];
  const k = series.length;
  const valores = dados.flatMap((d) => series.map((s) => s.valor(d))).filter(numero);
  // Com a escala, os limites são as marcas práticas em volta dos valores (19/10/2026; antes, o maior e o menor valor).
  const escala = comEscala && !comRotulos ? escalaPratica(Math.min(0, ...valores) * fatorDaEscala, Math.max(0, ...valores) * fatorDaEscala) : null;
  const max = escala ? escala.max / fatorDaEscala : Math.max(0, ...valores);
  const min = escala ? escala.min / fatorDaEscala : Math.min(0, ...valores);
  const faixa = max - min || 1;
  // Com os rótulos, o espaço deles em cima dos positivos e, havendo negativos, também embaixo (13/10/2026: os rótulos dos
  // negativos saíam do gráfico, por cima dos meses).
  // O espaço cresce com o rótulo mais comprido do lado (o padrão vale para uns 4 caracteres, como "10,2"), até a metade.
  // No acumulado, os rótulos 2 px maiores pedem o espaço na mesma proporção (14 ÷ 12).
  const espaco = (lado: number[]) => Math.min(50, ((acumulado ? 14 / 12 : 1) * topoComRotulos * Math.max(4, ...lado.map((v) => formatarCurto(v).length))) / 4.5);
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
  // Com mais séries (31/10/2026: os cards PROVA), os mesmos 73% divididos por todas.
  const coluna = (faixaX * 0.73) / k;
  const inicio = (i: number) => centro(i) - (k * coluna) / 2;
  const retangulo = (x: number, v: number, largura = coluna) => ({ x, y: Math.min(y(v), zero), width: largura, height: Math.max(Math.abs(y(v) - zero), 0.6) });
  const pontos = (s: (typeof series)[number]) =>
    dados.flatMap((d, i) => { const v = s.valor(d); return numero(v) ? [`${centro(i)},${y(v)}`] : []; }).join(" ");
  const realizados = dados.map((d, i) => ({ i, v: d.realizado })).filter((p): p is { i: number; v: number } => numero(p.v));
  const traco = { vectorEffect: "non-scaling-stroke" as const };
  // A escala: as marcas práticas, sem casas decimais (só com o passo fracionário: 0,1, 0,2, 0,5…), nas linhas da grade.
  const marca = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: escala?.casas ?? 0, maximumFractionDigits: escala?.casas ?? 0 });
  const linhasDaEscala = escala
    ? escala.marcas.map((m) => ({ topo: y(m / fatorDaEscala), texto: marca.format(m) }))
    : [0, 0.25, 0.5, 0.75, 1].map((f) => ({ topo: topo + f * util, texto: formatarCurto(Math.abs(max - f * faixa) < faixa * 1e-9 ? 0 : max - f * faixa) }));
  const meses = (
    <div className={`grid pt-1 text-center text-muted-foreground ${acumulado ? "text-[12px] font-bold" : "text-[10px]"}`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
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
        <div ref={setGrafico} className="relative min-h-0 flex-1" onMouseLeave={() => setFoco(null)}>
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
              dados.map((d, i) => (
                <g key={i}>
                  {series.map((s, j) => {
                    const v = s.valor(d);
                    return numero(v) ? <rect key={j} {...retangulo(inicio(i) + j * coluna, v)} style={{ fill: s.cor }} /> : null;
                  })}
                </g>
              ))
            ) : umPonto ? (
              <>
                {/* O realizado na largura de antes (metade dos 73%) e cada série comparada numa linha. */}
                {numero(dados[0].realizado) ? (
                  <rect {...retangulo(50 - (faixaX * 0.73) / 4, dados[0].realizado, (faixaX * 0.73) / 2)} fill={`url(#${gradiente})`} stroke={OURO} strokeWidth={2} style={traco} />
                ) : null}
                {series.slice(1).map((s, j) => {
                  const v = s.valor(dados[0]);
                  return numero(v) ? <line key={j} x1={0} x2={100} y1={y(v)} y2={y(v)} strokeWidth={2} style={{ ...traco, stroke: s.cor }} /> : null;
                })}
              </>
            ) : (
              <>
                {realizados.length > 1 ? (
                  <path
                    d={`M${centro(realizados[0].i)},${zero} ${realizados.map((p) => `L${centro(p.i)},${y(p.v)}`).join(" ")} L${centro(realizados[realizados.length - 1].i)},${zero} Z`}
                    fill={`url(#${gradiente})`}
                  />
                ) : null}
                {/* O realizado em área e as séries comparadas em linhas (31/10/2026: todas, nos cards PROVA). */}
                {series.map((s, j) => (
                  <polyline key={j} points={pontos(s)} fill="none" strokeWidth={2} style={{ ...traco, stroke: s.cor }} />
                ))}
              </>
            )}
            <line x1={0} x2={100} y1={zero} y2={zero} stroke="#9ca3af" strokeWidth={1.5} style={traco} />
          </svg>
          {/* Os losangos dos meses na área (13/10/2026), na cor de cada série, fora do SVG esticado para não se deformarem. */}
          {/* Os do realizado por cima. */}
          {area && !umPonto
            ? [...series.slice(1), series[0]].flatMap((s, j) =>
                dados.map((d, i) => {
                  const v = s.valor(d);
                  return numero(v) ? (
                    <span
                      key={`${j}-${i}`}
                      className="pointer-events-none absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 ring-1 ring-white"
                      style={{ left: `${centro(i)}%`, top: `${y(v)}%`, background: s.cor }}
                    />
                  ) : null;
                }),
              )
            : null}
          {/*
            Os rótulos dos valores (13/10/2026): o do realizado à esquerda do centro do mês e o do orçado à direita, sem se
            cruzarem. Cada um numa faixa de meia coluna (nas Barras, a da coluna da série, com o rótulo no meio dela; na
            Área, a metade do mês, com o rótulo encostado no centro); o rótulo mais largo que a faixa sai para o lado de fora.
            Com mais séries (31/10/2026: os cards PROVA), cada uma na sua faixa, da esquerda para a direita, com o rótulo no
            meio dela.
          */}
          {comRotulos
            ? series.flatMap((s, j) =>
                dados.map((d, i) => {
                  const v = s.valor(d);
                  if (!numero(v)) return null;
                  const esquerda = j === 0;
                  const meia = area ? faixaX / k : coluna;
                  const negativo = v < 0;
                  const yv = area ? y(v) : negativo ? Math.max(y(v), zero) : Math.min(y(v), zero);
                  return (
                    <div
                      key={`r-${j}-${i}`}
                      className={`pointer-events-none absolute flex ${esquerda ? "z-[2]" : "z-[1]"} ${k === 2 ? (esquerda ? "flex-row-reverse pr-0.5" : "pl-0.5") : ""}`}
                      style={{
                        left: `${centro(i) - (k * meia) / 2 + j * meia}%`,
                        width: `${meia}%`,
                        top: `${yv}%`,
                        transform: negativo ? "translateY(3px)" : "translateY(calc(-100% - 3px))",
                      }}
                    >
                      <span
                        className={`shrink-0 rounded-[2px] border bg-white py-0.5 font-bold whitespace-nowrap text-gray-900 [writing-mode:vertical-rl] ${acumulado ? "text-[14px] leading-[16px]" : "text-[12px] leading-[14px]"} ${area && k === 2 ? "" : "mx-auto"}`}
                        // Na vertical, lido de baixo para cima: o texto em pé, girado meia volta.
                        style={{ transform: "rotate(180deg)", borderColor: s.cor }}
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
          {/*
            Em cima do gráfico, no centro do mês, sem sair da tela (encosta na borda dela); sem espaço em cima, embaixo do
            gráfico. Por cima de tudo: a apresentação e o bloco ampliado ficam abaixo dela.
          */}
          {foco !== null && faixaDoMes ? (
            <Dica.Root open>
              <Dica.Portal>
                <Dica.Positioner anchor={faixaDoMes} side="top" sideOffset={4} collisionPadding={4} className="pointer-events-none isolate z-[100]">
                  <Dica.Popup className="rounded-sm border border-gray-200 bg-white px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm">
                    <p className="font-bold text-gray-900">{dados[foco].mes}</p>
                    {series.map((s, j) => (
                      <p key={j} className="flex items-center gap-1.5 text-gray-700">
                        <span className="inline-block size-2.5 rounded-[2px]" style={{ background: s.cor }} />
                        {s.rotulo}: {formatar(s.valor(dados[foco]))}
                      </p>
                    ))}
                  </Dica.Popup>
                </Dica.Positioner>
              </Dica.Portal>
            </Dica.Root>
          ) : null}
        </div>
        {meses}
      </div>
    </div>
  );
}
