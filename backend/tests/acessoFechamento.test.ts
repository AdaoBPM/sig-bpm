import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { permissoesDasRotas } from "../src/services/acesso/acesso.js";
import { chaveValida } from "../src/services/acesso/telas.js";

describe("Fechamento Mensal: Totais e Prévias (27/10/2026)", () => {
  const matriz = ["totais", "totais.indicadores", "totais.rateios", "previas", "previas.receita", "previas.estoque", "dre"].map((chave) => ({ chave, acao: "EDITAR" as const }));

  it("as chaves antigas saem do catálogo; as abas novas entram", () => {
    for (const c of ["indicadores_mes", "rateios", "receita", "estoque"]) assert.ok(!chaveValida(c), c);
    for (const c of ["totais", "totais.indicadores", "totais.rateios", "previas", "previas.receita", "previas.estoque", "dre"]) assert.ok(chaveValida(c), c);
  });

  it("sem recorte, as abas valem como as telas antigas (Ler e Editar)", () => {
    const sem = permissoesDasRotas(matriz, { recorteSetor: false, recorteDepartamento: false });
    for (const p of ["totais.indicadores:ler", "totais.rateios:editar", "previas.receita:editar", "previas.estoque:editar"]) assert.ok(sem.includes(p), p);
  });

  it("com o recorte por departamento ou por centro, ficam os Indicadores; saem os Rateios e as Prévias", () => {
    for (const recorte of [{ recorteDepartamento: true }, { recorteDepartamento: false, recorteCentro: true }]) {
      const com = permissoesDasRotas(matriz, { recorteSetor: false, ...recorte });
      assert.ok(com.includes("totais.indicadores:ler"));
      for (const p of ["totais.rateios:ler", "previas:ler", "previas.receita:ler", "previas.estoque:ler"]) assert.ok(!com.includes(p), p);
    }
  });

  it("a aba só vale com a tela lida", () => {
    const soAba = permissoesDasRotas([{ chave: "totais.rateios", acao: "LER" }], { recorteSetor: false, recorteDepartamento: false });
    assert.ok(!soAba.includes("totais.rateios:ler"));
  });
});
