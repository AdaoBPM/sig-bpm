"use client";

import { useMemo, useState } from "react";
import { Delete, Eraser, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { Opcao } from "../services/edicaoService";

/**
 * O montador da fórmula de um indicador (Estrutura dos Indicadores, 11/10/2026): a fórmula aparece por extenso, item a
 * item, e se monta inserindo itens (linhas da DRE por unidade, totalizadores das Listas, indicadores do Comercial e do
 * Administrativo, metas do orçamento), operadores (+ − × ÷), parênteses e números. Grava o texto da fórmula, com os
 * itens entre colchetes ([DRE|1|CPP…]). Os tipos de item são os que as opções trazem: na Metodologia do Painel de Bordo
 * (17/10/2026), só os indicadores ([INDICADOR|nome]); na dos indicadores, todos (desde 23/10/2026, também outros
 * indicadores do cadastro).
 */

const TIPOS = [
  { valor: "DRE", rotulo: "Linha da DRE" },
  { valor: "LISTA", rotulo: "Totalizador das Listas" },
  { valor: "IND", rotulo: "Comercial e Administrativo" },
  { valor: "META", rotulo: "Meta do Orçamento" },
  { valor: "INDICADOR", rotulo: "Indicador" },
];
const VISOES = [
  { valor: "0", rotulo: "Consolidado" },
  { valor: "1", rotulo: "Matriz" },
  { valor: "2", rotulo: "Filial" },
  { valor: "3", rotulo: "Serviços" },
  { valor: "4", rotulo: "Despesas e Extra" },
  { valor: "5", rotulo: "RN" },
];
const OPERADORES: Array<{ valor: string; rotulo: string; dica: string }> = [
  { valor: "+", rotulo: "+", dica: "Somar" },
  { valor: "-", rotulo: "−", dica: "Subtrair" },
  { valor: "*", rotulo: "×", dica: "Multiplicar" },
  { valor: "/", rotulo: "÷", dica: "Dividir" },
  { valor: "(", rotulo: "(", dica: "Abrir parêntese" },
  { valor: ")", rotulo: ")", dica: "Fechar parêntese" },
];

/** Os pedaços da fórmula: itens entre colchetes, números, operadores e parênteses. */
const pedacos = (formula: string) => formula.match(/\[[^\]]*\]|\d+(?:[.,]\d+)?|[-+*/()]/g) ?? [];

const classeSelect = "h-9 rounded-sm border border-gray-300 bg-white px-2 text-sm";

