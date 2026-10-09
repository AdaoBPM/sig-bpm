"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { SeletorPeriodo, useExercicios } from "../components/SeletorPeriodo";
import { mensagemDeErro, relatoriosService, type BlocoPainel, type FormatoPainel, type ItemPainel, type QuadroPainel } from "../services/relatoriosService";

const numero = (casas: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const n0 = numero(0);
const n1 = numero(1);
const n2 = numero(2);

/** R$ com o sinal antes do símbolo (-R$ 381,2K), como nas demais telas. */
const moeda = (v: number, texto: (x: number) => string) => `${v < 0 ? "-" : ""}R$ ${texto(Math.abs(v))}`;

/** Os formatos das células do painel, como na planilha: R$ em milhões (M) ou milhares (K), volumes, percentuais e R$/m³. */
function formatar(v: number | null, f: FormatoPainel) {
  if (v === null) return "—";
  switch (f) {
    case "MILHOES":
      return moeda(v, (x) => `${n1.format(x / 1e6)}M`);
    case "MILHARES":
      return moeda(v, (x) => `${n1.format(x / 1e3)}K`);
    case "M3":
      return `${n0.format(v)} m³`;
    case "PISTAS":
      return `${n0.format(v)} pst`;
    case "PCT":
      return `${n1.format(v * 100)}%`;
    case "PCT_RL":
      return `${n1.format(v * 100)}%/RL`;
    case "RS_M3":
      return moeda(v, (x) => `${n0.format(x)}/m³`);
  }
}

const desvio = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${n1.format(v * 100)}%`);

/** As cores do sinal, as da formatação condicional da planilha. */
const SINAL = {
  1: { cor: "bg-[#92D050]", texto: "Melhor que o orçado" },
  0: { cor: "bg-[#FFFF00]", texto: "Até 5% do orçado" },
  [-1]: { cor: "bg-[#C00000]", texto: "Pior que o orçado" },
} as const;

function Sinal({ s }: { s: BlocoPainel["sinal"] }) {
  if (s === null) return <span className="inline-block size-3 rounded-[2px] border border-gray-300" title="Sem orçado" />;
  return <span className={`inline-block size-3 rounded-[2px] ring-1 ring-black/10 ${SINAL[s].cor}`} title={SINAL[s].texto} aria-label={SINAL[s].texto} />;
}

/** As três células de um período: o realizado (com o percentual embaixo), o orçado e o desvio com o sinal. */
function Periodo({ item, b, formato, primeiro }: { item: ItemPainel; b: BlocoPainel; formato: FormatoPainel; primeiro?: boolean }) {
  return (
    <>
      <td className={`px-3 py-2 text-right align-top whitespace-nowrap ${primeiro ? "" : "border-l border-gray-200"}`}>
        <div className="font-bold text-gray-900">{formatar(b.realizado, formato)}</div>
        {item.base ? (
          <div className="text-xs text-gray-500">
            ▪ {b.base === null ? "—" : `${(item.base.casas === 2 ? n2 : n1).format(b.base * 100)}%`} {item.base.rotulo}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right align-top whitespace-nowrap text-gray-700">{formatar(b.orcado, formato)}</td>
      <td className="px-3 py-2 text-right align-top whitespace-nowrap">
        <span className="inline-flex items-center gap-2 text-gray-900">
          {desvio(b.vsOrcado)}
          <Sinal s={b.sinal} />
        </span>
      </td>
    </>
  );
}

function Quadro({ q, rotuloMes, rotuloAcumulado }: { q: QuadroPainel; rotuloMes: string; rotuloAcumulado: string }) {
  const th = "px-3 text-right text-xs font-bold text-gray-900";
  return (
    // Destaque amarelo-ouro à esquerda, como as tabelas dos relatórios. Sem rolagem vertical própria: os rótulos ficam no alto do quadro (--topo-tabela zerado).
    <div className="overflow-x-auto rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white [--topo-tabela:0px]">
      <table className="tabela-sig w-full min-w-[54rem] border-collapse text-sm">
        <colgroup>
          <col />
          {[0, 1].map((p) => (
            <ColunasDoPeriodo key={p} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} className="px-3 text-left align-bottom text-sm font-bold tracking-wide text-gray-900 uppercase">
              {q.titulo}
            </th>
            <th colSpan={3} className="border-l border-gray-300 px-3 text-center text-xs font-bold text-gray-900">
              {rotuloMes}
            </th>
            <th colSpan={3} className="border-l border-gray-300 px-3 text-center text-xs font-bold text-gray-900">
              {rotuloAcumulado}
            </th>
          </tr>
          <tr className="border-b border-gray-300">
            {[0, 1].map((p) => (
              <Rotulos key={p} th={th} />
            ))}
          </tr>
        </thead>
        <tbody>
          {q.itens.map((i) => (
            <tr key={`${i.titulo}|${i.sigla}`} className={i.separar ? "border-t-2 border-gray-300" : "border-t border-gray-100"}>
              <td className="px-3 py-2 align-top">
                <div className="font-medium whitespace-nowrap text-gray-900">{i.titulo}</div>
                <div className="text-xs whitespace-nowrap text-gray-500">
                  ▪ {i.sigla}{" "}
                  <span title={i.sentido === "↑" ? "Quanto maior, melhor" : "Quanto menor, melhor"} className="font-bold text-gray-700">
                    {i.sentido}
                  </span>
                </div>
              </td>
              <Periodo item={i} b={i.mes} formato={i.formato} />
              <Periodo item={i} b={i.acumulado} formato={i.formatoAcumulado} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ColunasDoPeriodo() {
  return (
    <>
      <col className="w-36" />
      <col className="w-32" />
      <col className="w-32" />
    </>
  );
}

function Rotulos({ th }: { th: string }) {
  return (
    <>
      <th className={`${th} border-l border-gray-300`}>Realizado</th>
      <th className={th}>Orçado</th>
      <th className={th}>vs. Orçado</th>
    </>
  );
}

export function PainelContent() {
  useRegistrarAcessoTela("/relatorios/painel");
  const exercicios = useExercicios();
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  const [aba, setAba] = useState("resultados");
  const ano = anoEscolhido ?? exercicios.anos[0];
  const meses = ano ? exercicios.mesesDe(ano) : [];
  const ate = ateEscolhido && meses.includes(ateEscolhido) ? ateEscolhido : meses[meses.length - 1];
  const consulta = useQuery({
    queryKey: ["relatorios", "painel", ano, ate],
    queryFn: () => relatoriosService.painel(ano!, ate),
    enabled: !!ano && !!ate,
  });
  const dados = consulta.data;
  const atual = dados?.abas.find((a) => a.chave === aba) ?? dados?.abas[0];

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Painel de Bordo"
        comoUsar={
          <ul>
            <li>Escolha o exercício e o mês de referência; o acumulado vai de janeiro até ele.</li>
            <li>Troque entre as abas Resultados e Performance (os unitários).</li>
            <li>Passe o mouse sobre o quadradinho colorido para ler o sinal, e sobre a seta para ver o sentido do indicador.</li>
            <li>O orçado vem das metas importadas: importe a aba Metas (Orçamento) em cada mês, na etapa Importações do Fechamento Mensal.</li>
          </ul>
        }
        sobre={
          <>
            <p>
              O realizado contra o orçado do mês e do acumulado do exercício, como as abas Painel (Resultados) e Painel (Performance) do SIG
              BPM 2026 - INDICADORES DE RESULTADO.
            </p>
            <p>
              O realizado sai dos mesmos valores da tela Indicadores: a DRE apurada, os volumes da apuração e os indicadores importados (ou
              digitados nas Listas Operacionais). O
              orçado sai da aba Metas (Orçamento) do mesmo arquivo, importada mês a mês; o acumulado do orçado segue a aba Metas (soma dos
              meses ou, nas razões, a média ponderada pela base).
            </p>
            <p>
              O desvio (vs. Orçado) é o realizado sobre o orçado, menos 1 (com o orçado negativo, o sinal se inverte). O sinal fica verde
              quando o realizado está do lado bom do orçado, vermelho do lado ruim, e amarelo quando o desvio é de até 5%. O lado bom depende
              do sentido do indicador: ↑ quanto maior, melhor; ↓ quanto menor, melhor.
            </p>
            <p>
              Como na planilha, o resultado financeiro e as despesas fixas aparecem em milhares (K) no mês e em milhões (M) no acumulado. O
              percentual sob o resultado financeiro é sobre a margem de contribuição (/MC).
            </p>
          </>
        }
        acoes={
          ano && ate ? (
            <SeletorPeriodo
              ano={ano}
              ate={ate}
              anos={exercicios.anos}
              meses={meses}
              onAno={(a) => {
                setAno(a);
                setAte(null);
              }}
              onAte={setAte}
            />
          ) : null
        }
      />

      {exercicios.carregando ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : !ano || !ate ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência apurada ainda.</p>
      ) : consulta.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar o painel.")}</p>
        </div>
      ) : !dados || !atual ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : (
        <>
          <Abas rotulo="Painel de Bordo" ativa={atual.chave} onMudar={setAba} abas={dados.abas.map((a) => ({ chave: a.chave, rotulo: a.titulo }))} />

          {dados.mesesSemMeta.length > 0 ? (
            <div className="rounded-sm border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              Sem as metas do orçamento de {dados.mesesSemMeta.join(", ")}: importe a aba Metas (Orçamento) do INDICADORES DE RESULTADO nesses
              meses (etapa Importações). Até lá, o orçado {dados.mesesSemMeta.includes(dados.rotuloMes) ? "do mês e o " : "o "}acumulado ficam sem
              valor.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600">
            {([1, 0, -1] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <Sinal s={s} />
                {SINAL[s].texto}
              </span>
            ))}
          </div>

          <div className="grid gap-4 min-[1800px]:grid-cols-2">
            {atual.quadros.map((q) => (
              <Quadro key={q.titulo} q={q} rotuloMes={dados.rotuloMes} rotuloAcumulado={dados.rotuloAcumulado} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
