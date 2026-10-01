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

  async function baixar(formato: Formato, todas: boolean) {
    setGerando(true);
    try {
      const params = centros ? { formato, grupo: visao.grupo } : { formato, visao: todas ? "todas" : String(visao) };
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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-gray-500">{centros ? "Este centro de custo" : "Esta visão"}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void baixar("xlsx", false)}>
            <FileSpreadsheet />
            Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void baixar("pdf", false)}>
            <FileText />
            PDF
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {centros ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-gray-500">Consolidado e todas as unidades</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => void baixar("xlsx", true)}>
                <FileSpreadsheet />
                Excel, uma aba por visão
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void baixar("pdf", true)}>
                <FileText />
                PDF
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
