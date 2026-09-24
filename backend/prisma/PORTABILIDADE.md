# Portabilidade SQLite → PostgreSQL

O SIG BPM é desenvolvido contra **SQLite** (arquivo local, sem servidor) e vai para
produção em **PostgreSQL**. Este documento registra as convenções que mantêm o schema
portável e diz exatamente o que muda na migração.

**Regra geral:** o `schema.prisma` é a fonte única. A migração deve exigir a troca de
uma linha — o `provider` — e nada mais.

---

## O que foi testado nesta versão

Prisma **7.8.0**, provider `sqlite`, verificado com `prisma validate` e
`prisma migrate diff`:

| Recurso do Prisma | SQLite | DDL gerado no SQLite | PostgreSQL |
|---|---|---|---|
| `enum` | **suportado** | `TEXT` | tipo `enum` nativo |
| `Json` | **suportado** | `JSONB` | `JSONB` |
| `Decimal` | **suportado** | `DECIMAL` | `DECIMAL(p,s)` |
| `String[]` e demais listas escalares | **não suportado** | — | `text[]` |
| Relações, índices, chaves compostas | suportado | igual | igual |

---

## Convenção 1 — Enums

Use `enum` do Prisma normalmente. **Não** use `String` solto com valores combinados.

```prisma
enum StatusCompetencia {
  ABERTA
  EM_CONFERENCIA
  FECHADA
}
```

- No **SQLite** a coluna é criada como `TEXT`. Não há `CHECK` no banco: quem garante
  o domínio é o Prisma Client, que recusa valor fora do enum antes de gravar.
- No **PostgreSQL** o mesmo enum vira um tipo nativo, com a restrição no banco.
- **Na migração:** nada a fazer no schema. A primeira migração em PostgreSQL cria os
  tipos automaticamente.

**Consequência prática:** durante o desenvolvimento em SQLite, um `INSERT` feito por
fora do Prisma (SQL cru, importação manual) consegue gravar valor inválido. Todo
acesso a dados deve passar pelo Prisma Client.

## Convenção 2 — Listas

Listas escalares não existem no SQLite. **Toda lista vira tabela de relação**, e não
texto serializado.

Motivo da escolha: uma tabela de relação funciona identicamente nos dois bancos, pode
ser indexada e consultada, e não precisa ser reescrita na migração. Serializar em
JSON ou em texto separado por vírgula resolveria só o SQLite e criaria dívida.

Padrão de nomenclatura e documentação:

```prisma
model Usuario {
  /// LISTA: substitui o campo `permissions String[]` do molde.
  permissoes UsuarioPermissao[]
}

/// LISTA-DE: Usuario.permissions (era `String[]` no molde)
model UsuarioPermissao {
  usuarioId String @map("usuario_id")
  permissao String

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@id([usuarioId, permissao])
  @@index([permissao])
  @@map("usuario_permissoes")
}
```

- O campo do lado "um" leva o comentário `/// LISTA:`.
- A tabela do lado "muitos" leva o comentário `/// LISTA-DE: <Modelo>.<campo>`.
- Assim, `grep "LISTA" schema.prisma` devolve o inventário completo das listas.

**Na migração:** nada a fazer. As tabelas de relação vão para o PostgreSQL como
estão. Se em algum momento a equipe preferir voltar a `String[]` no PostgreSQL, a
conversão é um `UPDATE ... array_agg` — mas não há necessidade.

### Inventário de listas

| Modelo | Campo original | Tabela de relação |
|---|---|---|
| `Usuario` | `permissions String[]` (molde) | `UsuarioPermissao` |

*(Atualizar esta tabela a cada lista nova. As listas previstas no `SPEC.md` —
`LinhaDRE.unidadesAplicaveis`, `Usuario.setores` e `ReceitaPrevia.precoContratoIds` —
entram nos passos 2 a 5 seguindo esta mesma convenção.)*

## Convenção 3 — Valores monetários

Use `Decimal`. Ele é aceito nos dois bancos e o Prisma Client devolve um objeto
`Decimal` em JavaScript, com aritmética exata.

**Ressalva do SQLite, que precisa ser conhecida:** o SQLite não tem tipo decimal
nativo. A coluna é declarada `DECIMAL`, mas a afinidade é numérica — na prática o
valor é guardado como ponto flutuante de 64 bits. Para as faixas deste sistema
(valores de até dezenas de milhões, com duas casas), o erro de representação fica na
ordem de 10⁻⁷, muito abaixo de um centavo, e some ao arredondar para duas casas na
apresentação.

Ainda assim:

- **Toda aritmética deve acontecer em JavaScript com `Decimal`**, não em SQL cru.
- **Somas longas devem ser arredondadas para duas casas ao apresentar.**
- Na conferência contra a planilha (RF013 do `SPEC.md`), usar o limite de
  arredondamento configurável já previsto.
- No PostgreSQL a coluna será `DECIMAL(18,2)` de verdade, e a ressalva deixa de
  existir.

## Convenção 4 — Nada de tipos nativos específicos de um banco

Não usar atributos `@db.*` (como `@db.VarChar(255)` ou `@db.Uuid`) enquanto o
provider for SQLite. Eles são específicos por conector e quebram a portabilidade.

---

## Procedimento de migração para PostgreSQL

Quando a TI provisionar o servidor:

1. Trocar `provider = "sqlite"` por `provider = "postgresql"` no `schema.prisma`.
2. Apontar `DATABASE_URL` para o PostgreSQL no `backend/.env`.
3. Trocar o adaptador em `src/config/prisma.ts`: `PrismaBetterSQLite3` → `PrismaPg`
   (o `@prisma/adapter-pg` já está instalado, vem do molde).
4. Apagar a pasta `prisma/migrations` gerada contra o SQLite e rodar
   `npx prisma migrate dev --name init` contra o PostgreSQL — o histórico de
   migrações de desenvolvimento local não tem valor em produção.
5. Rodar a carga inicial dos cadastros.
6. Conferir os tipos gerados: enums nativos criados, `DECIMAL(18,2)` nas colunas
   monetárias, tabelas de relação preservadas.

O passo 4 merece atenção: migrações de SQLite **não** são reaproveitáveis no
PostgreSQL. O que é reaproveitável é o `schema.prisma`, e é por isso que ele precisa
continuar livre de recursos específicos de um conector.
