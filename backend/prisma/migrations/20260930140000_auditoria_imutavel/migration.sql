-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at" DESC);


-- O log de auditoria é imutável (SPEC, RF011): nenhum perfil altera ou exclui
-- registro — nem pela API, que não tem rota para isso, nem direto no banco.
-- MIGRAÇÃO PARA POSTGRES: trocar por uma função plpgsql que levanta exceção,
-- com gatilhos BEFORE UPDATE e BEFORE DELETE (ver prisma/PORTABILIDADE.md).
CREATE TRIGGER "audit_log_sem_alteracao" BEFORE UPDATE ON "audit_log"
BEGIN
  SELECT RAISE(ABORT, 'O log de auditoria é imutável: registros não podem ser alterados.');
END;

CREATE TRIGGER "audit_log_sem_exclusao" BEFORE DELETE ON "audit_log"
BEGIN
  SELECT RAISE(ABORT, 'O log de auditoria é imutável: registros não podem ser excluídos.');
END;
