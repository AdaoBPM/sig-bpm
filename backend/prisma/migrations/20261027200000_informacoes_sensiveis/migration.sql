-- O Acesso a Informações Sensíveis (27/10/2026, pedido do Adão): sem ele, o perfil não vê as movimentações das linhas de
-- Mão de Obra Direta e Indireta da DRE. Os perfis que já existem ficam com ele (o que viam continua igual); o
-- Administrador tem sempre.
ALTER TABLE "perfis" ADD COLUMN "informacoes_sensiveis" BOOLEAN NOT NULL DEFAULT true;
