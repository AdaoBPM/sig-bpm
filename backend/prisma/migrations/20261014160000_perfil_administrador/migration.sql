-- O perfil Administrador (14/10/2026): acesso total a todas as telas, sem recortes; de sistema (não se exclui nem se
-- inativa), não fica sem usuários, e só um Administrador promove outro usuário a Administrador. As permissões gravadas
-- são só para a tela de perfis: o login dá todas pelo código do perfil.
INSERT INTO "perfis" ("id", "codigo", "nome", "descricao", "sistema", "ordem", "ativo", "criado_em", "atualizado_em", "recorte_setor", "recorte_departamento", "recorte_centro")
SELECT lower(hex(randomblob(16))), 'ADMINISTRADOR', 'Administrador', 'Acesso total a todas as telas, sem recortes. Não se exclui nem se inativa, não fica sem usuários, e só um Administrador promove outro usuário a Administrador.', 1, 0, 1, strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR');

INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'CENARIOS_SINTETICOS', 'LER' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'CENARIOS_SINTETICOS', 'EDITAR' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'CENARIOS_ANALITICOS', 'LER' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'CENARIOS_ANALITICOS', 'EDITAR' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'RESULTADOS_REALIZADOS', 'LER' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'RESULTADOS_REALIZADOS', 'EDITAR' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'FECHAMENTO_MENSAL', 'LER' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'FECHAMENTO_MENSAL', 'EDITAR' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'CADASTROS_APURACAO', 'LER' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'CADASTROS_APURACAO', 'EDITAR' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'CADASTROS_CONTROLADORIA', 'LER' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'CADASTROS_CONTROLADORIA', 'EDITAR' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'CONTROLE_USUARIOS', 'LER' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
INSERT OR IGNORE INTO "perfil_permissoes" ("perfil_id", "recurso", "acao") SELECT "id", 'CONTROLE_USUARIOS', 'EDITAR' FROM "perfis" WHERE "codigo" = 'ADMINISTRADOR';
