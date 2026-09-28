/**
 * Recarga dos cadastros vindos da planilha — centros de custo, contas de
 * resultado e estrutura da DRE, com o vínculo das contas às linhas — sem
 * refazer perfis, unidades e linhas. A lógica está em cargaCadastros.ts.
 *
 * Uso: npx tsx prisma/carga-dre.ts
 */
import "dotenv/config";

import { carregarCadastrosDaPasta } from "./cargaCadastros.js";

await carregarCadastrosDaPasta();
