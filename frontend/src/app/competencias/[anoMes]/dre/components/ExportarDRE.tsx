"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

/** A visão na tela: o consolidado, uma unidade (1 a 5) ou um agrupamento de centros. */
export type VisaoExportar = "consolidado" | number | { grupo: string };

type Formato = "xlsx" | "pdf";
/** O que entra no arquivo: a visão na tela, o consolidado e todas as unidades, ou todos os centros de custo. */
type Alcance = "atual" | "unidades" | "centros";
const OPCOES: Array<{ alcance: Alcance; excel: string; pdf: string }> = [
  { alcance: "atual", excel: "Visão Atual", pdf: "Visão Atual" },
  { alcance: "unidades", excel: "Todas as Unidades (uma por aba)", pdf: "Todas as Unidades (uma por página)" },
  { alcance: "centros", excel: "Todos os Centros de Custo (um por aba)", pdf: "Todos os Centros de Custo (um por página)" },
];

/** O nome do arquivo que o backend mandou (filename*, em UTF-8), ou um padrão. */
function nomeDoArquivo(disposicao: string | undefined, padrao: string) {
  const utf8 = disposicao?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) return decodeURIComponent(utf8);
  return disposicao?.match(/filename="([^"]+)"/i)?.[1] ?? padrao;
}

/** O erro vem como blob, porque a resposta esperada era o arquivo. */
async function mensagemDoErro(error: unknown) {
  const dados = (error as { response?: { data?: unknown } }).response?.data;
  if (dados instanceof Blob) {
    try {
      return (JSON.parse(await dados.text()) as { error?: string }).error ?? "Não foi possível exportar.";
    } catch {
      return "Não foi possível exportar.";
    }
  }
  return "Não foi possível exportar.";
}

/** Exportação da DRE apurada em Excel e PDF (Passo 26). */
export function ExportarDRE({ anoMes, visao }: { anoMes: string; visao: VisaoExportar }) {
  const [gerando, setGerando] = useState(false);
  const centros = typeof visao === "object";

  async function baixar(formato: Formato, alcance: Alcance) {
    setGerando(true);
    try {
      const params =
        alcance === "unidades"
          ? { formato, visao: "todas" }
          : alcance === "centros"
            ? { formato, visao: "centros" }
            : centros
              ? { formato, grupo: visao.grupo }
              : { formato, visao: String(visao) };
      const r = await api.get<Blob>(`/proxy/competencias/${anoMes}/dre/exportar`, { params, responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDoArquivo(r.headers["content-disposition"] as string | undefined, `DRE ${anoMes}.${formato}`);
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
          <Button type="button" variant="outline" className="rounded-sm" disabled={gerando}>
            <Download className="size-4" />
            {gerando ? "Gerando…" : "Exportar"}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-[22rem]">
        {(["xlsx", "pdf"] as const).map((formato, i) => (
          <DropdownMenuGroup key={formato}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              {formato === "xlsx" ? <FileSpreadsheet className="size-3.5" /> : <FileText className="size-3.5" />}
              {formato === "xlsx" ? "Excel" : "PDF"}
            </DropdownMenuLabel>
            {OPCOES.map((o) => (
              <DropdownMenuItem key={o.alcance} onClick={() => void baixar(formato, o.alcance)} className="pl-6">
                {formato === "xlsx" ? o.excel : o.pdf}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
