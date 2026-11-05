"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { realizadoObraService, ROTULO_DA_VENDA, rotuloDaVersao, type OpcaoDeVenda } from "../services/realizadoObraService";

export const AVISO = "rounded-sm border border-l-4 border-gray-200 border-l-red-600 bg-white px-4 py-3 text-sm text-gray-700";
/** Os estados das telas (sem a venda, sem os valores), na caixa cinza das demais telas. */
export const MENSAGEM = "rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600";
export const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
export const Erro = ({ children }: { children: ReactNode }) => (
  <div className="rounded-sm border border-red-200 bg-red-50 p-4">
    <p className="text-sm text-red-700">{children}</p>
  </div>
);

/** Acima disso, a lista mostra só as primeiras; a pesquisa acha as demais. */
const MAXIMO_NA_LISTA = 200;
/** Sem acentos e sem caixa, para a pesquisa achar "pavilhao" em "PAVILHÃO". */
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chaveDa = (o: { obraId: string; versao: number | null }) => `${o.obraId}:${o.versao ?? ""}`;
/** O código e a versão vendida ("G887305 · VER00"); sem o vendido, só o código. */
const rotuloDa = (o: OpcaoDeVenda) => (o.versao === null ? o.codigo : `${o.codigo} · ${rotuloDaVersao(o.versao)}`);
const detalheDa = (o: OpcaoDeVenda) =>
  [o.tipoVenda ? ROTULO_DA_VENDA[o.tipoVenda] : "Sem o Tipo de Venda", o.generica ? "Obra Genérica" : null, o.comRealizado ? "Com Realizado" : "Sem Realizado", o.versao === null ? "Sem Vendido" : null]
    .filter(Boolean)
    .join(" · ");

/**
 * A lista Venda dos Resultados do Realizado por Obra (03/11/2026, pedido do Adão; antes, a tela
 * Configurações): o rótulo e um botão com a venda escolhida, que abre a lista com a pesquisa. Cada opção é uma venda numa
 * versão vendida (a venda só com o realizado, sem a versão), com o código sem a numeração das obras. A escolha é de cada
 * usuário e fica gravada.
 */
export function SeletorVenda() {
  const queryClient = useQueryClient();
  const consulta = useQuery({ queryKey: ["realizado-obra", "vendas"], queryFn: realizadoObraService.vendas });
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const escolher = useMutation({
    mutationFn: (o: OpcaoDeVenda) => realizadoObraService.escolher(o.obraId, o.versao ?? 0),
    // A lista e os Resultados passam a mostrar a venda escolhida.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["realizado-obra"] }),
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível escolher a venda.")),
  });
  const dados = consulta.data;
  const vendas = useMemo(() => dados?.vendas ?? [], [dados]);
  const escolhida = dados?.escolhida ? chaveDa(dados.escolhida) : null;
  const atual = vendas.find((o) => chaveDa(o) === escolhida) ?? null;
  const achadas = useMemo(() => {
    const termos = normal(busca).split(/\s+/).filter(Boolean);
    return termos.length ? vendas.filter((o) => termos.every((t) => normal(`${rotuloDa(o)} ${o.nome} ${detalheDa(o)}`).includes(t))) : vendas;
  }, [vendas, busca]);
  const escolha = (o: OpcaoDeVenda) => {
    setAberto(false);
    if (chaveDa(o) !== escolhida) escolher.mutate(o);
  };
  const dica = atual ? `${rotuloDa(atual)} — ${atual.nome}` : "Escolha a venda";
  // Ao abrir, a lista rola até a escolhida (só quando ela aparece, não a cada letra digitada).
  const rolarAte = useCallback((li: HTMLLIElement | null) => li?.scrollIntoView({ block: "nearest" }), []);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium whitespace-nowrap text-gray-600">Venda</span>
      <Popover.Root
        open={aberto}
        onOpenChange={(sim) => {
          setAberto(sim);
          if (sim) setBusca("");
        }}
      >
        <Popover.Trigger
          disabled={!dados || escolher.isPending}
          title={consulta.isError ? mensagemDeErro(consulta.error, "Erro ao carregar as vendas.") : dica}
          aria-label={`Venda: ${dica}`}
          className="flex h-8 w-72 items-center justify-between gap-1.5 rounded-sm border border-input bg-white py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          <span className="min-w-0 truncate">
            {escolher.isPending ? (
              "Escolhendo…"
            ) : atual ? (
              <>
                <span className="font-medium">{rotuloDa(atual)}</span> {atual.nome}
              </>
            ) : (
              <span className="text-muted-foreground">{consulta.isPending ? "Carregando…" : consulta.isError ? "Erro ao carregar" : "Escolha a venda"}</span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={4} align="end" className="z-50">
            <Popover.Popup className="w-[28rem] max-w-[calc(100vw-2rem)] rounded-sm border border-gray-200 bg-white p-1.5 text-gray-900 shadow-lg outline-none">
              <div className="relative px-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && achadas.length) escolha(achadas[0]);
                  }}
                  placeholder="Pesquisar código, nome ou versão"
                  aria-label="Pesquisar a venda"
                  className="h-8 w-full rounded-sm border border-gray-300 pr-2 pl-7 text-sm outline-none focus:border-gray-500"
                />
              </div>
              <ul className="mt-1.5 max-h-80 overflow-y-auto rounded-sm border border-gray-200 py-1 text-sm">
                {achadas.slice(0, MAXIMO_NA_LISTA).map((o) => {
                  const marcada = chaveDa(o) === escolhida;
                  return (
                    <li key={chaveDa(o)} ref={marcada ? rolarAte : undefined}>
                      <button type="button" onClick={() => escolha(o)} className={`flex w-full items-start gap-2 px-2 py-1.5 text-left hover:bg-gray-100 ${marcada ? "bg-gray-50" : ""}`}>
                        <Check className={`mt-0.5 size-3.5 shrink-0 ${marcada ? "text-gray-900" : "invisible"}`} />
                        <span className="min-w-0">
                          <span className="block truncate">
                            <span className="font-medium">{rotuloDa(o)}</span> {o.nome}
                          </span>
                          <span className="block text-xs text-gray-500">{detalheDa(o)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {achadas.length > MAXIMO_NA_LISTA ? (
                  <li className="px-2 py-1 text-xs text-gray-500">
                    Mostrando {MAXIMO_NA_LISTA} de {achadas.length.toLocaleString("pt-BR")}; pesquise para achar as demais.
                  </li>
                ) : null}
                {achadas.length === 0 ? <li className="px-2 py-1 text-xs text-gray-500">Nada encontrado.</li> : null}
              </ul>
              {dados?.indisponivel ? (
                <p className="px-1 pt-1.5 text-xs text-red-700">Sem o vendido: {dados.indisponivel}</p>
              ) : dados?.fonte ? (
                <p className="px-1 pt-1.5 text-xs text-gray-500">
                  O vendido vem da aba DRE do CONTROLE DAS VENDAS importada em {dados.fonte.competencia} ({dados.fonte.arquivo}).
                </p>
              ) : null}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
