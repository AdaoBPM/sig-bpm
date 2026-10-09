"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

/** As cores dos gráficos, como os da planilha INDICADORES DE RESULTADO: o realizado em amarelo-ouro e a meta em preto. */
const CORES: ChartConfig = {
  realizado: { label: "Realizado", color: "#ffcc00" },
  orcado: { label: "Orçado", color: "#111111" },
};

export type MesDoGrafico = { mes: string; realizado: number | null; orcado: number | null };

/**
 * O gráfico de colunas mês a mês, realizado × orçado (Painel de Bordo e o gráfico do indicador em Indicadores): o
 * padrão dos gráficos da planilha, com a dica do mês ao passar o mouse.
 */
export function GraficoRealizadoOrcado({
  dados,
  formatar,
  className = "h-28",
  rotulosDosValores = false,
}: {
  dados: MesDoGrafico[];
  /** O valor como a tela mostra (na dica e nos rótulos). */
  formatar: (v: number | null) => string;
  /** A altura (e o que mais couber) do contêiner. */
  className?: string;
  /** Os valores no alto das colunas, no gráfico grande. */
  rotulosDosValores?: boolean;
}) {
  const rotulo = rotulosDosValores
    ? { position: "top" as const, fontSize: 10, fill: "#4b5563", formatter: (v: unknown) => (typeof v === "number" ? formatar(v) : "") }
    : undefined;
  return (
    <ChartContainer config={CORES} className={`aspect-auto w-full ${className}`} initialDimension={{ width: 300, height: 112 }}>
      <BarChart data={dados} margin={{ top: rotulosDosValores ? 18 : 4, right: 0, bottom: 0, left: 0 }} barGap={1} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={4} fontSize={rotulosDosValores ? 12 : 10} interval={0} />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: "#f3f4f6" }}
          content={({ active, payload, label }: TooltipContentProps<number, string>) =>
            active && payload?.length ? (
              <div className="rounded-sm border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
                <p className="font-bold text-gray-900">{label}</p>
                {payload.map((p) => (
                  <p key={String(p.dataKey)} className="flex items-center gap-1.5 text-gray-700">
                    <span className="inline-block size-2.5 rounded-[2px]" style={{ background: p.color }} />
                    {p.dataKey === "realizado" ? "Realizado" : "Orçado"}: {formatar((p.value as number | null) ?? null)}
                  </p>
                ))}
              </div>
            ) : null
          }
        />
        <Bar dataKey="realizado" fill="var(--color-realizado)" radius={[2, 2, 0, 0]} isAnimationActive={false} label={rotulo} />
        <Bar dataKey="orcado" fill="var(--color-orcado)" radius={[2, 2, 0, 0]} isAnimationActive={false} label={rotulo} />
      </BarChart>
    </ChartContainer>
  );
}

/** A legenda das cores: o realizado em amarelo-ouro e o orçado em preto. */
export function LegendaRealizadoOrcado() {
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-[2px] bg-bpm-primary" />
        Realizado
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-[2px] bg-bpm-secondary" />
        Orçado
      </span>
    </>
  );
}
