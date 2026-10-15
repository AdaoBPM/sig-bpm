"use client";

import { useState, type ReactNode } from "react";

import { ListaCadastroContent } from "../components/ListaCadastroContent";
import { BotaoNovoRateio } from "./NovoRateio";
import { AvisoRegrasRateio, PercentuaisFixosDialog } from "./PercentuaisFixos";

/**
 * A lista das Regras de Rateio (14/10/2026): o lápis de uma regra de percentual fixo abre o modal Percentuais Fixos na
 * chave e no conjunto dela (o formulário de sempre não edita as regras fixas: elas se gravam com os destinos da chave).
 */
export function RegrasRateioContent({ comoUsar, descricao }: { comoUsar: ReactNode; descricao: string }) {
  const [fixo, setFixo] = useState<{ chave: string; inicio: string } | null>(null);
  return (
    <>
      <ListaCadastroContent
        entidade="regras-rateio"
        rota="/cadastros/regras-rateio"
        titulo="Regras de Rateio"
        apenasAtivas
        novo={<BotaoNovoRateio />}
        aviso={<AvisoRegrasRateio />}
        comoUsar={comoUsar}
        descricao={descricao}
        aoEditar={(r) =>
          r.percentualFixoTexto ? () => setFixo({ chave: String(r.chave), inicio: String(r.vigenciaInicio ?? "").slice(0, 10) }) : null
        }
      />
      {fixo ? <PercentuaisFixosDialog inicial={fixo} onFechar={() => setFixo(null)} /> : null}
    </>
  );
}
