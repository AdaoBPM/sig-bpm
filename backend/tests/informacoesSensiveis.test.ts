import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "../src/generated/prisma/client.js";
import { ACESSO_TOTAL, type Acesso } from "../src/services/acesso/acesso.js";
import { linhaSensivel, podeVerSensiveis } from "../src/services/acesso/recorteDepartamento.js";
import type { LinhaEstrutura } from "../src/services/dre/apuracaoUnidades.js";
import { linhasDaObra } from "../src/services/dre/obrasService.js";

const linha = (codigo: string, atribuicaoSigla: string | null): LinhaEstrutura => ({
  id: codigo,
  codigo,
  tipo: "ITEM",
  grupo: "CUSTOS DE PRODUÇÃO",
  grupoSigla: codigo.split(".")[0],
  atribuicao: null,
  atribuicaoSigla,
  descricao: codigo,
  expressao: null,
  unidades: [1],
});

describe("Acesso a Informações Sensíveis (27/10/2026)", () => {
  const semAcesso: Acesso = { ...ACESSO_TOTAL, informacoesSensiveis: false };

  it("as linhas sensíveis são as de Mão de Obra Direta e Indireta; a Terceirizada e as demais, não", () => {
    for (const s of ["MOD", "MOI"]) assert.ok(linhaSensivel({ atribuicaoSigla: s }), s);
    for (const s of ["MOT", "GGD", "GGI", null]) assert.ok(!linhaSensivel({ atribuicaoSigla: s }), String(s));
  });

  it("sem o acesso, as movimentações sensíveis ficam de fora; com ele (e no acesso total), todas", () => {
    assert.ok(!podeVerSensiveis(semAcesso, { atribuicaoSigla: "MOD" }));
    assert.ok(!podeVerSensiveis(semAcesso, { atribuicaoSigla: "MOI" }));
    assert.ok(podeVerSensiveis(semAcesso, { atribuicaoSigla: "MOT" }));
    assert.ok(podeVerSensiveis(ACESSO_TOTAL, { atribuicaoSigla: "MOD" }));
  });

  it("nas obras e sem centro, a linha sensível fica com o valor e sem a lupa", () => {
    const linhas = [linha("CPP.MOD.REMUNERACOES_CLT", "MOD"), linha("CPP.MOT.PROJETOS_TERCEIRIZADOS", "MOT")];
    const itens = new Map(linhas.map((l) => [l.codigo, { valor: new Prisma.Decimal(100), n: 1 }]));
    const sem = linhasDaObra(linhas, itens, false, semAcesso);
    const mod = sem.find((l) => l.codigo === "CPP.MOD.REMUNERACOES_CLT")!;
    assert.equal(mod.valor, "100.00");
    assert.equal(mod.podeDetalhar, false);
    assert.equal(sem.find((l) => l.codigo === "CPP.MOT.PROJETOS_TERCEIRIZADOS")!.podeDetalhar, true);
    assert.ok(linhasDaObra(linhas, itens, false, ACESSO_TOTAL).every((l) => l.podeDetalhar));
  });
});
