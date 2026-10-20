"use client";

import { useState } from "react";
import { Bold, CaseSensitive, Italic, Palette, Underline } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { botaoPrimario, OpcaoEmLinha } from "@/app/cenarios/components/CenarioDialog";

import type { EstiloDoSumario, LinhaDoSumario, ListarDoSumario, TelaDoSumario } from "../services/relatoriosExecutivosService";
import { COR_PADRAO, CORES_DA_FONTE, familiaDa, FONTES, ITEM_DA_BARRA, MenuDaBarra, semFoco, TAMANHOS, type ChaveDaFonte } from "./TextoRico";

export type OpcoesDoSumario = { listar: ListarDoSumario; telas: string[]; linha?: LinhaDoSumario };
type Nivel = "telas" | "slides";
type Sumario = OpcoesDoSumario & { estilos?: { telas?: EstiloDoSumario; slides?: EstiloDoSumario } };

/** A formatação de início de cada nível (20/10/2026): as telas em negrito, com 16 px; os slides com 14 px, em cinza. */
const DE_INICIO: Record<Nivel, { negrito: boolean; tamanho: number; classe: string }> = {
  telas: { negrito: true, tamanho: 16, classe: "text-gray-900" },
  slides: { negrito: false, tamanho: 14, classe: "text-gray-700" },
};

/** O sublinhado entre o nome e o número (20/10/2026): pontos (o de início), traços, linha ou nenhum. */
const LINHAS: Array<{ chave: LinhaDoSumario; rotulo: string; classe: string }> = [
  { chave: "PONTOS", rotulo: "Pontos", classe: "border-b border-dotted" },
  { chave: "TRACOS", rotulo: "Traços", classe: "border-b border-dashed" },
  { chave: "LINHA", rotulo: "Linha", classe: "border-b border-solid" },
  { chave: "NENHUM", rotulo: "Nenhum", classe: "" },
];

/** O estilo de um nível: o de início, com o que o usuário escolheu por cima. */
function doNivel(b: Sumario, n: Nivel) {
  const e = { negrito: DE_INICIO[n].negrito, tamanho: DE_INICIO[n].tamanho, ...b.estilos?.[n] };
  return {
    estilo: e,
    classe: e.cor ? "" : DE_INICIO[n].classe,
    css: { fontWeight: e.negrito ? 700 : 400, fontStyle: e.italico ? "italic" : undefined, fontSize: e.tamanho, color: e.cor, fontFamily: familiaDa(e.fonte) } as React.CSSProperties,
  };
}

/**
 * O Sumário (20/10/2026): as telas marcadas, na ordem do relatório, com o número do primeiro slide de cada uma e, em
 * Telas e Slides, os slides delas. Os números são a contagem dos slides a partir da Introdução (a Capa e o Encerramento não contam), a
 * mesma do contador do topo dos slides; a tela marcada sem slides não aparece. Cada nível tem a sua formatação (na barra
 * do bloco), e o sublinhado entre o nome e o número é o escolhido no Configurar Sumário, na cor do texto.
 */
