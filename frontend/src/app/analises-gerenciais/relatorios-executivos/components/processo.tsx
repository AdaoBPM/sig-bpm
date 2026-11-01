"use client";

import { createContext, useContext } from "react";

import { servicoDosSlides, type RotaDosSlides, type ServicoDosSlides } from "../services/relatoriosExecutivosService";

/**
 * O processo dos slides (31/10/2026, pedido do Adão: os Painéis de Bordo, feitos a partir dos Relatórios Executivos, com
 * todas as melhorias e correções deles): a edição, a apresentação, o PDF e os blocos são os mesmos nos dois processos; o
 * processo diz a rota da API (e das imagens e dos vídeos), as chaves das consultas e os nomes que mudam. Sem o provedor,
 * os Relatórios Executivos.
 */
export type ProcessoDosSlides = {
  /** A rota da API e a pasta dos arquivos; também o início das chaves das consultas. */
  rota: RotaDosSlides;
  /** A tela da lista (a volta depois de excluir). */
  tela: string;
  /** O nome do documento, no topo dos slides e no PDF: "Relatório Executivo" ou "Painel de Bordo". */
  nome: string;
  /** O documento nos textos, sem o artigo (os dois são masculinos): "relatório" ou "painel". */
  documento: string;
  /** Há mais de um grupo (as abas dos relatórios): os botões de grupo da apresentação e o Grupo Atual do PDF. */
  comGrupos: boolean;
  /** Quem muda as Configurações, para quem não muda. */
  semEdicao: string;
  /** O nome do conjunto de páginas nos modais (“Aplicar ao Grupo”; no painel, “Aplicar ao Painel”). */
  grupo: string;
  servico: ServicoDosSlides;
};

export const RELATORIOS_EXECUTIVOS: ProcessoDosSlides = {
  rota: "relatorios-executivos",
  tela: "/analises-gerenciais/relatorios-executivos",
  nome: "Relatório Executivo",
  documento: "relatório",
  comGrupos: true,
  semEdicao: "Só quem edita os Relatórios Executivos muda as configurações.",
  grupo: "Grupo",
  servico: servicoDosSlides("relatorios-executivos"),
};

/**
 * Os Painéis de Bordo (31/10/2026): uma tela só (um grupo); quem criou o painel (ou o Administrador) e, desde 01/11/2026,
 * os editores que ele convida o alteram e o finalizam, como um grupo dos relatórios.
 */
export const PAINEIS_DE_BORDO: ProcessoDosSlides = {
  rota: "paineis-de-bordo",
  tela: "/analises-gerenciais/paineis-de-bordo",
  nome: "Painel de Bordo",
  documento: "painel",
  comGrupos: false,
  semEdicao: "Só quem edita o painel — quem o criou, os editores convidados e os Administradores — muda os comparativos.",
  grupo: "Painel",
  servico: servicoDosSlides("paineis-de-bordo"),
};

const Contexto = createContext<ProcessoDosSlides>(RELATORIOS_EXECUTIVOS);
export const ProvedorDoProcesso = Contexto.Provider;
export const useProcesso = () => useContext(Contexto);
