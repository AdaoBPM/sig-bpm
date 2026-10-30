import type { Request, Response } from "express";
import { z } from "zod";

import { auditar } from "../../services/auditoriaService.js";
import { exportarTabela } from "../../services/exportacoes/exportacaoTabelaService.js";

/** O Exportar das tabelas das telas (30/10/2026): a tabela que a tela mostra, em Excel ou PDF. */

const tabelaSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  subtitulo: z.string().trim().max(400).nullable().default(null),
  /** A tela de onde veio (para a auditoria). */
  tela: z.string().trim().max(200).nullable().default(null),
  colunas: z
    .array(z.object({ rotulo: z.string().trim().min(1).max(120), tipo: z.enum(["texto", "numero", "moeda"]) }))
    .min(1)
    .max(80),
  linhas: z.array(z.array(z.object({ texto: z.string().max(4000), numero: z.number().finite().nullable() }))).max(100_000),
});

export const exportacoesController = {
  async tabela(request: Request, response: Response) {
    const formato = request.query.formato === "pdf" ? "pdf" : "xlsx";
    const b = tabelaSchema.safeParse(request.body);
    if (!b.success) return response.status(400).json({ error: b.error.issues[0]?.message ?? "Tabela inválida" });
    const x = exportarTabela(b.data, formato, request.user!.nome);
    await auditar({
      usuarioId: request.user!.sub,
      usuarioNome: request.user!.nome,
      acao: "EXPORTACAO",
      entidade: "tela",
      entidadeId: b.data.tela,
      metadados: { tela: b.data.tela, titulo: b.data.titulo, formato, linhas: b.data.linhas.length, arquivo: x.nomeArquivo },
    });
    response.setHeader("Content-Type", x.tipo);
    response.setHeader("Content-Disposition", `attachment; filename="${x.nomeArquivo.normalize("NFD").replace(/[^\x20-\x7e]/g, "")}"; filename*=UTF-8''${encodeURIComponent(x.nomeArquivo)}`);
    return response.send(Buffer.from(x.conteudo));
  },
};
