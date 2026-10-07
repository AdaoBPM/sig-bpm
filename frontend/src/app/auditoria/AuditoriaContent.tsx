"use client";

import { Fragment, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Carregando, ErroCarga } from "@/components/shared/Estados";
import { BarraDeFiltros } from "@/components/shared/Filtros";
import { PainelFiltro } from "@/components/shared/TabelaFiltravel";
import { Paginacao } from "@/components/shared/Paginacao";
import { QuadroTabela } from "@/components/shared/QuadroTabela";

import { dataHora, inteiro } from "../competencias/[anoMes]/utils/formatacao";
import { auditoriaService, type FiltroAuditoria, type RegistroAuditoria } from "./services/auditoriaService";


/** Achata um objeto em "caminho → valor", para comparar o antes e o depois campo a campo. */
function achatar(x: unknown, prefixo = ""): Map<string, string> {
  const m = new Map<string, string>();
  if (x === null || x === undefined) return m;
  if (typeof x !== "object") {
    m.set(prefixo || "valor", String(x));
    return m;
  }
  if (Array.isArray(x) && x.every((v) => typeof v !== "object" || v === null)) {
    m.set(prefixo || "valor", x.join(", "));
    return m;
  }
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    const caminho = prefixo ? `${prefixo}.${k}` : k;
    if (v !== null && typeof v === "object") for (const [a, b] of achatar(v, caminho)) m.set(a, b);
    else m.set(caminho, v === null ? "—" : String(v));
  }
  return m;
}

