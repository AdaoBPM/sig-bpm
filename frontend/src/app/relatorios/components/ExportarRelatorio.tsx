"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

import { mensagemDoErro, nomeDoArquivo } from "../../competencias/[anoMes]/dre/components/ExportarDRE";

type Formato = "xlsx" | "pdf";
/**
 * Uma opção do menu: o rótulo no Excel e no PDF (nulo: só em Excel, 14/10/2026), os parâmetros do pedido e, quando a
 * opção vai a outro endereço (os centros dos cenários), o caminho dela na API.
 */
export type OpcaoExportar = { chave: string; excel: string; pdf: string | null; params: Record<string, string | number>; url?: string };

/**
 * O menu Exportar dos relatórios, como o da DRE (em amarelo-ouro): Excel e
 * PDF, cada um com as opções da tela (a visão atual, todas as unidades, todos
 * os centros).
 */
export function ExportarRelatorio({ caminho, endereco, opcoes, padrao }: { caminho?: string; endereco?: string; opcoes: OpcaoExportar[]; padrao: string }) {
  const [gerando, setGerando] = useState(false);

  async function baixar(formato: Formato, o: OpcaoExportar) {
    setGerando(true);
    try {
      const r = await api.get<Blob>(o.url ?? endereco ?? `/proxy/relatorios/${caminho}/exportar`, { params: { ...o.params, formato }, responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDoArquivo(r.headers["content-disposition"] as string | undefined, `${padrao}.${formato}`);
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
          <Button type="button" className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm" disabled={gerando}>
            <Download className="size-4" />
            {gerando ? "Gerando…" : "Exportar"}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-[25rem]">
        {(["xlsx", "pdf"] as const).filter((f) => f === "xlsx" || opcoes.some((o) => o.pdf)).map((formato, i) => (
          <DropdownMenuGroup key={formato}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              {formato === "xlsx" ? <FileSpreadsheet className="size-3.5" /> : <FileText className="size-3.5" />}
              {formato === "xlsx" ? "Excel" : "PDF"}
            </DropdownMenuLabel>
            {opcoes.filter((o) => formato === "xlsx" || o.pdf).map((o) => (
              <DropdownMenuItem key={o.chave} onClick={() => void baixar(formato, o)} className="pl-6">
                {formato === "xlsx" ? o.excel : o.pdf}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