export function EditorFormula({ valor, onMuda, opcoes, travado, id }: { valor: string; onMuda: (v: string) => void; opcoes: Opcao[]; travado?: boolean; id?: string }) {
  // Os tipos que as opções trazem, na ordem de TIPOS.
  const tipos = useMemo(() => TIPOS.filter((t) => opcoes.some((o) => o.grupos?.includes(t.valor))), [opcoes]);
  const [tipo, setTipo] = useState(() => tipos[0]?.valor ?? "DRE");
  const [visao, setVisao] = useState("0");
  const [busca, setBusca] = useState("");
  const [item, setItem] = useState("");
  const [numero, setNumero] = useState("");
  const lista = pedacos(valor);
  const rotulos = useMemo(() => new Map(opcoes.map((o) => [o.valor, o.rotulo])), [opcoes]);
  const doTipo = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return opcoes.filter((o) => o.grupos?.includes(tipo) && (!t || o.rotulo.toLowerCase().includes(t)));
  }, [opcoes, tipo, busca]);

  /** O pedaço como a tela mostra: o item pelo nome (a linha da DRE com a visão), os operadores como × e ÷. */
  const mostrar = (p: string) => {
    if (!p.startsWith("[")) return OPERADORES.find((o) => o.valor === p)?.rotulo ?? p.replace(".", ",");
    const partes = p.slice(1, -1).split("|");
    if (partes[0] === "DRE") return `${rotulos.get(`DRE|${partes[2]}`) ?? partes[2]} (${VISOES.find((v) => v.valor === partes[1])?.rotulo ?? partes[1]})`;
    // O indicador pelo nome (a opção traz o grupo antes: "Produção › …").
    if (partes[0] === "INDICADOR") return partes[1];
    const r = rotulos.get(`${partes[0]}|${partes[1]}`) ?? partes[1];
    return partes[0] === "META" ? `Meta: ${r}` : partes[0] === "LISTA" ? `${r} [Listas]` : r;
  };
  const inserir = (p: string) => onMuda([...lista, p].join(" "));
  const inserirItem = () => {
    if (!item) return;
    const [t, chave] = [item.slice(0, item.indexOf("|")), item.slice(item.indexOf("|") + 1)];
    inserir(t === "DRE" ? `[DRE|${visao}|${chave}]` : `[${t}|${chave}]`);
    setItem("");
  };

  return (
    <div className="space-y-2" id={id}>
      {/* A fórmula por extenso, item a item. */}
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-sm border border-gray-300 bg-white px-2 py-1.5">
        {lista.length === 0 ? (
          <span className="text-sm text-gray-400">{travado ? "—" : "Monte a fórmula com os itens e os operadores abaixo."}</span>
        ) : (
          lista.map((p, k) =>
            p.startsWith("[") ? (
              <span key={k} className="rounded-sm border border-gray-200 bg-yellow-50 px-1.5 py-0.5 text-xs text-gray-900">
                {mostrar(p)}
              </span>
            ) : (
              <span key={k} className="px-0.5 text-sm font-bold text-gray-900">
                {mostrar(p)}
              </span>
            ),
          )
        )}
      </div>
      {travado ? null : (
        <>
          {/* O item a inserir: o tipo, a unidade (nas linhas da DRE), a busca e o item. */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Com um tipo só (os indicadores, no Painel de Bordo), a escolha do tipo sai. */}
            {tipos.length > 1 ? (
              <select
                aria-label="Tipo do item"
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value);
                  setItem("");
                }}
                className={classeSelect}
              >
                {tipos.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </option>
                ))}
              </select>
            ) : null}
            {tipo === "DRE" ? (
              <select aria-label="Unidade da linha da DRE" value={visao} onChange={(e) => setVisao(e.target.value)} className={classeSelect}>
                {VISOES.map((v) => (
                  <option key={v.valor} value={v.valor}>
                    {v.rotulo}
                  </option>
                ))}
              </select>
            ) : null}
            {/* A busca ocupa o resto da linha, até a lateral do modal (20/10/2026). */}
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item…" className="h-9 min-w-40 flex-1 rounded-sm" aria-label="Buscar item" />
          </div>
          <div className="flex items-center gap-2">
            <select aria-label="Item" value={item} onChange={(e) => setItem(e.target.value)} className={`${classeSelect} min-w-0 flex-1`}>
              <option value="">{doTipo.length ? `Escolha o item (${doTipo.length})…` : "Nenhum item com essa busca"}</option>
              {doTipo.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" className="rounded-sm" disabled={!item} onClick={inserirItem}>
              <Plus className="size-4" />
              Inserir Item
            </Button>
          </div>
          {/* Os operadores, os números e a correção; Apagar e Limpar na linha do Inserir (20/10/2026: nomes curtos para caberem). */}
          <div className="flex flex-wrap items-center gap-1.5">
            {OPERADORES.map((o) => (
              <Button key={o.valor} type="button" variant="outline" className="h-9 w-9 rounded-sm px-0 text-base font-bold" title={o.dica} onClick={() => inserir(o.valor)}>
                {o.rotulo}
              </Button>
            ))}
            <Input
              value={numero}
              onChange={(e) => setNumero(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="Número"
              inputMode="decimal"
              className="h-9 w-20 min-w-20 flex-1 rounded-sm"
              aria-label="Número"
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-sm"
              disabled={!/^\d+([.,]\d+)?$/.test(numero)}
              onClick={() => {
                inserir(numero.replace(",", "."));
                setNumero("");
              }}
            >
              Inserir
            </Button>
            <Button type="button" variant="outline" className="rounded-sm" disabled={lista.length === 0} onClick={() => onMuda(lista.slice(0, -1).join(" "))} title="Apagar o último pedaço da fórmula">
              <Delete className="size-4" />
              Apagar
            </Button>
            <Button type="button" variant="outline" className="rounded-sm" disabled={lista.length === 0} onClick={() => onMuda("")} title="Apagar a fórmula inteira">
              <Eraser className="size-4" />
              Limpar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
