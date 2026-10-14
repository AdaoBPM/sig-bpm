import assert from "node:assert/strict";
import { describe, it } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";
import { getPrismaClient } from "../src/config/prisma.js";
import { signToken } from "../src/lib/jwt.js";

/**
 * O usuário inicial (o da carga, id fixo): o e-mail e a senha mudam no cadastro (12/10/2026, o Administrador BPM virou
 * Adão Pinheiro), então o e-mail sai do banco; o login com a senha de desenvolvimento só se testa enquanto ela vale.
 */
const USUARIO_INICIAL_ID = "00000000-0000-0000-0000-000000000001";
const emailInicial = async () => (await getPrismaClient().usuario.findUniqueOrThrow({ where: { id: USUARIO_INICIAL_ID }, select: { email: true } })).email;

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
  it("autentica usuário template em dev", async (t) => {
    const email = await emailInicial();
    const response = await request(app).post("/auth/login").send({ email, password: "admin123" });
    if (response.status === 401) return t.skip("a senha do usuário inicial não é mais a de desenvolvimento");

    assert.equal(response.status, 200);
    assert.ok(response.body.data.token);
    assert.equal(response.body.data.user.email, email);
  });

  it("rejeita credenciais inválidas", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: await emailInicial(), password: "errada" });

    assert.equal(response.status, 401);
  });
});

describe("POST /auditoria/acesso", () => {
  it("registra acesso com token válido", async () => {
    // O token do usuário inicial, sem depender da senha dele.
    const token = signToken({ sub: USUARIO_INICIAL_ID, email: await emailInicial() });

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
