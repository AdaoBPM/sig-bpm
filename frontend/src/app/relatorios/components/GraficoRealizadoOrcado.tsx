"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ComponentProps } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

import { Seletor } from "./SeletorPeriodo";

/** As cores dos gráficos, como os da planilha INDICADORES DE RESULTADO: o realizado em amarelo-ouro e a meta em preto. */
const OURO = "#ffcc00";
// O orçado (e o comparado) em preto; no tema Escuro, cinza-claro (13/10/2026; a variável fica no globals.css).
const PRETO = "var(--cor-grafico-orcado)";
const CORES: ChartConfig = {
  realizado: { label: "Realizado", color: OURO },
  orcado: { label: "Orçado", color: PRETO },
};

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
 * O gráfico mês a mês, realizado × orçado (Painel de Bordo e o gráfico do indicador em Indicadores): o padrão dos
 * gráficos da planilha, com a dica do mês ao passar o mouse. Só se desenha perto da área visível (13/10/2026): o Painel
 * de Bordo tem dezenas de gráficos, e desenhar e redesenhar todos (ao abrir a tela, ao abrir e fechar o menu lateral)
 * deixava a tela lenta; fora da vista, fica um espaço do mesmo tamanho.
 */
export function GraficoRealizadoOrcado(props: ComponentProps<typeof Grafico>) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observador = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { rootMargin: "400px 0px" });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return <div ref={ref}>{visivel ? <Grafico {...props} /> : <div className={`w-full ${props.className ?? "h-28"}`} />}</div>;
}

function Grafico({
  dados,
  formatar,
  className = "h-28",
  rotulosDosValores = false,
  tipo = "barras",
}: {
  dados: MesDoGrafico[];
  /** O valor como a tela mostra (na dica e nos rótulos). */
  formatar: (v: number | null) => string;
  /** A altura (e o que mais couber) do contêiner. */
  className?: string;
  /** Os valores no alto das colunas, no gráfico grande. */
  rotulosDosValores?: boolean;
  tipo?: TipoGrafico;
}) {
  const rotulos = useRotulosDoGrafico();
  const cores = useMemo<ChartConfig>(() => ({ realizado: { ...CORES.realizado, label: rotulos.realizado }, orcado: { ...CORES.orcado, label: rotulos.orcado } }), [rotulos]);
  // O degradê da área: id próprio por gráfico (vários na mesma página).
  const gradiente = `realizado-${useId().replace(/:/g, "")}`;
  // Os valores escritos (o gráfico grande de Indicadores): numa caixa branca com o contorno fino da cor da série (11/10/2026).
  const rotuloDe = (cor: string) => (rotulosDosValores ? (p: unknown) => <RotuloValor {...(p as PropsRotulo)} cor={cor} formatar={formatar} /> : undefined);
  // Um ponto só (o gráfico do acumulado) não forma área: na Área, a coluna do realizado com o mesmo degradê e
  // contorno, e o orçado como uma linha preta na altura dele.
  const umPonto = dados.length === 1;
  const degrade = degradeDoRealizado(dados);
  const area = tipo === "area";
  return (
    // Redesenha uma vez só, depois da animação do menu lateral (200 ms), e não a cada passo dela: o Painel de Bordo tem
    // dezenas de gráficos, e redesenhar todos a cada passo deixava a abertura e o fechamento do menu muito lentos (13/10/2026).
    <ChartContainer config={cores} className={`aspect-auto w-full ${className}`} initialDimension={{ width: 300, height: 112 }} debounce={250}>
      <ComposedChart data={dados} margin={{ top: rotulosDosValores ? 28 : 4, right: area && !umPonto ? 4 : 0, bottom: 0, left: area && !umPonto ? 4 : 0 }} barGap={1} barCategoryGap="18%">
        <defs>
          {/* Transparente no zero e opaco no maior valor do período (em módulo), nos dois sentidos: a forma vai do maior valor
              acima do zero (ou do zero) ao menor abaixo dele (ou ao zero), e a opacidade de cada ponta segue o valor dela. */}
          <linearGradient id={gradiente} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={OURO} stopOpacity={degrade.topo} />
            <stop offset={`${degrade.zero * 100}%`} stopColor={OURO} stopOpacity={0} />
            <stop offset="100%" stopColor={OURO} stopOpacity={degrade.base} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--cor-grafico-grade)" />
        {/* A linha do eixo X um pouco mais escura e grossa que as de grade (10/10/2026). */}
        <XAxis dataKey="mes" tickLine={false} axisLine={{ stroke: "#9ca3af", strokeWidth: 1.5 }} tickMargin={4} fontSize={rotulosDosValores ? 12 : 10} interval={0} padding={area && !umPonto ? (rotulosDosValores ? { left: 44, right: 44 } : { left: 8, right: 8 }) : undefined} />
        <YAxis hide domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]} />
        <Tooltip
          cursor={area && !umPonto ? { stroke: "#d1d5db" } : { fill: "#f3f4f6" }}
          // A dica lê o mês (realizado e orçado) direto dos dados, qualquer que seja a forma desenhada.
          content={({ active, payload, label }: TooltipContentProps<number, string>) => {
            const m = payload?.[0]?.payload as MesDoGrafico | undefined;
            return active && m ? (
              <div className="rounded-sm border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
                <p className="font-bold text-gray-900">{label}</p>
                {(["realizado", "orcado"] as const).map((k) => (
                  <p key={k} className="flex items-center gap-1.5 text-gray-700">
                    <span className="inline-block size-2.5 rounded-[2px]" style={{ background: k === "realizado" ? OURO : PRETO }} />
                    {rotulos[k]}: {formatar(m[k])}
                  </p>
                ))}
              </div>
            ) : null;
          }}
        />
        {!area ? (
          <>
            <Bar dataKey="realizado" fill="var(--color-realizado)" radius={[2, 2, 0, 0]} isAnimationActive={false} label={rotuloDe(OURO)} />
            <Bar dataKey="orcado" fill="var(--color-orcado)" radius={[2, 2, 0, 0]} isAnimationActive={false} label={rotuloDe(PRETO)} />
          </>
        ) : umPonto ? (
          <>
            <Bar dataKey="realizado" maxBarSize={40} isAnimationActive={false} label={rotuloDe(OURO)} shape={(p: unknown) => <ColunaDaArea {...(p as FormaColuna)} gradiente={gradiente} />} />
            {dados[0].orcado !== null ? <ReferenceLine y={dados[0].orcado} stroke={PRETO} strokeWidth={2} ifOverflow="extendDomain" /> : null}
          </>
        ) : (
          <>
            <Area
              dataKey="realizado"
              type="linear"
              fill={`url(#${gradiente})`}
              stroke={OURO}
              strokeWidth={2}
              baseValue={0}
              connectNulls
              dot={false}
              activeDot={{ r: 3, fill: OURO, stroke: "#fff" }}
              isAnimationActive={false}
              label={rotuloDe(OURO)}
            />
            <Line
              dataKey="orcado"
              type="linear"
              stroke={PRETO}
              strokeWidth={2}
              connectNulls
              dot={{ r: 2, fill: PRETO, stroke: PRETO }}
              activeDot={{ r: 3, fill: PRETO, stroke: "#fff" }}
              isAnimationActive={false}
              // Na Área, só o realizado leva o valor escrito (o orçado ficaria por cima dele); o orçado está na dica.
              label={undefined}
            />
          </>
        )}
      </ComposedChart>
    </ChartContainer>
  );
}

