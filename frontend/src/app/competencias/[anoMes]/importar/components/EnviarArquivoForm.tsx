"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  importacoesService,
  type ErroImportacao,
  type Importacao,
  type TipoImportacao,
} from "../services/importacoesService";

/**
 * Os tipos de arquivo do fechamento. Só o balancete tem processamento por
 * enquanto; os demais aparecem desabilitados para o usuário saber que virão.
 */
const TIPOS: Array<{ valor: string; rotulo: string; disponivel: boolean }> = [
  { valor: "BALANCETE", rotulo: "Balancete (TOTVS RM)", disponivel: true },
  { valor: "DRE_COMERCIAL", rotulo: "DRE do Comercial", disponivel: false },
  { valor: "PRODUCAO_METALURGIA", rotulo: "Produção da metalurgia", disponivel: false },
];

type EnviarArquivoFormProps = {
  anoMes: string;
  onEnviado: (importacao: Importacao) => void;
};

function erroDe(error: unknown): ErroImportacao & { status?: number } {
  const resposta = (error as { response?: { status?: number; data?: ErroImportacao } })
    .response;
  return { status: resposta?.status, ...resposta?.data };
}

export function EnviarArquivoForm({ anoMes, onEnviado }: EnviarArquivoFormProps) {
  const [tipo, setTipo] = useState<TipoImportacao>("BALANCETE");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [envio, setEnvio] = useState(0);
  const campoArquivo = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const enviar = useMutation({
    mutationFn: (forcar: boolean) => {
      setEnvio(0);
      return importacoesService.enviar(anoMes, tipo, arquivo!, forcar, setEnvio);
    },
    onSuccess: (importacao) => {
      toast.success(`${importacao.nomeArquivo} recebido. Processando…`);
      setArquivo(null);
      if (campoArquivo.current) campoArquivo.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["importacoes", anoMes] });
      queryClient.invalidateQueries({ queryKey: ["competencias"] });
      onEnviado(importacao);
    },
  });

  const erro = enviar.error ? erroDe(enviar.error) : null;
  const arquivoRepetido = erro?.codigo === "ARQUIVO_JA_IMPORTADO";

  return (
    <div className="border border-gray-200 bg-white rounded-sm p-6">
      <h2 className="text-xl font-bold tracking-tight text-gray-900">
        Enviar arquivo
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Envie a planilha com a aba <strong>Balancete (Lista)</strong>, ou uma
        pasta de trabalho só com ela. O sistema lê as colunas do mês desta
        competência e confere a soma com o Total Geral do arquivo. Reimportar
        substitui o lote anterior por inteiro.
      </p>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="importacao-tipo" className="text-sm font-medium text-gray-900">
            Tipo de arquivo
          </Label>
          <Select
            value={tipo}
            onValueChange={(v) => {
              if (v) setTipo(v as TipoImportacao);
            }}
          >
            <SelectTrigger id="importacao-tipo" className="w-64 rounded-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.valor} value={t.valor} disabled={!t.disponivel}>
                  {t.rotulo}
                  {t.disponivel ? null : (
                    <span className="ml-1 text-xs text-gray-400">(em breve)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="importacao-arquivo" className="text-sm font-medium text-gray-900">
            Planilha (.xlsx)
          </Label>
          <Input
            id="importacao-arquivo"
            ref={campoArquivo}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="rounded-sm border-gray-300 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
            onChange={(e) => {
              setArquivo(e.target.files?.[0] ?? null);
              enviar.reset();
            }}
          />
        </div>

        <Button
          type="button"
          onClick={() => enviar.mutate(false)}
          disabled={!arquivo || enviar.isPending}
          className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
        >
          <Upload className="size-4" />
          {enviar.isPending ? `Enviando… ${envio}%` : "Importar"}
        </Button>
      </div>

      {arquivoRepetido ? (
        <div className="mt-4 rounded-sm border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-800" />
            <p className="text-sm text-yellow-800">{erro?.error}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => enviar.mutate(true)}
              className="rounded-sm border border-black text-black hover:bg-gray-100"
            >
              Importar mesmo assim
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => enviar.reset()}
              className="rounded-sm text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : erro ? (
        <div className="mt-4 flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-4">
          <AlertCircle className="size-4 shrink-0 text-red-700" />
          <p className="text-sm text-red-700">
            {erro.error ??
              (erro.status === 413
                ? "Arquivo grande demais para o envio."
                : "Não foi possível enviar o arquivo.")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
