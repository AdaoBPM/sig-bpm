"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Upload } from "lucide-react";

import { CampoArquivo } from "@/components/shared/CampoArquivo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, type Cenario, type ResumoImportacao } from "../services/cenariosService";
import { botaoPrimario, Erro } from "./CenarioDialog";

/** O que o resultado da importação mostra: as abas lidas e o que ficou de fora. */
function Resumo({ r }: { r: ResumoImportacao }) {
  return (
    <div className="space-y-2 rounded-sm border border-l-4 border-gray-200 border-l-green-600 bg-white px-4 py-3 text-sm text-gray-700">
      <p className="flex items-center gap-2 font-bold text-gray-900">
        <CheckCircle2 className="size-4 text-green-700" />
        Importado: exercício {r.ano}.
      </p>
      {r.visoes.length ? (
        <ul className="list-disc space-y-0.5 pl-5">
          {r.visoes.map((v) => (
            <li key={v.visao}>
              {v.nome} (aba {v.aba}): {v.linhas} linhas da DRE, {v.meses} meses.
              {v.semPar.length ? <span className="text-yellow-800"> Sem par na Estrutura da DRE: {v.semPar.join("; ")}.</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhuma aba da DRE no arquivo: a DRE do cenário ficou como estava.</p>
      )}
      {r.visoes.length && r.faltam.length ? <p className="text-yellow-800">Sem aba no arquivo (ficaram como estavam): {r.faltam.join(", ")}.</p> : null}
      {r.metas ? (
        <p>
          Metas (aba {r.metas.aba}): {r.metas.indicadores} indicadores.
          {r.metas.ignorados.length ? <span className="text-yellow-800"> Fora do cadastro dos indicadores (ignorados): {r.metas.ignorados.join("; ")}.</span> : null}
        </p>
      ) : (
        <p>Sem a aba das metas: as metas do cenário ficaram como estavam.</p>
      )}
      {r.ignoradas.length ? <p className="text-gray-500">Abas com o nome de uma unidade que não são uma DRE (ignoradas): {r.ignoradas.join(", ")}.</p> : null}
    </div>
  );
}

/**
 * Importar um arquivo: num cenário novo (com o nome e a descrição) ou num cenário que já existe. As abas da DRE
 * (Consolidado, Matriz, Filial, Serviços, Desp.+Extra, RN) substituem as mesmas visões do cenário; a aba das metas
 * (Metas ou Metas (Orçamento)) substitui as metas, inclusive os lançamentos manuais digitados.
 */
export function ImportarCenarioDialog({ cenario, onFechar }: { cenario: Cenario | null; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [envio, setEnvio] = useState(0);
  const importar = useMutation({
    mutationFn: () => cenariosService.importar(arquivo!, cenario ? { cenarioId: cenario.id } : { nome: nome.trim(), descricao: descricao.trim() || null }, setEnvio),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cenarios"] }),
  });
  const feito = importar.data;

  return (
    <Dialog open onOpenChange={(o) => (!o && !importar.isPending ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{cenario ? `Importar Arquivo no Cenário ${cenario.nome}` : "Importar Cenário"}</DialogTitle>
          <DialogDescription>
            Uma planilha (.xlsx) com as abas da DRE por unidade, como as do ORÇAMENTO BPM 2026 (Consolidado, Matriz, Filial, Serviços, Desp.+Extra e
            Extra RN), e a aba das metas, como a Metas (ou Metas (Orçamento)) do INDICADORES DE RESULTADO. O nome do arquivo não importa; as abas que
            faltarem ficam como estão{cenario ? "" : " (vazias, num cenário novo)"}. O exercício sai dos meses dos rótulos.
            {cenario ? " A aba das metas substitui também os lançamentos manuais digitados." : ""}
          </DialogDescription>
        </DialogHeader>
        {feito ? (
          <Resumo r={feito.resumo} />
        ) : (
          <div className="grid gap-4">
            {cenario ? null : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="importar-nome">Nome do Cenário</Label>
                  <Input id="importar-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className="rounded-sm" placeholder="Ex.: Cenário Adotado (REV02)" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="importar-descricao">Descrição (opcional)</Label>
                  <Input id="importar-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} className="rounded-sm" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="importar-arquivo">Arquivo</Label>
              <CampoArquivo
                id="importar-arquivo"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                arquivo={arquivo}
                disabled={importar.isPending}
                onEscolher={(f) => {
                  setArquivo(f);
                  importar.reset();
                }}
              />
            </div>
            {importar.isPending ? (
              <p className="flex items-center gap-2 text-sm text-gray-700">
                <Loader2 className="size-4 animate-spin" />
                {envio < 100 ? `Enviando o arquivo… ${envio}%` : "Lendo as abas e gravando o cenário…"}
              </p>
            ) : null}
            <Erro erro={importar.isError ? mensagemDeErro(importar.error, "Não foi possível importar o arquivo.") : null} />
          </div>
        )}
        <DialogFooter>
          {feito ? (
            <>
              <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
                Fechar
              </Button>
              <Link href={`/cenarios/sinteticos/${feito.cenario.id}/resultados`} onClick={onFechar} className={`${botaoPrimario} inline-flex h-9 items-center px-4 text-sm`}>
                Abrir o Cenário
              </Link>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar} disabled={importar.isPending}>
                Cancelar
              </Button>
              <Button type="button" className={botaoPrimario} disabled={!arquivo || (!cenario && !nome.trim()) || importar.isPending} onClick={() => importar.mutate()}>
                <Upload className="size-4" />
                Importar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
