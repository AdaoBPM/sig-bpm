"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChartColumn, Pencil } from "lucide-react";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { TabelaIndicadores, valor, valorCurto } from "@/app/relatorios/indicadores/TabelaIndicadores";
import { GraficoIndicadorDialog } from "@/app/relatorios/indicadores/GraficoIndicadorDialog";
import { RotulosDoGrafico, useRotulosDosValores, useTipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { LancamentoDialog } from "../../../components/IndicadoresManuais";
import { AvisoMarcado, estaTravado } from "../../../components/AvisoMarcado";
import { cenariosService, type IndicadorDoCenario } from "../../../services/cenariosService";
import { useTipoDoCenario } from "../../../components/tipoDoCenario";

/** As abas: os indicadores da DRE de Produção e Serviços, os lançamentos manuais e as metas orçadas (todos). */
// As Metas primeiro (12/10/2026): o compilado dos indicadores, como o Consolidado nos Resultados.
const ABAS = [
  { chave: "metas", rotulo: "Metas" },
  { chave: "resultados", rotulo: "Indicadores de Resultados" },
  { chave: "manuais", rotulo: "Indicadores Manuais" },
];
const DA_ABA: Record<string, (i: IndicadorDoCenario) => boolean> = {
  resultados: (i) => i.classe === "RESULTADO" && (i.grupo === "Produção" || i.grupo === "Serviços"),
  manuais: (i) => i.classe === "MANUAL",
  metas: () => true,
};

/** A tela Indicadores de um cenário sintético. */
export function CenarioIndicadoresContent() {
  const { id } = useParams<{ id: string }>();
  const t = useTipoDoCenario();
  useRegistrarAcessoTela(`${t.base}/${id}/indicadores`);
  const { hasPermission } = usePermissions();
  // O cenário marcado não se edita (12/10/2026): os Indicadores Manuais ficam só para leitura, com o aviso.
  const cenario = useQuery({ queryKey: ["cenarios", id], queryFn: () => cenariosService.obter(id) });
  // Também a versão congelada (13/10/2026) trava os Indicadores Manuais.
  const travado = !!cenario.data && estaTravado(cenario.data);
  // No analítico (14/10/2026), os Indicadores Manuais se editam na tela Premissas; aqui ficam só para leitura.
  const analitico = t.tipo === "ANALITICO";
  const podeEditar = hasPermission(t.perm("indicadores", "editar", "manuais")) && !!cenario.data && !travado && !analitico;
  // As abas que o perfil lê (14/10/2026).
  const abas = ABAS.filter((a) => hasPermission(t.perm("indicadores", "ler", a.chave)));
  const [escolhida, setAba] = useState("metas");
  const aba = abas.some((a) => a.chave === escolhida) ? escolhida : (abas[0]?.chave ?? "");
  const [editando, setEditando] = useState<IndicadorDoCenario | null>(null);
  // O gráfico do indicador (16/10/2026), como em Resultados Empresariais: o cenário × o comparado, com o Tipo e os
  // Rótulos guardados neste navegador (os do Painel de Bordo).
  const [comGrafico, setComGrafico] = useState<IndicadorDoCenario | null>(null);
  const [tipoGrafico] = useTipoGrafico();
  const [comRotulos] = useRotulosDosValores();
  const consulta = useQuery({ queryKey: ["cenarios", id, "indicadores"], queryFn: () => cenariosService.indicadores(id) });
  const dados = consulta.data;
  const daAba = aba ? (dados?.indicadores.filter(DA_ABA[aba]) ?? []) : [];
  const manuais = aba === "manuais";
  // Nos Indicadores Manuais que se editam, o clique digita os lançamentos; nos demais, abre o gráfico.
  const digita = manuais && podeEditar;

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Indicadores"
        comoUsar={
          <ul>
            <li>Troque de cenário no nome dele, na barra do topo; ao lado, a tela Resultados. Aparecem só as abas que o seu perfil lê (Controle de Usuários / Perfis).</li>
            <li>Com um cenário comparado (Configurações / Comparativo), a coluna Comparado Acum., em preto e cinza depois do Acumulado, traz o acumulado dele.</li>
            <li>Metas: o compilado dos indicadores — os Indicadores de Resultados e os Indicadores Manuais juntos, com as eficiências calculadas e os importados. É o orçado que Resultados Empresariais usa quando o cenário é o Orçamento Empresarial. Não se edita: muda com a DRE (tela Resultados) e com os Indicadores Manuais.</li>
            <li>Indicadores de Resultados: os de Produção e Serviços que saem da DRE do cenário (custos, volumes, mão de obra, matérias primas, gastos gerais, montagem).</li>
            <li>
              Indicadores Manuais: {analitico ? "os indicadores do Comercial e do Administrativo (os quadros de lotação saem do Quadro de Lotação dos centros de custo, nas Premissas)" : "os quadros de lotação e os indicadores do Comercial e do Administrativo"}, que não saem da DRE. Vêm da aba das metas
              do arquivo importado{analitico ? " ou do resultado realizado; digitam-se na tela Premissas, aba Indicadores Manuais (as células digitadas ficam em amarelo)" : podeEditar ? "; clique numa linha para digitar os meses (as células digitadas ficam em amarelo)" : ""}.
            </li>
            <li>Na lista antes do rótulo Indicador (a seta), escolha Todos os Grupos ou um dos grupos da aba, como a lista dos níveis em Resultados.</li>
            <li>
              Clique num indicador para ver o gráfico dele, como em Resultados Empresariais: os meses do cenário (em amarelo-ouro) e os do cenário comparado
              (em preto), e o acumulado ao lado; sem cenário comparado, só o cenário. O Tipo e os Rótulos do gráfico são os escolhidos no Configurar Gráficos
              do Painel de Bordo.{podeEditar ? " Nos Indicadores Manuais, o clique digita os lançamentos." : ""}
            </li>
            <li>Use os filtros nos rótulos das colunas; as colunas Indicador, Sent. e Und. ficam fixas.</li>
            <li>Os indicadores sem numeração (os totais, como Custos de Produção: Matriz) ficam com a cor da faixa do grupo, e os de numeração par num tom mais fraco (amarelo nas colunas do realizado, cinza nas do comparado), para ajudar a seguir a linha. Nos Indicadores Manuais, as células digitadas ficam num amarelo mais forte.</li>
          </ul>
        }
        sobre={
          <>
            <p>
              Os indicadores do cenário, mês a mês e acumulados, com as fórmulas do cadastro Estrutura dos Indicadores — as mesmas de Resultados
              Realizados — sobre a DRE do cenário e os lançamentos manuais. O acumulado também segue Resultados Empresariais: a soma dos meses ou,
              nas razões, a média ponderada; os de posição valem o último mês.
            </p>
            <p>
              As eficiências (volume ou receita por colaborador) juntam a DRE e os quadros de lotação, e só aparecem nas Metas. A liberação
              de projetos (que vem das Listas) e os GME 4 e 8 o cenário não tem como calcular: ficam com o valor da aba das metas importada.
            </p>
          </>
        }
      />
      <Abas rotulo="Indicadores do cenário" ativa={aba} onMudar={setAba} abas={abas.map((a) => ({ chave: a.chave, rotulo: a.rotulo }))} />
      {aba === "metas" ? (
        <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-600">
          As Metas são o compilado dos indicadores: os Indicadores de Resultados (que saem da DRE do cenário) e os Indicadores Manuais, com as
          eficiências calculadas e os importados (liberação de projetos, GME). Não se editam aqui: mudam com a DRE, na tela Resultados, e com os
          Indicadores Manuais.
        </p>
      ) : null}
      {manuais && cenario.data && travado && hasPermission(t.perm("indicadores", "editar", "manuais")) ? <AvisoMarcado cenario={cenario.data} oQue="os Indicadores Manuais" /> : null}
      {manuais && analitico ? (
        <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-600">
          No cenário analítico, os Indicadores Manuais se digitam na tela Premissas, aba Indicadores Manuais.
        </p>
      ) : null}
      {consulta.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os indicadores do cenário.")}</p>
        </div>
      ) : !dados ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : (
        <TabelaIndicadores
          key={aba}
          meses={dados.meses}
          indicadores={daAba}
          comparado={dados.comparado}
          onClicar={digita ? setEditando : setComGrafico}
          dicaDoClique={digita ? "Digitar os lançamentos do indicador" : "Ver o gráfico do indicador"}
          iconeDoClique={digita ? Pencil : ChartColumn}
          destacar={manuais ? (i, k) => i.digitados[k] : undefined}
          dicaDoDestaque="Valor digitado"
        />
      )}
      {editando && dados ? <LancamentoDialog id={id} indicador={editando} meses={dados.meses} onFechar={() => setEditando(null)} /> : null}
      {comGrafico && dados ? (
        <RotulosDoGrafico.Provider value={{ realizado: "Cenário", orcado: dados.comparado ? `Comparado (${dados.comparado.nome})` : "Comparado" }}>
          <GraficoIndicadorDialog
            indicador={comGrafico}
            meses={dados.meses}
            formatar={(v) => valor(comGrafico, v)}
            formatarCurto={(v) => valorCurto(comGrafico, v)}
            tipo={tipoGrafico}
            comRotulos={comRotulos}
            onFechar={() => setComGrafico(null)}
          />
        </RotulosDoGrafico.Provider>
      ) : null}
    </div>
  );
}
