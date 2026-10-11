"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { CampoArquivo } from "@/components/shared/CampoArquivo";
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

const LISTAS = "SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO)";

/**
 * Os tipos de arquivo do fechamento, com a aba que o sistema procura. Os que
 * ainda não têm processamento aparecem desabilitados, para o usuário saber que
 * virão.
 */
export const TIPOS: Array<{ valor: string; rotulo: string; disponivel: boolean; origem?: string }> = [
  { valor: "BALANCETE", rotulo: "Balancete (TOTVS RM)", disponivel: true, origem: "aba Balancete (Lista) do SIG BPM 2026 - LISTAS REALIZADO (RESULTADOS). O sistema lê as colunas do mês e confere a soma com o Total Geral do arquivo" },
  { valor: "PROJETO", rotulo: "Projetos liberados", disponivel: true, origem: `aba Projetos (Resumo) do ${LISTAS}: por obra e linha` },
  { valor: "PRODUCAO", rotulo: "Produção (m³)", disponivel: true, origem: `aba Produção (Resumo) do ${LISTAS}: por obra, linha e peça de estaca` },
  { valor: "PRODUCAO_PISTA", rotulo: "Produção (pistas)", disponivel: true, origem: `aba Produção (Lista pst) do ${LISTAS}` },
  { valor: "PRODUCAO_ARMADURA", rotulo: "Produção de armadura", disponivel: true, origem: `aba Produção (Armaduras) do ${LISTAS}: unidade, linha e o peso do mês` },
  { valor: "PRODUCAO_METALURGIA", rotulo: "Produção da metalurgia", disponivel: true, origem: `aba Produção (Metalúrgica) do ${LISTAS}: finalidade, linha e o peso do mês` },
  { valor: "EXPEDICAO", rotulo: "Expedição", disponivel: true, origem: `aba Expedição (Resumo) do ${LISTAS}: por obra, linha e peça de estaca` },
  { valor: "MONTAGEM", rotulo: "Montagem", disponivel: true, origem: `aba Montagem (Resumo) do ${LISTAS}: por obra e linha` },
  { valor: "ACOMPANHAMENTO", rotulo: "Acompanhamento de obra", disponivel: true, origem: `aba Acompanhamentos do ${LISTAS}` },
  { valor: "MEDICAO", rotulo: "Medições", disponivel: true, origem: `aba Medições do ${LISTAS}` },
  { valor: "DEVOLUCAO", rotulo: "Devoluções", disponivel: true, origem: `aba Devoluções (Resumo) do ${LISTAS}: por obra, linha e movimento` },
  { valor: "SAIDA", rotulo: "Saídas", disponivel: true, origem: `aba Saídas (Resumo) do ${LISTAS}: por obra, linha e movimento` },
  { valor: "INDICADORES_ADMIN", rotulo: "Indicadores do Administrativo", disponivel: true, origem: `aba Indicadores (Admin.) do ${LISTAS}: quadro de lotação, fluxo de caixa, inadimplência, turnover, vagas e acidentes, na coluna do mês. Vão para a tela Indicadores; não entram na apuração` },
  { valor: "INDICADORES_COMERCIAL", rotulo: "Indicadores do Comercial", disponivel: true, origem: "aba Indicadores (Comercial) do CONTROLE DAS VENDAS - COMERCIAL: vendas, receita líquida vendida, margem de contribuição, demanda e mix ampliado, na coluna do mês. Vão para a tela Indicadores; não entram na apuração" },
  // As Metas do Orçamento saíram da importação do mês (11/10/2026): ficam nos cenários (Cenários Sintéticos).
  { valor: "ESTOQUE_INICIAL", rotulo: "Saldo inicial do estoque", disponivel: true, origem: `aba Estoque (2025) do ${LISTAS}. Importe no primeiro mês da ferramenta (01/2026): a apuração do estoque dele parte deste saldo` },
  { valor: "DRE_COMERCIAL", rotulo: "DRE do Comercial", disponivel: true, origem: "aba DRE do CONTROLE DAS VENDAS - COMERCIAL. Os preços valem para todas as competências; um preço alterado substitui o anterior, que fica no histórico" },
];

type EnviarArquivoFormProps = {
  anoMes: string;
  /** Competência fechada: só o balancete, para comparar (Passo 24). */
  somenteBalancete?: boolean;
  /** O tipo já escolhido (ao reimportar a partir de uma linha da tela). */
  tipoInicial?: string;
  onEnviado: (importacao: Importacao) => void;
};

function erroDe(error: unknown): ErroImportacao & { status?: number } {
  const resposta = (error as { response?: { status?: number; data?: ErroImportacao } })
    .response;
  return { status: resposta?.status, ...resposta?.data };
}

/** O formulário de envio, dentro do diálogo "Importar arquivo" (E3 do levantamento de layout). */
export function EnviarArquivoForm({ anoMes, somenteBalancete, tipoInicial, onEnviado }: EnviarArquivoFormProps) {
  // Recorte por setor (Passo 22): o Alimentador só importa as listas dos seus setores.
  const { user } = useAuth();
  const tipos = TIPOS.filter((t) => (!somenteBalancete || t.valor === "BALANCETE") && (!user?.acesso.recorteSetor || user.acesso.setores.includes(t.valor)));
  const [tipo, setTipo] = useState<TipoImportacao>(((tipoInicial && tipos.some((t) => t.valor === tipoInicial) ? tipoInicial : tipos[0]?.valor) ?? "BALANCETE") as TipoImportacao);
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
    <div>
      <p className="text-sm text-gray-600">
        Envie a planilha com a {TIPOS.find((t) => t.valor === tipo)?.origem}, ou uma
        pasta de trabalho só com essa aba. Só os registros do mês desta
        competência são gravados. Reimportar substitui o lote anterior do mesmo
        tipo por inteiro.
      </p>

      <div className="mt-4 flex flex-col gap-4">
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
            <SelectTrigger id="importacao-tipo" className="w-72 rounded-sm">
              {/* O nome do tipo, não o código (BALANCETE). */}
              <SelectValue>{(v: string | null) => TIPOS.find((t) => t.valor === v)?.rotulo ?? ""}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tipos.map((t) => (
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

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="importacao-arquivo" className="text-sm font-medium text-gray-900">
            Planilha (.xlsx)
          </Label>
          <CampoArquivo
            id="importacao-arquivo"
            ref={campoArquivo}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            arquivo={arquivo}
            onEscolher={(f) => {
              setArquivo(f);
              enviar.reset();
            }}
          />
        </div>

        <Button
          type="button"
          onClick={() => enviar.mutate(false)}
          disabled={!arquivo || enviar.isPending}
          className="self-end bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
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
