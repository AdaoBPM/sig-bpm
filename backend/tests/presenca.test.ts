import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { presencaService } from "../src/services/usuarios/presencaService.js";

describe("quem está online (24/10/2026)", () => {
  it("conta quem avisou nos últimos 3 minutos, em ordem alfabética, e tira quem sai", () => {
    const t0 = 1_000_000_000;
    presencaService.marcar("b", "Valdir", t0);
    presencaService.marcar("a", "Adão", t0 + 60_000);
    presencaService.marcar("c", "Maiko", t0 + 60_000);
    assert.deepEqual(presencaService.online(t0 + 120_000), ["Adão", "Maiko", "Valdir"]);
    // Valdir avisou há mais de 3 minutos.
    assert.deepEqual(presencaService.online(t0 + 180_001), ["Adão", "Maiko"]);
    presencaService.sair("c");
    assert.deepEqual(presencaService.online(t0 + 180_001), ["Adão"]);
    presencaService.sair("a");
  });
});
