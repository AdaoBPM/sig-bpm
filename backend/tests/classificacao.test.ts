import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classificarLancamento,
  verificarLancamento,
  type CentroParaClassificar,
  type ContaParaClassificar,
} from "../src/services/classificacao/regrasClassificacao.js";

const centro = (
  departamento: string | null,
  atribuicao: CentroParaClassificar["atribuicao"],
  balde: CentroParaClassificar["balde"] = "UNIDADE",
): CentroParaClassificar => ({ id: "cc", departamento, atribuicao, balde });

const conta = (over: Partial<ContaParaClassificar> = {}): ContaParaClassificar => ({
  id: "conta",
  tipoConta: "ANALITICA",
  departamento: "CUSTOS DE PRODUÇÃO (CP)",
  atribuicao: "Mão de Obra Direta",
  balde: "PRODUCAO",
  linhaDREId: "linha",
  linhaDREDescricao: "Salários",
  ...over,
});

describe("verificarLancamento (coluna LANÇ. OK?, por nome)", () => {
  const v = verificarLancamento;
  it("<ERRO!> quando o centro tem parâmetro e a conta não", () => {
    assert.equal(v({ departamento: "DESPESAS ADMINISTRATIVAS (DA)", atribuicao: "INDIRETA" }, { departamento: null, atribuicao: null }), "ERRO_PARAMETRIZACAO");
    assert.equal(v({ departamento: null, atribuicao: "INDIRETA" }, { departamento: "DESPESAS ADMINISTRATIVAS (DA)", atribuicao: null }), "ERRO_PARAMETRIZACAO");
  });

  it("não acusa o caso inverso — conta com parâmetro e centro sem", () => {
    assert.equal(v({ departamento: null, atribuicao: null }, { departamento: "CUSTOS DE PRODUÇÃO (CP)", atribuicao: "Mão de Obra Direta" }), "OK");
  });

  it("para quando a conta não é de custo nem de despesa", () => {
    assert.equal(
      v({ departamento: "DESPESAS ADMINISTRATIVAS (DA)", atribuicao: "INDIRETA" }, { departamento: "RECEITA OPERACIONAL BRUTA (ROB)", atribuicao: "Receita Bruta de Montagem" }),
      "OK",
    );
  });

  it("<DEP.!> e <ATR.!>", () => {
    assert.equal(v({ departamento: "DESPESAS COMERCIAIS (DC)", atribuicao: "INDIRETA" }, { departamento: "CUSTOS DE PRODUÇÃO (CP)", atribuicao: "Mão de Obra Indireta" }), "ERRO_DEPARTAMENTO");
    assert.equal(v({ departamento: "CUSTOS DE PRODUÇÃO (CP)", atribuicao: "INDIRETA" }, { departamento: "CUSTOS DE PRODUÇÃO (CP)", atribuicao: "Mão de Obra Direta" }), "ERRO_ATRIBUICAO");
    assert.equal(v({ departamento: "CUSTOS DE PRODUÇÃO (CP)", atribuicao: "DIRETA" }, { departamento: "CUSTOS DE PRODUÇÃO (CP)", atribuicao: "Gastos Gerais Indiretos" }), "ERRO_ATRIBUICAO");
    assert.equal(v({ departamento: "CUSTOS DE PRODUÇÃO (CP)", atribuicao: "DIRETA" }, { departamento: "CUSTOS DE PRODUÇÃO (CP)", atribuicao: "Mão de Obra Direta" }), "OK");
    assert.equal(v({ departamento: "CUSTOS DE PRODUÇÃO (CP)", atribuicao: "INDIRETA" }, { departamento: "CUSTOS DE PRODUÇÃO (CP)", atribuicao: "Gastos Gerais Variáveis" }), "OK");
  });
});

describe("classificarLancamento", () => {
  it("usa o rateio do centro e prefixa a etiqueta quando é chave de rateio", () => {
    const c = classificarLancamento("1.12.00000001", centro("CUSTOS DE PRODUÇÃO (CP)", "DIRETA", "PRODUCAO"), conta());
    assert.equal(c.validacao, "OK");
    assert.equal(c.alocacao, "RATEIO");
    assert.equal(c.etiqueta, "PRODUÇÃO.CUSTOS DE PRODUÇÃO (CP).Mão de Obra Direta.Salários");
  });

  it("centro no cadastro sem rateio fica sem rateio, não herda o da conta", () => {
    const c = classificarLancamento("1.12.00000001", centro("CUSTOS DE PRODUÇÃO (CP)", "DIRETA", null), conta());
    assert.equal(c.balde, null);
    assert.equal(c.alocacao, "DIRETO");
    assert.equal(c.etiqueta, "CUSTOS DE PRODUÇÃO (CP).Mão de Obra Direta.Salários");
  });

  it("obra: não verifica o lado do centro e usa o rateio da conta", () => {
    const c = classificarLancamento("1.98.00003168", null, conta({ atribuicao: "Mão de Obra Indireta" }));
    assert.equal(c.validacao, "OK");
    assert.equal(c.balde, "PRODUCAO");
  });

  it("lançamento sem centro não é verificado", () => {
    const c = classificarLancamento(null, null, conta({ departamento: null, atribuicao: null }));
    assert.equal(c.validacao, "OK");
    assert.equal(c.centroCustoId, null);
  });

  it("centro com departamento fora da DRE (ALMOXARIFADO) conta como sem parâmetro", () => {
    const c = classificarLancamento("1.96.00000001", centro("ALMOXARIFADO", null, null), conta());
    assert.equal(c.validacao, "OK");
  });

  it("centro fora do cadastro vira pendência", () => {
    const c = classificarLancamento("1.19.00000063", null, conta());
    assert.equal(c.validacao, "CENTRO_NAO_CADASTRADO");
  });

  it("conta analítica sem linha da DRE fica sem destino", () => {
    const c = classificarLancamento("1.12.00000001", centro("CUSTOS DE PRODUÇÃO (CP)", "DIRETA"), conta({ linhaDREId: null, linhaDREDescricao: null }));
    assert.equal(c.validacao, "SEM_DESTINO");
    assert.equal(c.etiqueta, "CUSTOS DE PRODUÇÃO (CP).Mão de Obra Direta.-");
  });
});
