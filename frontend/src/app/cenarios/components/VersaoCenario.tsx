"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyPlus, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, rotuloVersao, type Cenario } from "../services/cenariosService";
import { botaoPrimario, Erro } from "./CenarioDialog";

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * O versionamento do cenário (13/10/2026), na linha do título da tela Resultados: Salvar Versão congela o cenário (como
 * o fechamento de uma competência: a DRE, os indicadores manuais e a referência não se editam mais) e Criar Revisão
 * copia a versão salva numa versão nova (VER01, VER02…), aberta para edição — um cenário novo, na lista. A marcação
 * não passa para a revisão: remarca-se à mão.
 */
export function BotoesDeVersao({ cenario }: { cenario: Cenario }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogo, setDialogo] = useState<"salvar" | "revisao" | null>(null);
  const lista = useQuery({ queryKey: ["cenarios"], queryFn: () => cenariosService.listar() });
  const familia = cenario.familiaId ?? cenario.id;
  const proxima = Math.max(cenario.versao, ...(lista.data ?? []).filter((c) => (c.familiaId ?? c.id) === familia).map((c) => c.versao)) + 1;
  const versao = rotuloVersao(cenario.versao);
  const salvar = useMutation({
    mutationFn: () => cenariosService.salvarVersao(cenario.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      toast.success(`${versao} de ${cenario.nome} salva.`);
      setDialogo(null);
    },
  });
  const revisar = useMutation({
    mutationFn: () => cenariosService.criarRevisao(cenario.id),
    onSuccess: (nova) => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      toast.success(`${rotuloVersao(nova.versao)} de ${nova.nome} criada, aberta para edição.`);
      setDialogo(null);
      router.push(`/cenarios/sinteticos/${nova.id}/resultados`);
    },
  });
  const salva = !!cenario.versaoSalvaEm;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span title={salva ? `${versao} salva em ${dataHora(cenario.versaoSalvaEm!)}${cenario.versaoSalvaPor ? ` por ${cenario.versaoSalvaPor}` : ""}` : undefined}>
        <Button type="button" className={botaoPrimario} disabled={salva} onClick={() => setDialogo("salvar")}>
          <Save className="size-4" />
          Salvar Versão
        </Button>
      </span>
      <span title={salva ? undefined : `Salve a ${versao} antes de criar uma revisão`}>
        <Button type="button" className={botaoPrimario} disabled={!salva} onClick={() => setDialogo("revisao")}>
          <CopyPlus className="size-4" />
          Criar Revisão
        </Button>
      </span>

      {dialogo ? (
        <Dialog open onOpenChange={(o) => (!o ? setDialogo(null) : undefined)}>
          <DialogContent className="rounded-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{dialogo === "salvar" ? "Salvar Versão" : "Criar Revisão"}</DialogTitle>
              <DialogDescription render={<div />}>
                <ul className="list-disc space-y-1.5 pl-5">
                  {dialogo === "salvar" ? (
                    <>
                      <li>
                        A {versao} de {cenario.nome} fica salva, como uma competência fechada: a DRE, os Indicadores Manuais e a referência não se
                        editam mais.
                      </li>
                      <li>O nome, a descrição, o comparativo e as justificativas continuam editáveis.</li>
                      <li>Para mudar os valores, crie uma revisão: uma cópia ({rotuloVersao(proxima)}) aberta para edição.</li>
                    </>
                  ) : (
                    <>
                      <li>
                        Cria a {rotuloVersao(proxima)} de {cenario.nome}: uma cópia da {versao} (a DRE, os indicadores, o comparativo e as justificativas),
                        aberta para edição.
                      </li>
                      <li>A revisão é um cenário novo, na lista de Cenários Sintéticos; a {versao} continua salva.</li>
                      {cenario.marcacao ? <li>A marcação fica na {versao}: para passá-la à revisão, remarque em Configurações / Cenário.</li> : null}
                    </>
                  )}
                </ul>
              </DialogDescription>
            </DialogHeader>
            <Erro
              erro={
                dialogo === "salvar"
                  ? salvar.isError
                    ? mensagemDeErro(salvar.error, "Não foi possível salvar a versão.")
                    : null
                  : revisar.isError
                    ? mensagemDeErro(revisar.error, "Não foi possível criar a revisão.")
                    : null
              }
            />
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => setDialogo(null)}>
                Cancelar
              </Button>
              {dialogo === "salvar" ? (
                <Button type="button" className={botaoPrimario} disabled={salvar.isPending} onClick={() => salvar.mutate()}>
                  {salvar.isPending ? "Salvando…" : `Salvar ${versao}`}
                </Button>
              ) : (
                <Button type="button" className={botaoPrimario} disabled={revisar.isPending} onClick={() => revisar.mutate()}>
                  {revisar.isPending ? "Criando…" : `Criar ${rotuloVersao(proxima)}`}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
