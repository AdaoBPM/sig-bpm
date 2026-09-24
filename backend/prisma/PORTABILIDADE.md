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
model Perfil {
  /// LISTA: o que este perfil pode fazer, por recurso e ação.
  permissoes PerfilPermissao[]
}

/// LISTA-DE: Perfil.permissoes
model PerfilPermissao {
  perfilId String         @map("perfil_id")
  recurso  RecursoSistema
  acao     AcaoPermissao

  perfil Perfil @relation(fields: [perfilId], references: [id], onDelete: Cascade)

  @@id([perfilId, recurso, acao])
  @@index([recurso, acao])
  @@map("perfil_permissoes")
}
```

- O campo do lado "um" leva o comentário `/// LISTA:`.
- A tabela do lado "muitos" leva o comentário `/// LISTA-DE: <Modelo>.<campo>`.
- Assim, `grep "LISTA" schema.prisma` devolve o inventário completo das listas.

**Na migração:** nada a fazer. As tabelas de relação vão para o PostgreSQL como
estão. Se em algum momento a equipe preferir voltar a `String[]` no PostgreSQL, a
conversão é um `UPDATE ... array_agg` — mas não há necessidade.

### Inventário de listas

| Modelo | Campo original | Tabela de relação | Passo |
|---|---|---|---|
| `Perfil` | `permissoes` | `PerfilPermissao` | 5 (revisão) |
| `LinhaDRE` | `unidadesAplicaveis` | `LinhaDREUnidade` | 2 |
| `Usuario` | `setores` | `UsuarioSetor` | 3 |
| `ReceitaPrevia` | `precoContratoIds` | `ReceitaPreviaPreco` | 5 |

*(Atualizar esta tabela a cada lista nova.)*

Repare que `LinhaDREUnidade` teria virado tabela de relação mesmo em PostgreSQL: a
lista é de referências a `UnidadeNegocio`, e a relação dá integridade referencial que
um `String[]` não daria. O mesmo vale para `ReceitaPrevia.precoContratoIds`.

### Inventário de enums

| Enum | Onde é usado |
|---|---|
| `TipoUnidade` | `UnidadeNegocio.tipo` |
| `TipoConta` | `ContaResultado.tipoConta` |
| `SinalBalancete` | `ContaResultado.sinalBalancete` |
| `TipoLinhaDRE` | `LinhaDRE.tipo` |
| `AtribuicaoCusto` | `CentroCusto.atribuicao` |
| `ChaveRateio` | `CentroCusto.chaveRateio`, `ContaResultado.chaveRateio`, `RegraRateio.chave` |
| `BaseFisica` | `RegraRateio.baseFisica` |
| `RecursoSistema` | `PerfilPermissao.recurso` |
| `AcaoPermissao` | `PerfilPermissao.acao` |
| `StatusCompetencia` | `Competencia.status` |
| `TipoImportacao` | `Importacao.tipo`, `UsuarioSetor.tipoLista` |
| `StatusImportacao` | `Importacao.status` |
| `TipoDivergencia` | `Divergencia.tipo` |
| `StatusDivergencia` | `Divergencia.status` |
| `TipoVenda` | `Obra.tipoVenda` |
| `SituacaoCadastroObra` | `Obra.situacaoCadastro` |
| `TipoAlocacao` | `LancamentoContabil.alocacao` |
| `ValidacaoLancamento` | `LancamentoContabil.validacao` |
| `UnidadeMedida` | as treze listas operacionais |
| `TipoLinha` | `Linha.tipo` |
| `NaturezaReceita` | `ReceitaPrevia.natureza` |

### Convenção 5 — Ordem dos cadastros

Todo cadastro tem `id` (chave interna) e `ordem` (posição na tela, que o usuário
reorganiza subindo e descendo itens).

`ordem` é **apresentação**: é `Int` **sem restrição de unicidade**, porque uma troca
de posição entre dois itens falharia contra um índice único aplicado imediatamente.
A reordenação renumera a sequência do cadastro inteiro.

Nenhuma regra de negócio pode se apoiar na `ordem`. Quando um registro precisa
referenciar outro, a referência é pelo `id` ou por um `codigo` estável — é por isso
que `LinhaDRE` tem `codigo String @unique`, e que as expressões de subtotal
(`"ROL - CPV"`) usam o código, não o número da linha.

### Cuidado com a palavra "atribuição"

A planilha usa o mesmo rótulo para duas coisas diferentes, e o schema as separa:

- **`CentroCusto.atribuicao`** é `DIRETA` ou `INDIRETA` — por isso virou o enum
  `AtribuicaoCusto`.
- **`ContaResultado.atribuicao`** é o subgrupo da DRE, como "Receita Bruta de
  Montagem" ou "Mão de Obra Direta" — texto livre, alinhado com
  `LinhaDRE.atribuicao`.

Confundir as duas ao importar os cadastros produziria uma classificação errada sem
gerar erro algum.

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
3. Trocar o adaptador em `src/config/prisma.ts`: `PrismaBetterSqlite3` → `PrismaPg`
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
