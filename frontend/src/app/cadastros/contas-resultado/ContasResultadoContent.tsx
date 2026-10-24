"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { BaldeBadge } from "@/components/shared/BaldeBadge";
import { CadastroShell } from "../components/CadastroShell";
import { useEdicaoCadastro } from "../components/EdicaoCadastro";
import { RecarregarPlanilha } from "../components/RecarregarPlanilha";
import {
  cadastrosService,
  type ContaResultado,
} from "../services/cadastrosService";
import { useApenasAtivas } from "../components/ApenasAtivas";

const ativoDoRegistro = (r: { ativo: boolean }) => r.ativo;

const POR_PAGINA_INICIAL = 50;
/** O cadastro inteiro vem de uma vez: o filtro e a ordem das colunas valem para todas as contas. */
const TODOS = 5000;

const COLUNAS: Coluna<ContaResultado>[] = [
  { chave: "reduzido", rotulo: "Reduzido", valor: (c) => c.reduzido },
  { chave: "conta", rotulo: "Conta", valor: (c) => c.conta },
  { chave: "descricao", rotulo: "Descrição", valor: (c) => c.descricao },
  { chave: "tipo", rotulo: "Tipo", valor: (c) => (c.tipoConta === "ANALITICA" ? "Analítica" : "Sintética") },
  {
    chave: "destino",
    rotulo: "Destino na DRE",
    // A analítica sem destino aparece como "sem destino", para achar as pendências pelo filtro.
    valor: (c) => c.linhaDRE?.descricao ?? (c.tipoConta === "ANALITICA" ? "sem destino" : null),
  },
  { chave: "balde", rotulo: "Balde", valor: (c) => c.balde },
];
const EDITAR: Coluna<ContaResultado> = { chave: "editar", rotulo: "", semFiltro: true, classe: "w-12" };

export function ContasResultadoContent() {
  useRegistrarAcessoTela("/cadastros/contas-resultado");

  const edicao = useEdicaoCadastro("contas-resultado");

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "contas-resultado", TODOS],
    queryFn: () =>
      cadastrosService.contasResultado({
        pagina: 1,
        porPagina: TODOS,
      }),
    placeholderData: keepPreviousData,
  });
  const colunas = useMemo(() => (edicao.pode ? [...COLUNAS, EDITAR] : COLUNAS), [edicao.pode]);
  const ativas = useApenasAtivas(data?.itens, ativoDoRegistro);
  const tabela = useTabelaFiltravel(ativas.itens, colunas, { porPaginaInicial: POR_PAGINA_INICIAL });

  return (
    <CadastroShell
      apenasAtivas={ativas.controle}
      titulo="Contas de Resultado"
      comoUsar={
        <ul>
          <li>Use os filtros nos rótulos das colunas.</li>
          <li>Use “Novo” para incluir; o lápis edita, e a exclusão fica dentro da edição.</li>
          <li>
            Na edição, o Departamento escolhe o grupo da DRE, e a Linha da DRE mostra só as linhas dele. Ao trocar o Departamento, fica a linha de mesma
            atribuição e descrição, quando ele tem uma; a Atribuição sai da linha.
          </li>
          <li>
            A gravação é recusada quando nenhuma aba de resultado lê a combinação da Linha da DRE com o Rateio: os lançamentos que seguem o rateio da conta
            (de obras, de centros fora do cadastro e sem centro) ficariam fora do resultado, com a pendência Sem Aba de Resultado. O aviso lista as combinações
            que alguma aba lê, com as abas de cada uma; “Usar” põe a escolhida no formulário, para conferir e gravar.
          </li>
          <li>Ao gravar, as competências ainda não apuradas são reclassificadas; as apuradas só mudam se forem reapuradas.</li>
          <li>“Recarregar da Planilha” mostra o que muda em relação ao arquivo enviado antes de gravar.</li>
          <li>Marque “Apenas Ativas”, ao lado dos botões, para esconder os registros inativos.</li>
          <li>Com movimentos (lançamentos, valores apurados, registros das listas), o Reduzido e a exclusão ficam bloqueados: essas informações ligam o cadastro a outras telas. O motivo aparece na edição; os demais campos continuam editáveis.</li>
          <li>Mudar este cadastro com uma competência apurada e ainda não fechada pede reapurar (vale para todos os Cadastros da Controladoria): até lá, ela não fecha, e a DRE mostra o aviso. Ao gravar, a mensagem diz quais competências reapurar.</li>
        </ul>
      }
      descricao="As contas de resultado, editáveis aqui. O departamento escolhe o grupo da DRE; a atribuição vem da linha de destino."
      acoes={
        <div className="flex items-center gap-2">
          <RecarregarPlanilha />
          {edicao.botaoNovo}
        </div>
      }
      total={tabela.total}
      pagina={tabela.pagina}
      porPagina={tabela.porPagina}
      onPorPaginaChange={tabela.setPorPagina}
      onPaginaChange={tabela.setPagina}
      carregando={isPending}
      filtros={{ totalGeral: tabela.totalGeral, ativos: tabela.ativos, onLimpar: tabela.limpar }}
    >
      <DataTable<ContaResultado>
        data={tabela.visiveis}
        cabecalho={tabela.cabecalho}
        filtrosAtivos={tabela.ativos}
        onLimparFiltros={tabela.limpar}
        isLoading={isPending}
        error={isError ? "Erro ao carregar as contas de resultado." : null}
        emptyMessage="Nenhuma conta encontrada"
        emptyHint="Ajuste os filtros para ver outros registros."
        columns={[
          "Reduzido",
          "Conta",
          "Descrição",
          "Tipo",
          "Destino na DRE",
          "Balde",
          ...edicao.colunaEditar,
        ]}
        renderRow={(item) => {
          // Conta analítica sem destino na DRE não entra na apuração — é a
          // pendência que impede o fechamento da competência (RF006).
          const pendente = item.tipoConta === "ANALITICA" && !item.linhaDRE;

          return (
            <tr
              key={item.id}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {item.reduzido}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {item.conta}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {item.descricao}
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {item.tipoConta === "ANALITICA" ? "Analítica" : "Sintética"}
              </td>
              <td className="px-4 py-3 text-sm">
                {item.linhaDRE ? (
                  <span className="text-gray-900">{item.linhaDRE.descricao}</span>
                ) : pendente ? (
                  <span className="inline-flex items-center gap-1 text-yellow-800">
                    <AlertTriangle className="size-3.5" />
                    sem destino
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm">
                <BaldeBadge balde={item.balde} />
              </td>
              {edicao.pode ? <td className="w-12 px-2 py-3">{edicao.botaoEditar(item.id)}</td> : null}
            </tr>
          );
        }}
      />
      {edicao.dialogo}
    </CadastroShell>
  );
}
