-- A Central de Conectividade (24/10/2026, pedido do Adão): o grupo do menu com as Integrações (em desenvolvimento) e a
-- Biblioteca de APIs, que abre os dados das DREs, dos cards e dos indicadores dos Resultados Empresariais e dos Cenários
-- a outros aplicativos (com o login e a senha do SIG). O grupo entra na matriz dos perfis (o Administrador alcança tudo
-- pelo código; os demais perfis, só depois de liberados na tela Perfis), e os bloqueios da tela (uma API, um usuário ou
-- um endereço) ficam em api_bloqueios. Os acessos pela API ficam na Auditoria (audit_log), como as demais ações.
ALTER TYPE "RecursoSistema" ADD VALUE IF NOT EXISTS 'CENTRAL_CONECTIVIDADE';

CREATE TABLE "api_bloqueios" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "bloqueado_por" TEXT,
    "bloqueado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_bloqueios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_bloqueios_tipo_valor_key" ON "api_bloqueios"("tipo", "valor");
