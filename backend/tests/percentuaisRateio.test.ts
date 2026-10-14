import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "../src/generated/prisma/client.js";
import { calcularPercentuais } from "../src/services/volumes/percentuaisRateio.js";
import { REGRAS_RATEIO } from "../src/services/volumes/regrasRateio.js";
import { conflitoDeVigencia, lacunasDasRegras, valeNoMes } from "../src/services/volumes/vigenciasRateio.js";

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

describe("percentuais fixos e vigências das regras de rateio (14/10/2026)", () => {
  const D = (v: number) => new Prisma.Decimal(v);
  const data = (s: string) => new Date(`${s}T00:00:00.000Z`);

  it("o percentual fixo substitui o dos volumes, e o volume continua apurado", () => {
    const r = calcularPercentuais(
      [
        { id: "m", chave: "PRODUCAO", destino: "MATRIZ", origem: "PREFABRICADO_MATRIZ", fixo: D(0.6) },
        { id: "f", chave: "PRODUCAO", destino: "FILIAL", origem: "PREFABRICADO_FILIAL", fixo: D(0.4) },
      ],
      new Map([["PREFABRICADO_MATRIZ", D(100)], ["PREFABRICADO_FILIAL", D(300)]]),
    );
    assert.equal(r[0].percentual.toNumber(), 0.6);
    assert.equal(r[1].percentual.toNumber(), 0.4);
    assert.equal(r[1].quantidade.toNumber(), 300);
  });

  it("a vigência é mensal: vale do mês do início (no dia 1º) até o mês do fim", () => {
    assert.equal(valeNoMes({ inicio: data("2026-01-01"), fim: data("2026-12-31") }, 2026, 12), true);
    assert.equal(valeNoMes({ inicio: data("2026-01-01"), fim: data("2026-12-31") }, 2027, 1), false);
    assert.equal(valeNoMes({ inicio: data("2027-01-15"), fim: null }, 2027, 1), false);
    assert.equal(valeNoMes({ inicio: data("2027-01-15"), fim: null }, 2027, 2), true);
  });

  it("recusa a mesma chave e destino no mesmo mês e a mistura de fixos e por volume; aceita a regra que começa depois do fim", () => {
    const atual = { id: "a", chave: "PRODUCAO", destino: "MATRIZ", inicio: data("2026-01-01"), fim: null, fixo: false };
    const nova = { chave: "PRODUCAO", destino: "MATRIZ", inicio: data("2027-01-01"), fim: null, fixo: false };
    assert.match(conflitoDeVigencia(nova, [atual]) ?? "", /Já existe uma regra/);
    assert.equal(conflitoDeVigencia(nova, [{ ...atual, fim: data("2026-12-31") }]), null);
    // Fixos na Filial, por volume na Matriz, no mesmo período: não.
    assert.match(conflitoDeVigencia({ ...nova, destino: "FILIAL", fixo: true }, [atual]) ?? "", /todas por volume ou todas de percentual fixo/);
    // A própria regra (na edição) não conta.
    assert.equal(conflitoDeVigencia({ ...atual }, [atual]), null);
  });

  it("aponta os meses sem regra de cada chave, até o mês pedido", () => {
    const regras = [
      { chave: "PRODUCAO", destino: "MATRIZ", inicio: data("2026-01-01"), fim: data("2026-12-31"), fixo: false },
      { chave: "PROJETO", destino: "MATRIZ", inicio: data("2026-01-01"), fim: data("2026-02-28"), fixo: false },
      { chave: "PROJETO", destino: "MATRIZ", inicio: data("2026-05-01"), fim: null, fixo: false },
    ];
    const avisos = lacunasDasRegras(regras, ["PRODUCAO", "PROJETO", "ARMADURA"], 2027 * 12 + 11);
    assert.match(avisos[0], /^PRODUCAO: sem regra de JAN\/2027 em diante/);
    assert.match(avisos[1], /^PROJETO: sem regra de MAR\/2026 a ABR\/2026/);
    assert.match(avisos[2], /^ARMADURA: sem regra de JAN\/2026 em diante/);
  });
});
