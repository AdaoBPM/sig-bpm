/**
 * Especificação OpenAPI 3 — mantida em TypeScript para funcionar em dev (tsx) e prod (dist).
 * Expandir conforme novos módulos forem adicionados ao SPEC.
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "BPM Template API",
    version: "1.0.0",
    description:
      "API Express de referência. Documentação interativa em `/api/docs`. " +
      "Integrações SOAP/XML (TOTVS): ver `totvsService` e libs `soap` + `xml2js`.",
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Desenvolvimento local",
    },
  ],
  tags: [
    { name: "Health", description: "Disponibilidade da API" },
    { name: "Auth", description: "Autenticação JWT" },
    { name: "Auditoria", description: "Registro de ações de negócio" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Mensagem de erro" },
        },
        required: ["error"],
      },
      LoginRequest: {
        type: "object",
        properties: {
          email: { type: "string", format: "email", example: "admin@bpm.com" },
          password: { type: "string", format: "password", example: "admin123" },
        },
        required: ["email", "password"],
      },
      LoginResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              token: { type: "string" },
              user: { $ref: "#/components/schemas/User" },
            },
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          nome: { type: "string" },
          email: { type: "string", format: "email" },
          permissions: {
            type: "array",
            items: { type: "string" },
            example: ["dashboard:view", "pedidos:view"],
          },
        },
      },
      HealthResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              status: { type: "string", example: "ok" },
              totvs: {
                type: "object",
                properties: {
                  configured: { type: "boolean" },
                  mode: { type: "string", example: "mock" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
      RegistrarAcessoRequest: {
        type: "object",
        properties: {
          tela: { type: "string", example: "/dashboard" },
        },
        required: ["tela"],
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Verifica se a API está operacional e o status stub da integração TOTVS.",
        responses: {
          "200": {
            description: "API operacional",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        description:
          "Autentica com e-mail e senha. Em dev, usuário template: `admin@bpm.com` / `admin123`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Token JWT emitido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          "401": {
            description: "Credenciais inválidas",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "422": {
            description: "Payload inválido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": {
            description: "Muitas tentativas de login",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Usuário autenticado",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Dados do usuário logado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Não autenticado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/auditoria/acesso": {
      post: {
        tags: ["Auditoria"],
        summary: "Registrar acesso a tela",
        description:
          "Auditoria de negócio (ação ACESSO). Persiste em `audit_log` se DATABASE_URL existir; senão log no console.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegistrarAcessoRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Registro aceito",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: { registrado: { type: "boolean" } },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Não autenticado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
} as const;
