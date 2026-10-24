import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { criarSequencias, type EventoAuditoria } from "../src/services/auditoriaService.js";

const gravacao = (usuarioId: string, metadados: Record<string, unknown> = {}): EventoAuditoria => ({
  usuarioId,
  usuarioNome: usuarioId,
  acao: "GRAVACAO_RE",
  entidade: "relatorio_executivo",
  entidadeId: "re",
  metadados: { aba: "Comercial", ...metadados },
});
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("as gravações em sequência na Auditoria (24/10/2026)", () => {
  it("fica só a mais recente, com quantas foram, desde quando e as marcas das anteriores", async () => {
    const log: EventoAuditoria[] = [];
    const s = criarSequencias(async (e) => void log.push(e), 60_000);
    const t0 = new Date("2026-10-24T13:00:00Z");
    s.registrar("re|COMERCIAL", gravacao("adao", { paginas: 1, porCima: true }), t0);
    s.registrar("re|COMERCIAL", gravacao("adao", { paginas: 2 }), new Date(t0.getTime() + 2_000));
    s.registrar("re|COMERCIAL", gravacao("adao", { paginas: 3 }), new Date(t0.getTime() + 9_000));
    assert.equal(log.length, 0);
    await s.encerrar("re|");
    assert.equal(log.length, 1);
    assert.deepEqual(log[0].metadados, { aba: "Comercial", paginas: 3, porCima: true, gravacoes: 3, desde: t0.toISOString() });
    assert.equal(log[0].quando?.getTime(), t0.getTime() + 9_000);
  });

  it("outra pessoa no mesmo grupo encerra a sequência; grupos diferentes seguem separados", async () => {
    const log: EventoAuditoria[] = [];
    const s = criarSequencias(async (e) => void log.push(e), 60_000);
    s.registrar("re|COMERCIAL", gravacao("adao"));
    s.registrar("re|PRODUCAO", gravacao("adao"));
    s.registrar("re|COMERCIAL", gravacao("maiko"));
    assert.deepEqual(log.map((e) => e.usuarioId), ["adao"]);
    // Uma gravação só: sem a contagem.
    assert.equal((log[0].metadados as Record<string, unknown>).gravacoes, undefined);
    await s.encerrar();
    assert.deepEqual(log.map((e) => e.usuarioId).sort(), ["adao", "adao", "maiko"]);
  });

  it("sem outra gravação no tempo da sequência, a última entra sozinha", async () => {
    const log: EventoAuditoria[] = [];
    const s = criarSequencias(async (e) => void log.push(e), 20);
    s.registrar("re|COMERCIAL", gravacao("adao"));
    s.registrar("re|COMERCIAL", gravacao("adao"));
    await espera(60);
    assert.equal(log.length, 1);
    assert.equal((log[0].metadados as Record<string, unknown>).gravacoes, 2);
  });
});