/** O antes e o depois lado a lado; os campos que mudaram ficam destacados. */
function Diferencas({ r }: { r: RegistroAuditoria }) {
  const antes = achatar(r.dadosAntes);
  const depois = achatar(r.dadosDepois);
  const meta = achatar(r.metadados);
  if (r.entidadeId) meta.set("identificador", r.entidadeId);
  const campos = [...new Set([...antes.keys(), ...depois.keys()])];
  return (
    <div className="space-y-3 text-xs">
      {campos.length > 0 ? (
        <table className="tabela-sig w-full border-collapse">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-3 font-medium">Campo</th>
              <th className="py-1 pr-3 font-medium">Antes</th>
              <th className="py-1 font-medium">Depois</th>
            </tr>
          </thead>
          <tbody>
            {campos.map((c) => {
              const mudou = antes.get(c) !== depois.get(c);
              return (
                <tr key={c} className={`border-t border-gray-100 align-top ${mudou ? "bg-yellow-50" : ""}`}>
                  <td className="py-1 pr-3 font-mono text-gray-600">{c}</td>
                  <td className="py-1 pr-3 break-all text-gray-700">{antes.get(c) ?? "—"}</td>
                  <td className="py-1 break-all text-gray-900">{depois.get(c) ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      {meta.size > 0 ? (
        <div className="space-y-0.5 text-gray-600">
          {[...meta].map(([k, v]) => (
            <p key={k}>
              <span className="font-mono text-gray-500">{k}</span>: <span className="break-all">{v}</span>
            </p>
          ))}
        </div>
      ) : null}
      {r.ip ? <p className="text-gray-400">IP {r.ip}</p> : null}
    </div>
  );
}

export function AuditoriaContent() {
  useRegistrarAcessoTela("/auditoria");
  const [filtro, setFiltro] = useState<FiltroAuditoria>({ incluirAcessos: false, pagina: 1 });
  const [aberto, setAberto] = useState<string | null>(null);
  const opcoes = useQuery({ queryKey: ["auditoria", "opcoes"], queryFn: auditoriaService.opcoes });
  const log = useQuery({ queryKey: ["auditoria", filtro], queryFn: () => auditoriaService.consultar(filtro), placeholderData: keepPreviousData });
  const muda = (p: Partial<FiltroAuditoria>) => setFiltro((f) => ({ ...f, ...p, pagina: p.pagina ?? 1 }));
  const rotuloAcao = new Map(opcoes.data?.acoes.map((a) => [a.acao, a.rotulo]));
  const rotuloEntidade = new Map(opcoes.data?.entidades.map((e) => [e.entidade, e.rotulo]));

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Auditoria"
        comoUsar={
          <ul>
            <li>Informe o período em De e Até e use os filtros nos rótulos das colunas.</li>
            <li>Marque “Incluir Acessos às Telas” para ver também as visitas às telas.</li>
            <li>Clique numa linha para ver cada campo alterado, com o antes e o depois.</li>
          </ul>
        }
        sobre={<p>Quem fez o quê, quando e em qual registro, com o estado antes e depois. O log é imutável: nenhum perfil altera ou apaga um registro.</p>}
      />

      {/* Filtros no padrão (G8 do levantamento de layout). */}
      <BarraDeFiltros
        ativos={!!(filtro.de || filtro.ate || filtro.usuarioId || filtro.entidade || filtro.acao || filtro.ordem || filtro.incluirAcessos)}
        onLimpar={() => setFiltro({ incluirAcessos: false, pagina: 1 })}
      >
        <div className="space-y-1">
          <label htmlFor="a-de" className="block text-xs font-medium text-gray-600">De</label>
          <Input id="a-de" type="date" value={filtro.de ?? ""} onChange={(e) => muda({ de: e.target.value || undefined })} className="h-9 w-40 rounded-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor="a-ate" className="block text-xs font-medium text-gray-600">Até</label>
          <Input id="a-ate" type="date" value={filtro.ate ?? ""} onChange={(e) => muda({ ate: e.target.value || undefined })} className="h-9 w-40 rounded-sm" />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={filtro.incluirAcessos} onChange={(e) => muda({ incluirAcessos: e.target.checked })} className="size-4 accent-black" />
          Incluir Acessos às Telas
        </label>
      </BarraDeFiltros>

      <QuadroTabela
        rodape={log.data && log.data.total > 0 ? <Paginacao total={log.data.total} pagina={filtro.pagina} porPagina={log.data.porPagina} onPagina={(p) => muda({ pagina: p })} carregando={log.isFetching} /> : null}
      >
        {log.isError ? <ErroCarga mensagem="Erro ao carregar o log." /> : null}
        <table className="tabela-sig w-full border-collapse text-sm">
          {/* Filtros nos rótulos, como no Excel, aplicados no servidor: o log cresce sem parar e é paginado lá. */}
          <thead>
            {/* Rótulos com filtro em amarelo-ouro, como nas demais tabelas; o "!" vence o fundo do .tabela-sig th. */}
            <tr className="border-b border-gray-200 text-left text-xs font-bold text-gray-900 [&>th]:!bg-bpm-primary">
              <th className="px-4 py-2">
                <span className="inline-flex items-center gap-1">
                  Quando
                  <PainelFiltro
                    rotulo="Quando"
                    tipo="data"
                    soOrdenar
                    filtrado={false}
                    ordem={filtro.ordem ? { decrescente: filtro.ordem === "desc" } : null}
                    valores={() => []}
                    marcadosAoAbrir={() => []}
                    onOrdenar={(decrescente) => muda({ ordem: decrescente ? "desc" : "asc" })}
                    onAplicar={() => undefined}
                  />
                </span>
              </th>
              {(
                [
                  ["Usuário", "usuarioId", (opcoes.data?.usuarios ?? []).map((u) => ({ chave: u.id, texto: u.nome }))],
                  ["Ação", "acao", (opcoes.data?.acoes ?? []).map((a) => ({ chave: a.acao, texto: a.rotulo }))],
                  ["Entidade", "entidade", (opcoes.data?.entidades ?? []).map((e) => ({ chave: e.entidade, texto: e.rotulo }))],
                ] as const
              ).map(([rotulo, campo, valores]) => (
                <th key={campo} className="px-4 py-2">
                  <span className="inline-flex items-center gap-1">
                    {rotulo}
                    <PainelFiltro
                      rotulo={rotulo}
                      filtrado={!!filtro[campo]}
                      ordem={null}
                      valores={() => [...valores]}
                      marcadosAoAbrir={() => filtro[campo] ?? valores.map((v) => v.chave)}
                      onOrdenar={() => undefined}
                      onAplicar={(chaves) => muda({ [campo]: chaves ?? undefined })}
                      semOrdem
                    />
                  </span>
                </th>
              ))}
              <th className="px-4 py-2">Registro</th>
            </tr>
          </thead>
          <tbody>
            {log.isPending && !log.data ? (
              <tr>
                <td colSpan={5}>
                  <Carregando linhas={4} />
                </td>
              </tr>
            ) : log.data?.itens.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Nenhum registro com esses filtros.
                </td>
              </tr>
            ) : (
              log.data?.itens.map((r) => {
                const ab = aberto === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className="cursor-pointer border-b border-gray-100 hover:bg-gray-50" onClick={() => setAberto(ab ? null : r.id)}>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {ab ? <ChevronDown className="size-3.5 text-gray-400" /> : <ChevronRight className="size-3.5 text-gray-400" />}
                          {dataHora(r.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-2">{r.usuarioNome ?? "—"}</td>
                      <td className="px-4 py-2">{rotuloAcao.get(r.acao) ?? r.acao}</td>
                      <td className="px-4 py-2">{rotuloEntidade.get(r.entidade ?? "") ?? r.entidade ?? "—"}</td>
                      {/* O nome do registro; o identificador técnico fica no detalhe (E14 do levantamento de layout). */}
                      <td className="px-4 py-2 text-xs text-gray-600">
                        <div className="max-w-80 truncate" title={r.registro ?? undefined}>
                          {r.registro ?? "—"}
                        </div>
                      </td>
                    </tr>
                    {ab ? (
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <td colSpan={5} className="px-8 py-3">
                          <Diferencas r={r} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </QuadroTabela>
    </div>
  );
}
