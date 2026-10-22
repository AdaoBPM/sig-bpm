"use client";

import { useEffect, useRef, useState } from "react";
import { toCanvas } from "html-to-image";
import { ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { pdfDeImagens, type PaginaDeImagem } from "@/lib/pdfDeImagens";

import { fontesDaPagina, fundoAtras } from "@/app/relatorios/components/CopiarComoImagem";
import type { Cores } from "@/app/relatorios/painel/PainelContent";
import type { TipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";

import { SlideDoRelatorio, type Slide } from "./ApresentacaoDoRelatorio";
import type { DadosDoRelatorio, TelaDoSumario } from "../services/relatoriosExecutivosService";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** O slide está pronto para a imagem: sem tabelas e cards carregando e com as imagens carregadas (até 20 s). */
async function slidePronto(no: HTMLElement) {
  for (let i = 0; i < 100; i++) {
    const carregando = no.querySelector("[data-carregando], .animate-pulse");
    const imagens = [...no.querySelectorAll("img")].every((img) => img.complete);
    if (!carregando && imagens) break;
    await espera(200);
  }
  // Os gráficos e as fontes terminam de se desenhar.
  await espera(600);
}

/** Os bytes do JPEG do slide, na largura de até 2560 px. */
async function jpegDoSlide(no: HTMLElement, fundo: string, fontes: string): Promise<PaginaDeImagem> {
  const pixelRatio = Math.min(2, Math.max(1, 2560 / no.offsetWidth));
  const canvas = await toCanvas(no, {
    pixelRatio,
    backgroundColor: fundo,
    fontEmbedCSS: fontes,
    filter: (n) => !(n instanceof HTMLElement && n.dataset.foraDaImagem !== undefined),
  });
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
  if (!blob) throw new Error("Imagem vazia.");
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), largura: canvas.width, altura: canvas.height };
}

type Escopo = "TUDO" | "GRUPO" | "ABA";

/**
 * O Exportar dos Relatórios Executivos (22/10/2026): os slides em PDF, como na apresentação (um slide por página, na
 * proporção da tela) — toda a apresentação, só o grupo atual (a aba do relatório aberta: Introdução, Administrativo…) ou só
 * a aba atual (a página aberta). Cada slide se desenha fora da tela, no tamanho da tela inteira, e vira uma imagem; os
 * vídeos saem como um quadro com o ícone. Vale o que está na tela, gravado ou não (como o Apresentar).
 */
export function ExportarPdfDoRelatorio({
  relatorioId,
  periodo,
  slides,
  grupo,
  pagina,
  sumario,
  dados,
  cores,
  tipo,
}: {
  relatorioId: string;
  periodo: string;
  slides: Array<Slide & { aba: string }>;
  /** A aba do relatório aberta (o grupo) e o nome dela. */
  grupo: { chave: string; nome: string };
  /** A chave do slide da página aberta (aba|página) e o nome dela. */
  pagina: { chave: string; nome: string };
  sumario: TelaDoSumario[];
  dados: DadosDoRelatorio | undefined;
  cores: Cores;
  tipo: TipoGrafico;
}) {
  // Os slides a exportar e o que vira a imagem agora; null: nada em andamento.
  const [fila, setFila] = useState<{ slides: Slide[]; nome: string } | null>(null);
  const [k, setK] = useState(0);
  const area = useRef<HTMLDivElement>(null);
  const paginas = useRef<PaginaDeImagem[]>([]);
  const doGrupo = slides.filter((s) => s.aba === grupo.chave);
  const daPagina = slides.filter((s) => s.chave === pagina.chave);
  const exportar = (escopo: Escopo) => {
    const lista = escopo === "TUDO" ? slides : escopo === "GRUPO" ? doGrupo : daPagina;
    const nome = escopo === "TUDO" ? "" : escopo === "GRUPO" ? ` - ${grupo.nome}` : ` - ${grupo.nome} - ${pagina.nome}`;
    if (!lista.length) return;
    paginas.current = [];
    setK(0);
    setFila({ slides: lista, nome: `Relatório Executivo - ${periodo.replace("/", " ")}${nome}` });
  };
  // Um slide por vez: desenha, espera ficar pronto, vira a imagem e passa ao próximo; no fim, monta e baixa o PDF.
  useEffect(() => {
    if (!fila) return;
    let cancelado = false;
    (async () => {
      const no = area.current;
      if (!no) return;
      try {
        await slidePronto(no);
        const fundo = fundoAtras(no);
        const fontes = await fontesDaPagina(no);
        // A primeira imagem só aquece o navegador (como no Copiar como Imagem), que às vezes a desenha incompleta.
        if (k === 0) await jpegDoSlide(no, fundo, fontes);
        const p = await jpegDoSlide(no, fundo, fontes);
        if (cancelado) return;
        paginas.current.push(p);
        if (k + 1 < fila.slides.length) {
          setK(k + 1);
          return;
        }
        const url = URL.createObjectURL(pdfDeImagens(paginas.current));
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fila.nome.replace(/[\\/:*?"<>|]/g, "-")}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        toast.success(`PDF gerado: ${fila.slides.length === 1 ? "1 slide" : `${fila.slides.length} slides`}.`);
        setFila(null);
      } catch {
        if (!cancelado) {
          toast.error("Não foi possível gerar o PDF.");
          setFila(null);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [fila, k]);
  const largura = typeof window === "undefined" ? 1920 : window.screen.width;
  const altura = typeof window === "undefined" ? 1080 : window.screen.height;
  const contagem = (n: number) => (n === 1 ? "1 slide" : `${n} slides`);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" className={botaoPrimario} disabled={!slides.length || !!fila} title={slides.length ? "Exportar os slides em PDF" : "Nenhuma página com blocos para exportar"}>
              <Download className="size-4" />
              {fila ? `Gerando PDF… ${k + 1}/${fila.slides.length}` : "Exportar"}
              <ChevronDown className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-max min-w-56 [&_[role=menuitem]]:whitespace-nowrap">
          {/* O rótulo dentro do grupo (o menu exige). */}
          <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-bold text-gray-700">PDF</DropdownMenuLabel>
          <DropdownMenuItem className="flex justify-between gap-6 pl-6" onClick={() => exportar("TUDO")}>
            Toda a Apresentação
            <span className="text-xs text-gray-500">{contagem(slides.length)}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex justify-between gap-6 pl-6" disabled={!doGrupo.length} onClick={() => exportar("GRUPO")}>
            Grupo Atual ({grupo.nome})
            <span className="text-xs text-gray-500">{contagem(doGrupo.length)}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex justify-between gap-6 pl-6" disabled={!daPagina.length} onClick={() => exportar("ABA")}>
            Aba Atual ({pagina.nome})
            <span className="text-xs text-gray-500">{contagem(daPagina.length)}</span>
          </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* O slide em desenho, fora da tela, no tamanho da tela inteira (o da apresentação). */}
      {fila ? (
        <div aria-hidden className="pointer-events-none fixed top-0 left-[-100000px] select-none" style={{ width: largura, height: altura }}>
          {/* isolate: o fundo do slide fica atrás do separador do rodapé (que fica atrás da Imagem de Fundo). */}
          <div ref={area} className="relative isolate size-full overflow-hidden bg-background">
            <SlideDoRelatorio key={fila.slides[k]?.chave} relatorioId={relatorioId} periodo={periodo} slide={fila.slides[k]} sumario={sumario} dados={dados} cores={cores} tipo={tipo} paraImagem />
          </div>
        </div>
      ) : null}
    </>
  );
}