export function ListaDoSumario({ b, sumario, editavel }: { b: Sumario; sumario: TelaDoSumario[]; editavel: boolean }) {
  const telas = sumario.filter((t) => b.telas.includes(t.chave) && t.slides.length);
  if (!telas.length) {
    return editavel ? (
      <div className="flex h-full items-center justify-center rounded-sm border border-dashed border-gray-300 p-3 text-center text-xs text-gray-500">
        Nenhuma tela marcada tem slides: marque as telas no Configurar Sumário (o botão de engrenagem do bloco).
      </div>
    ) : null;
  }
  const sublinhado = LINHAS.find((l) => l.chave === (b.linha ?? "PONTOS"))!.classe;
  const linha = (rotulo: string, numero: number, n: Nivel) => {
    const { estilo, classe, css } = doNivel(b, n);
    const texto = estilo.sublinhado ? "underline" : undefined;
    return (
      <div className={`flex items-baseline gap-2 ${classe} ${n === "slides" ? "pl-5" : ""}`} style={css}>
        <span className="min-w-0 truncate" style={{ textDecoration: texto }}>
          {rotulo}
        </span>
        <span aria-hidden className={`min-w-4 flex-1 border-current opacity-40 ${sublinhado}`} />
        <span className="shrink-0" style={{ textDecoration: texto }}>
          {numero}
        </span>
      </div>
    );
  };
  return (
    <nav aria-label="Sumário" className={`h-full overflow-hidden ${editavel ? "rounded-sm border border-dashed border-transparent hover:border-gray-300" : ""}`}>
      <ol className="space-y-2">
        {telas.map((t) => (
          <li key={t.chave} className="space-y-1">
            {linha(t.titulo, t.slides[0].numero, "telas")}
            {b.listar === "TELAS_E_SLIDES" ? (
              <ol className="space-y-0.5">
                {t.slides.map((s) => (
                  <li key={`${s.numero}`}>{linha(s.nome, s.numero, "slides")}</li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * A formatação do Sumário na barra do bloco (20/10/2026): a do texto das anotações (negrito, itálico, sublinhado, o tamanho,
 * a cor e a fonte; sem os marcadores), por nível — as telas ou os slides (em Telas e Slides, o botão escolhe qual) —, já
 * que a lista se monta sozinha e não se seleciona.
 */
export function BarraDoSumario({ b, botao, onMudar }: { b: Sumario; botao: string; onMudar: (m: Pick<Sumario, "estilos">) => void }) {
  const [escolhido, setEscolhido] = useState<Nivel>("telas");
  const [aberta, setAberta] = useState<"tamanho" | "cor" | "fonte" | null>(null);
  const n: Nivel = b.listar === "TELAS" ? "telas" : escolhido;
  const { estilo } = doNivel(b, n);
  const mudar = (m: EstiloDoSumario) => {
    setAberta(null);
    onMudar({ estilos: { ...b.estilos, [n]: { ...b.estilos?.[n], ...m } } });
  };
  const alternar = (m: NonNullable<typeof aberta>) => () => setAberta((a) => (a === m ? null : m));
  const ligado = (v?: boolean) => (v ? "bg-gray-200 text-gray-900" : "");
  const nivel = (x: Nivel, rotulo: string) => (
    <button type="button" onMouseDown={semFoco} onClick={() => setEscolhido(x)} aria-pressed={n === x} className={`px-1.5 py-0.5 ${n === x ? "bg-black font-semibold text-white" : "text-gray-600 hover:bg-gray-100"}`}>
      {rotulo}
    </button>
  );
  return (
    <>
      {b.listar === "TELAS_E_SLIDES" ? (
        <span role="group" aria-label="Formatar" title="O nível que a formatação muda" className="flex overflow-hidden rounded-sm border border-gray-200 text-[11px]">
          {nivel("telas", "Telas")}
          {nivel("slides", "Slides")}
        </span>
      ) : null}
      <button type="button" className={`${botao} ${ligado(estilo.negrito)}`} onMouseDown={semFoco} onClick={() => mudar({ negrito: !estilo.negrito })} title="Negrito" aria-label="Negrito" aria-pressed={!!estilo.negrito}>
        <Bold className="size-4" />
      </button>
      <button type="button" className={`${botao} ${ligado(estilo.italico)}`} onMouseDown={semFoco} onClick={() => mudar({ italico: !estilo.italico })} title="Itálico" aria-label="Itálico" aria-pressed={!!estilo.italico}>
        <Italic className="size-4" />
      </button>
      <button type="button" className={`${botao} ${ligado(estilo.sublinhado)}`} onMouseDown={semFoco} onClick={() => mudar({ sublinhado: !estilo.sublinhado })} title="Sublinhado" aria-label="Sublinhado" aria-pressed={!!estilo.sublinhado}>
        <Underline className="size-4" />
      </button>
      <MenuDaBarra botao={`${botao} min-w-9 text-xs font-semibold`} titulo="Tamanho da fonte" gatilho={estilo.tamanho} aberto={aberta === "tamanho"} onAlternar={alternar("tamanho")} largura="w-20">
        {TAMANHOS.map((t) => (
          <button key={t} type="button" className={`${ITEM_DA_BARRA} justify-center ${t === estilo.tamanho ? "font-bold text-gray-900" : ""}`} onMouseDown={semFoco} onClick={() => mudar({ tamanho: t })}>
            {t === DE_INICIO[n].tamanho ? `${t}*` : t}
          </button>
        ))}
        <span className="border-t border-gray-100 px-1 pt-1 text-center text-[10px] text-gray-500">* padrão</span>
      </MenuDaBarra>
      <MenuDaBarra botao={botao} titulo="Cor da fonte" gatilho={<Palette className="size-4" />} aberto={aberta === "cor"} onAlternar={alternar("cor")}>
        {CORES_DA_FONTE.map((c) => (
          <button key={c.cor} type="button" className={ITEM_DA_BARRA} onMouseDown={semFoco} onClick={() => mudar({ cor: c.cor === COR_PADRAO ? undefined : c.cor })}>
            <span className="size-3.5 shrink-0 rounded-[2px] border border-gray-300" style={{ background: c.cor === COR_PADRAO ? "linear-gradient(135deg, #111827 50%, #ffffff 50%)" : c.cor }} />
            {c.nome}
          </button>
        ))}
      </MenuDaBarra>
      <MenuDaBarra botao={botao} titulo="Fonte" gatilho={<CaseSensitive className="size-4" />} aberto={aberta === "fonte"} onAlternar={alternar("fonte")} largura="w-36">
        <button type="button" className={`${ITEM_DA_BARRA} ${estilo.fonte ? "" : "font-bold text-gray-900"}`} onMouseDown={semFoco} onClick={() => mudar({ fonte: undefined })}>
          Padrão
        </button>
        {FONTES.map((x) => (
          <button
            key={x.chave}
            type="button"
            className={`${ITEM_DA_BARRA} text-sm ${estilo.fonte === x.chave ? "font-bold text-gray-900" : ""}`}
            style={{ fontFamily: x.familia }}
            onMouseDown={semFoco}
            onClick={() => mudar({ fonte: x.chave as ChaveDaFonte })}
          >
            {x.nome}
          </button>
        ))}
      </MenuDaBarra>
    </>
  );
}

/**
 * O modal do Sumário (20/10/2026): listar só as telas ou as telas e os slides, o sublinhado entre o nome e o número e as
 * telas que entram (da Introdução em diante; de início, todas).
 */
export function ConfigurarSumarioDialog({
  titulo,
  inicial,
  sumario,
  onAplicar,
  onFechar,
}: {
  titulo: string;
  inicial?: OpcoesDoSumario;
  sumario: TelaDoSumario[];
  onAplicar: (o: OpcoesDoSumario) => void;
  onFechar: () => void;
}) {
  const [listar, setListar] = useState<ListarDoSumario>(inicial?.listar ?? "TELAS");
  const [linha, setLinha] = useState<LinhaDoSumario>(inicial?.linha ?? "PONTOS");
  const [telas, setTelas] = useState<Set<string>>(() => new Set(inicial?.telas ?? sumario.map((t) => t.chave)));
  const alternar = (c: string) =>
    setTelas((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  return (
    <Dialog open onOpenChange={(a) => (!a ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="rounded-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>A lista das telas do relatório, com o número do slide de cada uma (a contagem começa na Introdução; a Capa e o Encerramento não contam).</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm leading-none font-medium">Listar</legend>
          <OpcaoEmLinha nome="listar-sumario" marcada={listar === "TELAS"} onMarcar={() => setListar("TELAS")} rotulo="Telas" detalhe="Cada tela, com o número do primeiro slide dela." />
          <OpcaoEmLinha nome="listar-sumario" marcada={listar === "TELAS_E_SLIDES"} onMarcar={() => setListar("TELAS_E_SLIDES")} rotulo="Telas e Slides" detalhe="Cada tela e, abaixo dela, os slides, com os números." />
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm leading-none font-medium">Sublinhado</legend>
          <p className="mb-2 text-xs text-gray-500">A linha entre o nome e o número.</p>
          <div className="grid grid-cols-2 gap-2">
            {LINHAS.map((l) => (
              <label key={l.chave} className={`flex cursor-pointer items-center gap-2 rounded-sm border px-2.5 py-2 text-sm ${linha === l.chave ? "border-gray-900" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" name="linha-sumario" className="accent-black" checked={linha === l.chave} onChange={() => setLinha(l.chave)} />
                <span className="shrink-0">{l.rotulo}</span>
                <span aria-hidden className={`min-w-3 flex-1 self-end border-gray-400 ${l.classe} mb-1.5`} />
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-sm leading-none font-medium">Telas</legend>
          {sumario.map((t) => (
            <label key={t.chave} className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-gray-50">
              <input type="checkbox" className="size-4 accent-black" checked={telas.has(t.chave)} onChange={() => alternar(t.chave)} />
              <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
              <span className="shrink-0 text-xs text-gray-500">{t.slides.length ? `slide ${t.slides[0].numero}` : "sem slides"}</span>
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={!telas.size} onClick={() => onAplicar({ listar, linha, telas: sumario.map((t) => t.chave).filter((c) => telas.has(c)) })}>
            {inicial ? "Aplicar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
