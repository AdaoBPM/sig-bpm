import { limparNome, nomeDoDepartamento, TIPO_ZIP, zipDeArquivos } from "../../lib/arquivosExportados.js";
import { ESTILO, gerarXlsx, type AbaEscrita, type Celula } from "../../lib/xlsxEscrita.js";
import { arquivoDeResultados, identificacaoLivre, type Bloco, type Formato } from "../relatorios/exportacaoRelatoriosService.js";
import { CenarioError, cenariosService, rotuloVersao } from "./cenariosService.js";

type Usuario = NonNullable<Parameters<typeof cenariosService.obter>[1]>;

const VISOES: Array<{ visao: 0 | 1 | 2 | 3 | 4 | 5; nome: string }> = [
  { visao: 0, nome: "Consolidado" },
  { visao: 1, nome: "Matriz" },
  { visao: 2, nome: "Filial" },
  { visao: 3, nome: "Serviços" },
  { visao: 4, nome: "Despesas e Extra" },
  { visao: 5, nome: "RN" },
];
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type EscopoResultadosDoCenario = { tipo: "visao"; visao: 0 | 1 | 2 | 3 | 4 | 5 } | { tipo: "unidades" };
export type EscopoCentrosDoCenario = { tipo: "centro"; grupo: string } | { tipo: "centros" } | { tipo: "centrosArquivos" };

/** "Cenário Orgânico VER00 (2027)": o nome do cenário nos arquivos. */
const nomeDoCenario = (c: { nome: string; versao: number; ano: number }) => `${/^cen[aá]rio/i.test(c.nome) ? "" : "Cenário "}${c.nome} ${rotuloVersao(c.versao)} (${c.ano})`;

/**
 * A exportação dos cenários (14/10/2026), como a de Resultados Empresariais: a DRE do cenário (a visão na tela ou as seis,
 * uma por aba no Excel ou por página no PDF, no mesmo formato) e, nos analíticos, os centros de custo em Excel (o
 * centro na tela, todos numa planilha — um por aba — ou um arquivo por centro, num ZIP, com o departamento e o centro
 * no nome).
 */
export const exportacaoCenarioService = {
  async resultados(id: string, escopo: EscopoResultadosDoCenario, formato: Formato, usuario: Usuario) {
    const c = await cenariosService.obter(id, usuario);
    const visoes = escopo.tipo === "unidades" ? VISOES : VISOES.filter((v) => v.visao === escopo.visao);
    const bs: Bloco[] = [];
    for (const v of visoes) bs.push({ nome: v.nome, titulo: `${nomeDoCenario(c)} · ${v.nome}`, dados: await cenariosService.resultados(id, v.visao, usuario) });
    const ident = identificacaoLivre(`${nomeDoCenario(c)} · os doze meses do exercício`, usuario.nome);
    const nomeVisao = escopo.tipo === "unidades" ? "todas as unidades" : bs[0].nome;
    return arquivoDeResultados(bs, ident, formato, `${nomeDoCenario(c)} - ${nomeVisao}`, limparNome(`${nomeDoCenario(c)} - ${nomeVisao}.${formato}`));
  },

  async centros(id: string, escopo: EscopoCentrosDoCenario, usuario: Usuario) {
    const c = await cenariosService.obter(id, usuario);
    const lista = await cenariosService.centros(id, usuario);
    // Todos: os grupos com valor no cenário.
    const grupos = escopo.tipo === "centro" ? lista.grupos.filter((g) => g.grupo === escopo.grupo) : lista.grupos.filter((g) => g.total !== 0);
    if (!grupos.length) throw new CenarioError(404, escopo.tipo === "centro" ? "Grupo de centros de custo não encontrado." : "Nenhum centro de custo com valor no cenário.");
    const geracao = identificacaoLivre("", usuario.nome).geracao;
    const abas: Array<{ aba: AbaEscrita; departamento: string; grupo: string }> = [];
    for (const g of grupos) {
      const dados = await cenariosService.centro(id, g.grupo, usuario);
      const departamento = nomeDoDepartamento(g.departamento);
      abas.push({ grupo: g.grupo, departamento, aba: abaDoCentro(g.grupo, departamento, g.destino, nomeDoCenario(c), geracao, lista.meses, dados) });
    }
    const nomeBase = nomeDoCenario(c);
    if (escopo.tipo === "centrosArquivos") {
      const conteudo = zipDeArquivos(abas.map((a) => ({ nome: `${a.departamento} - ${a.grupo} - ${nomeBase}.xlsx`, conteudo: gerarXlsx([a.aba], `${nomeBase} - ${a.grupo}`) })));
      return { nomeArquivo: limparNome(`${nomeBase} - centros de custo (um arquivo por centro).zip`), tipo: TIPO_ZIP, conteudo, visoes: abas.map((a) => a.grupo) };
    }
    const nomeVisao = escopo.tipo === "centro" ? `${abas[0].departamento} - ${abas[0].grupo}` : "todos os centros de custo";
    return { nomeArquivo: limparNome(`${nomeBase} - ${nomeVisao}.xlsx`), tipo: XLSX, conteudo: gerarXlsx(abas.map((a) => a.aba), `${nomeBase} - ${nomeVisao}`), visoes: abas.map((a) => a.grupo) };
  },
};

