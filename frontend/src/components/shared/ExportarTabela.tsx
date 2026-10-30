"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import type { Coluna } from "@/lib/filtrosDeTabela";
import { plural } from "@/lib/texto";

import { mensagemDoErro, nomeDoArquivo } from "@/app/competencias/[anoMes]/dre/components/ExportarDRE";

/**
 * Uma coluna do Exportar: a da tabela filtrável (`Coluna`) ou uma montada à mão, com o rótulo, o valor e o texto. `moeda`
 * marca a coluna de reais (sem ela, a de número que mostra "R$" também é; `false`, a de número só, mesmo com reais e volumes juntos).
 */
export type ColunaExportavel<T> = Pick<Coluna<T>, "chave" | "rotulo" | "valor" | "texto" | "tipo" | "semFiltro"> & { moeda?: boolean };

/** As colunas que não vão ao arquivo: as de ações e a das caixas de marcar. */
const FORA = new Set(["acoes", "marcar"]);

/** A tabela como a tela mostra: as colunas com rótulo e, em cada linha, o texto (e o número, nas de número). */
function montar<T>(colunas: ColunaExportavel<T>[], linhas: readonly T[]) {
  const cs = colunas.filter((c) => c.rotulo.trim() && !FORA.has(c.chave) && (c.valor || c.texto));
  const tipos = cs.map((c) => {
    if (c.tipo !== "numero") return "texto" as const;
    if (c.moeda === false) return "numero" as const;
    if (c.moeda || linhas.slice(0, 50).some((l) => /R\$/.test(String(c.texto?.(l) ?? "")))) return "moeda" as const;
    return "numero" as const;
  });
  return {
    colunas: cs.map((c, i) => ({ rotulo: c.rotulo, tipo: tipos[i] })),
    linhas: linhas.map((l) =>
      cs.map((c, i) => {
        const v = c.valor?.(l);
        const t = c.texto?.(l);
        const numero = tipos[i] !== "texto" && typeof v === "number" && Number.isFinite(v) ? v : null;
        const texto = t ?? (typeof v === "number" ? v.toLocaleString("pt-BR") : (v ?? ""));
        return { texto: String(texto), numero };
      }),
    ),
  };
}

/**
 * O Exportar das tabelas (30/10/2026, pedido do Adão): o botão amarelo da altura do título, com Excel e PDF, que leva a
 * tabela da tela — as linhas que os filtros dos rótulos deixam, na ordem escolhida, e as colunas com rótulo (sem as
 * ações) — a um arquivo, montado no servidor no padrão das demais exportações do SIG.
 */
export function ExportarTabela<T>({
  titulo,
  subtitulo,
  colunas,
  linhas,
  buscarLinhas,
  quantidade,
}: {
  /** O título do arquivo (e o nome dele): a tela e o recorte, como "Lançamentos Manuais · Controladoria · 09/2026". */
  titulo: string;
  subtitulo?: string | null;
  colunas: ColunaExportavel<T>[];
  /** As linhas como estão na tela (as filtradas e ordenadas, todas as páginas). */
  linhas: readonly T[];
  /** Nas tabelas paginadas no servidor (a Auditoria): busca todas as linhas dos filtros na hora de exportar. */
  buscarLinhas?: () => Promise<readonly T[]>;
  /** Quantas linhas vão (com `buscarLinhas`, o total dos filtros). */
  quantidade?: number;
}) {
  const n = quantidade ?? linhas.length;
  const tela = usePathname();
  const [gerando, setGerando] = useState(false);
  async function baixar(formato: "xlsx" | "pdf") {
    setGerando(true);
    try {
      const todas = buscarLinhas ? await buscarLinhas() : linhas;
      const corpo = { titulo, subtitulo: subtitulo ?? null, tela, ...montar(colunas, todas) };
      const r = await api.post<Blob>("/proxy/exportacoes/tabela", corpo, { params: { formato }, responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDoArquivo(r.headers["content-disposition"] as string | undefined, `${titulo}.${formato}`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      toast.error(await mensagemDoErro(error));
    } finally {
      setGerando(false);
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
            disabled={gerando || !n}
            title={n ? "Exportar a tabela (as linhas com os filtros dela) em Excel ou PDF" : "Nenhuma linha para exportar"}
          >
            <Download className="size-4" />
            {gerando ? "Gerando…" : "Exportar"}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-auto min-w-60">
        {/* O rótulo do menu só vale dentro de um grupo (o GroupLabel do Base UI). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-gray-600">
            {n.toLocaleString("pt-BR")} {plural(n, "linha", "linhas")}, com os filtros da tabela
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void baixar("xlsx")}>
            <FileSpreadsheet />
            Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void baixar("pdf")}>
            <FileText />
            PDF
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