/**
 * As paradas do degradê do realizado, na altura da forma (do maior valor acima do zero ao menor abaixo dele): a
 * opacidade das pontas (o valor sobre o maior em módulo) e onde fica o zero (transparente).
 */
function degradeDoRealizado(dados: MesDoGrafico[]) {
  const valores = dados.map((d) => d.realizado).filter((v): v is number => v !== null);
  const max = Math.max(0, ...valores);
  const min = Math.min(0, ...valores);
  const maior = Math.max(max, -min);
  if (maior === 0) return { topo: 0, zero: 1, base: 0 };
  return { topo: max / maior, zero: max / (max - min), base: -min / maior };
}

type PropsRotulo = { x?: number | string; y?: number | string; width?: number | string; value?: unknown };

/** O valor escrito sobre a coluna ou o ponto: caixa branca, contorno fino na cor da série, texto um pouco maior. */
function RotuloValor({ x, y, width, value, cor, formatar }: PropsRotulo & { cor: string; formatar: (v: number | null) => string }) {
  if (typeof value !== "number") return null;
  const texto = formatar(value);
  const fonte = 12;
  const largura = texto.length * fonte * 0.6 + 10;
  const altura = fonte + 6;
  // Na coluna, sobre o meio dela; no ponto da área, sobre ele.
  const cx = Number(x ?? 0) + (width !== undefined ? Number(width) / 2 : 0);
  const topo = Number(y ?? 0) - altura - 4;
  return (
    <g>
      <rect x={cx - largura / 2} y={topo} width={largura} height={altura} rx={2} fill="#ffffff" stroke={cor} strokeWidth={1} />
      <text x={cx} y={topo + altura / 2} textAnchor="middle" dominantBaseline="central" fontSize={fonte} fill="#111827">
        {texto}
      </text>
    </g>
  );
}

type FormaColuna = { x?: number; y?: number; width?: number; height?: number; payload?: MesDoGrafico };

/** A coluna do acumulado na Área: o mesmo degradê da área e o contorno só na ponta do valor, em amarelo-ouro. */
function ColunaDaArea({ x = 0, y = 0, width = 0, height = 0, payload, gradiente }: FormaColuna & { gradiente: string }) {
  const negativo = (payload?.realizado ?? 0) < 0;
  const topo = Math.min(y, y + height);
  const altura = Math.abs(height);
  // A ponta do valor: em cima, ou embaixo quando o realizado é negativo.
  const ponta = negativo ? topo + altura : topo;
  return (
    <g>
      <rect x={x} y={topo} width={width} height={altura} fill={`url(#${gradiente})`} />
      <line x1={x} x2={x + width} y1={ponta} y2={ponta} stroke={OURO} strokeWidth={2} />
    </g>
  );
}

/** A legenda das cores: o realizado em amarelo-ouro e o orçado em preto (na Área, a área amarela e a linha preta). */
export function LegendaRealizadoOrcado({ tipo = "barras" }: { tipo?: TipoGrafico }) {
  const rotulos = useRotulosDoGrafico();
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        {tipo === "area" ? (
          <span className="inline-block size-3 rounded-[2px] border-t-2 border-bpm-primary bg-gradient-to-b from-bpm-primary to-transparent" />
        ) : (
          <span className="inline-block size-3 rounded-[2px] bg-bpm-primary" />
        )}
        {rotulos.realizado}
      </span>
      <span className="inline-flex items-center gap-1.5">
        {tipo === "area" ? <span className="inline-block h-0.5 w-3 bg-[var(--cor-grafico-orcado)]" /> : <span className="inline-block size-3 rounded-[2px] bg-[var(--cor-grafico-orcado)]" />}
        {rotulos.orcado}
      </span>
    </>
  );
}
