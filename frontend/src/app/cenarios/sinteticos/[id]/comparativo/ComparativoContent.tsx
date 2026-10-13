"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { ComparativoCenario } from "../../../components/ComparativoCenario";
import { JustificativasCenario } from "../../../components/JustificativasCenario";
import { cenariosService } from "../../../services/cenariosService";

/**
 * A tela Comparativo de um cenário (13/10/2026; antes, a tela Justificativas e a aba Comparar dos Resultados): a aba
 * Referência (o cenário comparado e a variação máxima de cada total da DRE) e, com um cenário comparado, a aba
 * Justificativas (as contas acima da variação e a justificativa de cada uma).
 */
export function ComparativoContent() {
  const { id } = useParams<{ id: string }>();
  useRegistrarAcessoTela(`/cenarios/sinteticos/${id}/comparativo`);
  const { hasPermission } = usePermissions();
  const podeEditar = hasPermission("cenarios:editar");
  const cenario = useQuery({ queryKey: ["cenarios", id], queryFn: () => cenariosService.obter(id) });
  const comComparativo = !!cenario.data?.comparadoComId;
  const [escolhida, setAba] = useState<"referencia" | "justificativas" | null>(null);
  // Com um cenário comparado, a tela abre nas Justificativas; sem ele, na Referência (a única aba).
  const aba = !comComparativo ? "referencia" : (escolhida ?? "justificativas");
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Comparativo"
        comoUsar={
          <ul>
            <li>
              Na aba Referência, escolha o cenário com que este se compara e a variação máxima (em %, para mais ou para menos) de cada total da DRE;
              em branco, o total não se verifica. “Preencher Todos Com” põe o mesmo percentual em todos. Clique em “Gravar Comparativo”.
            </li>
            <li>Com um cenário comparado, aparece a aba Justificativas (e a tela abre nela). “Nenhum” desliga o comparativo; as variações ficam guardadas.</li>
            <li>Com um cenário comparado, as telas Resultados e Indicadores trazem também, em preto e cinza depois do total, os totais dele (e, nos Resultados, a Diferença, o Atingimento e a Eficiência).</li>
            <li>Nas Justificativas, escolha a aba da DRE (Consolidado ou cada unidade); o número em cada aba é o de contas acima da variação.</li>
            <li>Cada linha é uma conta com algum mês acima da variação máxima do total dela: os meses mostram a variação (passe o mouse para ver o valor do cenário e o do comparado). “Sem base”: o comparado é zero no mês.</li>
            <li>Digite a justificativa e clique em “Gravar”; apagar o texto e gravar apaga a justificativa. “Só Sem Justificativa” esconde as já justificadas.</li>
            <li>A lista se refaz a cada abertura: uma conta que deixa de passar da variação sai da lista (a justificativa fica guardada e volta se ela passar de novo).</li>
          </ul>
        }
        sobre={
          <p>
            A comparação do cenário com outro, conta a conta, mês a mês e em cada aba da DRE. A variação é a diferença para o comparado dividida pelo
            valor do comparado, para mais ou para menos; as contas que passam da variação máxima do total delas pedem justificativa. O total sem contas
            embaixo (como a Margem Bruta e o EBITDA) se compara ele mesmo.
          </p>
        }
      />
      <Abas
        rotulo="Comparativo do cenário"
        ativa={aba}
        onMudar={(a) => setAba(a as "referencia" | "justificativas")}
        abas={[{ chave: "referencia", rotulo: "Referência" }, ...(comComparativo ? [{ chave: "justificativas", rotulo: "Justificativas" }] : [])]}
      />
      {aba === "referencia" ? (
        <ComparativoCenario id={id} podeEditar={podeEditar} />
      ) : (
        <JustificativasCenario id={id} podeEditar={podeEditar} onIrParaReferencia={() => setAba("referencia")} />
      )}
    </div>
  );
}
