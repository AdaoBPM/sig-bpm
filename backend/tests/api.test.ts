import assert from "node:assert/strict";
import { describe, it } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";

describe("GET /health", () => {
  it("retorna status ok e totvs mock", async () => {
    const response = await request(app).get("/health");

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "ok");
    assert.equal(typeof response.body.data.totvs.configured, "boolean");
    assert.equal(response.body.data.totvs.mode, "mock");
  });
});

describe("POST /auth/login", () => {
  it("autentica usuário template em dev", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: "admin@bpm.com", password: "admin123" });

    assert.equal(response.status, 200);
    assert.ok(response.body.data.token);
    assert.equal(response.body.data.user.email, "admin@bpm.com");
  });

  it("rejeita credenciais inválidas", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: "admin@bpm.com", password: "errada" });

    assert.equal(response.status, 401);
  });
});

describe("POST /auditoria/acesso", () => {
  it("registra acesso com token válido", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "admin@bpm.com", password: "admin123" });

    const token = login.body.data.token as string;

    const response = await request(app)
      .post("/auditoria/acesso")
      .set("Authorization", `Bearer ${token}`)
      .send({ tela: "/dashboard" });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.registrado, true);
  });

  it("exige autenticação", async () => {
    const response = await request(app)
      .post("/auditoria/acesso")
      .send({ tela: "/dashboard" });

    assert.equal(response.status, 401);
  });
});
