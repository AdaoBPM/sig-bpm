-- O Tipo da unidade de negócio saiu do cadastro (pedido de 09/10/2026): a unidade é identificada pelo código e,
-- onde a planilha a cita (as abas Realizado (…) da carga da Estrutura da DRE), pelo nome. Só remove a coluna
-- (sem recriar a tabela). Backup do banco antes da remoção em Backups/2026-10-09 antes de remover tipo da unidade.
ALTER TABLE "unidades_negocio" DROP COLUMN "tipo";
