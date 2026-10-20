import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { encargosDoGrupo, ITENS_DOS_ENCARGOS, maosDeObraDoGrupo } from "../src/services/cenarios/encargosCenario.js";

const MOD = ["CPP.MOD.REMUNERACOES_CLT", "CPP.MOD.REMUNERACOES_PJ", "CPP.MOD.ENCARGOS_E_BENEFICIOS", "CPP.MOD.HORAS_EXTRAS", "CPP.MOD.MULTAS_RESCISORIAS"];
const MOI = MOD.map((c) => c.replace(".MOD.", ".MOI."));

describe("encargos e benefícios dos centros de custo (19/10/2026)", () => {
  it("o padrão: INSS 29%, FGTS 8%, Férias (+1/3) 1/12 × 4/3 e Décimo Terceiro 1/12", () => {
    const p = Object.fromEntries(ITENS_DOS_ENCARGOS.map((i) => [i.item, i.padrao]));
    assert.equal(p.INSS, 0.29);
    assert.equal(p.FGTS, 0.08);
    assert.equal(Math.round(p.FERIAS! * 1e6) / 1e6, 0.111111);
    assert.equal(Math.round(p.DECIMO_TERCEIRO! * 1e6) / 1e6, 0.083333);
    assert.equal(p.BENEFICIOS, null);
  });

  it("como o exemplo: (Remunerações CLT + Horas Extras) × percentuais + Benefícios Adicionais; o PJ não entra", () => {
    // JAN do Exemplo de Cálculo: 25.000 + 2.000 de horas extras, 1.500 de benefícios e 5.000 de PJ.
    const contas = new Map([["CPP.MOD.REMUNERACOES_CLT", 25000], ["CPP.MOD.HORAS_EXTRAS", 2000], ["CPP.MOD.REMUNERACOES_PJ", 5000]]);
    const r = encargosDoGrupo(MOD, "DIRETA", (c, mes) => (mes === 1 ? (contas.get(c) ?? 0) : 0), (venda, mes) => (venda === "BENEFICIOS" && mes === 1 ? 1500 : undefined));
    // 27.000 × (0,29 + 0,08 + 1/9 + 1/12) + 1.500 = 16.740 (o exemplo dá 16.739,93 com as férias em 1/12 × 1,3333).
    assert.equal(Math.round(r.get("CPP.MOD.ENCARGOS_E_BENEFICIOS")![0] * 100) / 100, 16740);
    assert.equal(r.get("CPP.MOD.ENCARGOS_E_BENEFICIOS")![1], 0);
  });

  it("o percentual gravado vale no lugar do padrão; os benefícios vão para a mão de obra da atribuição do grupo", () => {
    const contas = new Map([["CPP.MOD.REMUNERACOES_CLT", 1000], ["CPP.MOI.REMUNERACOES_CLT", 2000]]);
    const gravado = (venda: string) => (venda === "ENCARGOS_INSS" ? 0.2 : venda === "BENEFICIOS" ? 100 : undefined);
    const r = encargosDoGrupo([...MOD, ...MOI], "INDIRETA", (c) => contas.get(c) ?? 0, gravado);
    const pct = 0.2 + 0.08 + 1 / 9 + 1 / 12;
    assert.equal(Math.round(r.get("CPP.MOD.ENCARGOS_E_BENEFICIOS")![0] * 100) / 100, Math.round(1000 * pct * 100) / 100);
    assert.equal(Math.round(r.get("CPP.MOI.ENCARGOS_E_BENEFICIOS")![0] * 100) / 100, Math.round((2000 * pct + 100) * 100) / 100);
    // Só uma mão de obra (as despesas): os benefícios vão para ela, qualquer que seja a atribuição.
    assert.deepEqual(maosDeObraDoGrupo(MOI, "DIRETA").map((m) => m.beneficios), [true]);
    assert.deepEqual(maosDeObraDoGrupo([...MOD, ...MOI], "DIRETA").map((m) => [m.encargos, m.beneficios]), [["CPP.MOD.ENCARGOS_E_BENEFICIOS", true], ["CPP.MOI.ENCARGOS_E_BENEFICIOS", false]]);
  });
});