/** A aba de um grupo de centros: o quadro de lotação e as contas por atribuição, nos doze meses e no total. */
function abaDoCentro(
  grupo: string,
  departamento: string,
  destino: string,
  cenario: string,
  geracao: string,
  meses: Array<{ rotulo: string }>,
  dados: Awaited<ReturnType<typeof cenariosService.centro>>,
): AbaEscrita {
  const soma = (vs: number[]) => vs.reduce((s, v) => s + v, 0);
  const num = (v: number, destaque: boolean): Celula => ({ valor: Math.round(v * 100) / 100, estilo: destaque ? ESTILO.destaqueNumero : ESTILO.itemNumero });
  const cab = (t: string) => ({ valor: t, estilo: ESTILO.cabecalhoDireita });
  const linhas: Celula[][] = [
    [{ valor: `Centro de Custo ${grupo}`, estilo: ESTILO.titulo }],
    [{ valor: `${cenario} · ${departamento} · destino: ${destino}`, estilo: ESTILO.informacao }],
    [{ valor: `Centros: ${dados.grupo.centros.map((x) => `${x.codigo ?? "sem código"} ${x.nome}`).join("; ")}`, estilo: ESTILO.informacao }],
    [{ valor: geracao, estilo: ESTILO.informacao }],
    [],
    [{ valor: "Atribuição", estilo: ESTILO.cabecalho }, { valor: "Conta", estilo: ESTILO.cabecalho }, ...meses.map((m) => cab(m.rotulo)), cab("Total")],
  ];
  const cabecalho = linhas.length;
  // O quadro de lotação: os colaboradores de cada mês; no total, a média.
  linhas.push([
    { valor: "Quadro de Lotação", estilo: ESTILO.destaque },
    { valor: `${dados.lotacao.quadro} (colaboradores; no total, a média)`, estilo: ESTILO.item },
    ...dados.lotacao.valores.map((v) => num(v, false)),
    num(soma(dados.lotacao.valores) / 12, true),
  ]);
  const atribuicoes = [...new Set(dados.contas.map((x) => x.atribuicao))];
  const total = Array<number>(12).fill(0);
  for (const a of atribuicoes) {
    const contas = dados.contas.filter((x) => x.atribuicao === a);
    const sub = Array.from({ length: 12 }, (_, k) => soma(contas.map((x) => x.valores[k])));
    sub.forEach((v, k) => (total[k] += v));
    linhas.push([{ valor: a, estilo: ESTILO.destaque }, { valor: null, estilo: ESTILO.destaque }, ...sub.map((v) => num(v, true)), num(soma(sub), true)]);
    for (const x of contas) linhas.push([{ valor: null, estilo: ESTILO.item }, { valor: x.descricao, estilo: ESTILO.item }, ...x.valores.map((v) => num(v, false)), num(soma(x.valores), false)]);
  }
  linhas.push([{ valor: "Total", estilo: ESTILO.destaque }, { valor: null, estilo: ESTILO.destaque }, ...total.map((v) => num(v, true)), num(soma(total), true)]);
  return { nome: grupo, larguras: [26, 40, ...meses.map(() => 13), 15], linhas, linhaCabecalho: cabecalho, rodape: `${cenario} · Centro de Custo ${grupo}`, paisagem: true, congelarPrimeiraColuna: true };
}
