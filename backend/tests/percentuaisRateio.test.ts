import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "../src/generated/prisma/client.js";
import { calcularPercentuais } from "../src/services/volumes/percentuaisRateio.js";
import { REGRAS_RATEIO } from "../src/services/volumes/regrasRateio.js";

const D = (v: number) => new Prisma.Decimal(v);
const regras = REGRAS_RATEIO.map((r, i) => ({ id: String(i), chave: r.chave, destino: r.destino, origem: r.origem }));

describe("percentuais de rateio", () => {
  it("cada destino é o seu volume sobre a soma da chave; sem volume, zero", () => {
    const totais = new Map([
      ["PREFABRICADO_MATRIZ", D(1065.718)],
      ["PREFABRICADO_FILIAL", D(2319.473)],
      ["METALURGIA_MATRIZ", D(300)],
      ["METALURGIA_MONTAGEM", D(100)],
    ]);
    const p = calcularPercentuais(regras, totais);
    const de = (chave: string, destino: string) => p.find((x) => x.chave === chave && x.destino === destino)!.percentual.toNumber();
    assert.ok(Math.abs(de("PRODUCAO", "MATRIZ") - 0.31481768680112848) < 1e-12);
    assert.equal(de("METALURGIA", "MATRIZ"), 0.75);
    assert.equal(de("METALURGIA", "FILIAL"), 0);
    assert.equal(de("ARMADURA", "MATRIZ"), 0);
    for (const chave of ["PRODUCAO", "METALURGIA"]) {
      const soma = p.filter((x) => x.chave === chave).reduce((a, x) => a + x.percentual.toNumber(), 0);
      assert.ok(Math.abs(soma - 1) < 1e-12);
    }
  });

  it("as 14 regras cobrem as 5 chaves, com destino único por chave", () => {
    assert.equal(regras.length, 14);
    assert.equal(new Set(regras.map((r) => `${r.chave}|${r.destino}`)).size, 14);
    assert.deepEqual([...new Set(regras.map((r) => r.chave))], ["PROJETO", "PRODUCAO", "METALURGIA", "ARMADURA", "ACOMPANHAMENTO"]);
  });
});
