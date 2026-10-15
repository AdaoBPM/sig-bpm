"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { Erro } from "../../../components/CenarioDialog";
import { ConfiguracoesCenario, type AbaDasConfiguracoes } from "../../../components/ConfiguracoesCenario";
import { cenariosService } from "../../../services/cenariosService";
import { useTipoDoCenario } from "../../../components/tipoDoCenario";

/** A tela Configurações de um cenário (12/10/2026; antes, a primeira aba da tela Editar, que deixou de existir). */
export function ConfiguracoesContent() {
  const { id } = useParams<{ id: string }>();
  const t = useTipoDoCenario();
  useRegistrarAcessoTela(`${t.base}/${id}/configuracoes`);
  const cenario = useQuery({ queryKey: ["cenarios", id], queryFn: () => cenariosService.obter(id) });
  // ?aba=comparativo (ou referencia) abre direto na aba: os avisos do comparativo levam para cá.
  const pedida = useSearchParams().get("aba");
  const abaInicial: AbaDasConfiguracoes = pedida === "comparativo" || pedida === "referencia" ? pedida : "cenario";
  const analitico = t.tipo === "ANALITICO";
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Configurações"
        comoUsar={
          <ul>
            <li>Na aba Cenário, mude o nome, a descrição e a visualização (Particular ou Pública) e clique em “Gravar Configurações”. Depois da primeira revisão, o nome fica travado: é o mesmo em todas as versões do cenário. Com o cenário marcado ou com a versão congelada, o nome e a descrição não mudam (a visualização, sim).</li>
            <li>
              Também na aba Cenário: “Marcar Cenário” marca o cenário como Orçamento Empresarial, Resultados Anteriores ou Resultados Vendidos (cada
              marcação fica ativa em um cenário só: marcar este tira a do anterior), e “Excluir Cenário” o exclui (um cenário marcado não se exclui).
            </li>
            {analitico ? (
              <>
                <li>
                  Na aba Referência (opcional): carregue o resultado realizado das competências fechadas de um exercício (Média do Período ou Mês a
                  Mês) ou outro cenário analítico. O realizado traz só as Médias de Referência — das premissas, dos centros de custo (com o quadro de
                  lotação), da depreciação base, do extra-operacional e dos indicadores manuais —, com os meses do cenário em branco (no Mês a Mês, também
                  cada mês fechado no seu mês, menos nas premissas das unidades); use “Replicar Médias”, na tela Premissas, para levar as médias aos
                  meses. Outro analítico traz as premissas, os centros, os investimentos e os indicadores dele. A média de cada conta dos centros de
                  custo divide a soma do período só pelos meses em que a conta teve movimentação. Os avisos do que não coube aparecem embaixo.
                </li>
                <li>A Correspondência Tarefa × Linha, que leva os custos do realizado às linhas, fica nos Cadastros da Controladoria / Linhas, no botão “Tarefas”.</li>
                <li>
                  Se a carga do realizado encontrar movimentações fora dos padrões das premissas (mão de obra e gastos gerais sem centro de custo, em
                  centros fora do cenário — estoque, investimento, obras — ou numa conta fora do grupo do centro), o quadro “Movimentações Fora dos
                  Padrões” aparece na aba Referência. Em “Realocar”, cada conta mostra a alocação na DRE (Departamento, Atribuição e Conta de Resultado),
                  o valor do período e o centro de custo que a recebe (só os grupos com a mesma atribuição e conta; num centro de outro departamento,
                  ela entra como do departamento dele). Sem centro, a conta fica fora do cenário, e gravar assim pede confirmação. As realocações ficam
                  registradas no quadro, entram na Média de Referência dos centros do cenário (no Mês a Mês, também nos meses; a DRE se recalcula) e valem nas próximas cargas do realizado, ainda editáveis.
                </li>
                <li>
                  “Aplicar Padrão”, no pé do modal, preenche os centros pelo padrão (pela filial em que a conta mais lançou): Produção Matriz — MOD,
                  GGD e GGV em Estrutura, MOI e GGI em PCP (CRI); Produção Filial — MOD, GGD e GGV em Alveolares, MOI e GGI em PCP (FOR); Serviços —
                  MOD, GGD e GGV em Guindasteiros, MOI e GGI em Adm. de Obras; Logística em Logística; Técnico em Técnico; Comercial em Orçamentos;
                  Administrativo em Financeiro. Ele só preenche: confira e clique em “Gravar”.
                </li>
              </>
            ) : (
              <li>Na aba Referência (opcional): importe um arquivo (como o ORÇAMENTO BPM) ou carregue o resultado realizado das competências fechadas de um exercício. Ela substitui a DRE do cenário, que depois se edita na tela Resultados.</li>
            )}
            <li>Troque de cenário no nome dele, na barra do topo; ao lado, as telas Resultados e Indicadores.</li>
            <li>Aparecem só as abas que o seu perfil lê, e os botões de cada aba só com a permissão de editar nela (Controle de Usuários / Perfis); sem ela, a aba se lê, com um aviso.</li>
            <li>Só quem criou o cenário (ou o Administrador) altera as Configurações: num cenário público de outro usuário, as abas se leem, com um aviso que diz de quem é o cenário.</li>
            <li>Na Referência, os meses fechados do exercício aparecem resumidos (por exemplo, “Fechada: de Janeiro a Agosto.”).</li>
            <li>
              Na aba Comparativo, escolha o cenário com que este se compara e a variação máxima (em %, para mais ou para menos) de cada conta, na
              estrutura da DRE vigente (totais, atribuições e contas; a seta no rótulo da coluna escolhe até que nível mostrar, e as setas das linhas
              abrem e fecham cada grupo). A variação digitada num total ou numa atribuição vale para todas as contas abaixo dele; com contas de
              variações diferentes, o campo dele fica em branco (“Várias”). Em branco, a conta não se verifica. “Preencher Todos Com” põe o mesmo
              percentual em todas. Clique em “Gravar Comparativo”. “Nenhum” desliga o comparativo (as variações ficam guardadas). Com o cenário
              marcado ou com a versão congelada, o comparativo só se lê.
            </li>
            <li>
              Com um cenário comparado, as telas Resultados e Indicadores trazem, em preto e cinza depois do total, os totais dele (e, nos Resultados, a
              Diferença, o Atingimento e a Eficiência), e a tela Reajustes ganha a aba Justificativas, com as contas acima da variação.
            </li>
          </ul>
        }
        sobre={
          analitico ? (
            <p>
              Os dados do cenário e a base opcional das premissas dele: o resultado realizado ou outro cenário analítico (os analíticos só importam de
              analíticos). A DRE do analítico é sempre calculada das premissas, dos centros de custo, dos investimentos e do extra-operacional. Na
              referência realizada, os custos de cada conta vão para as linhas pela Correspondência Tarefa × Linha; o que não tem tarefa vai pelo volume.
            </p>
          ) : (
            <p>
              Os dados do cenário e a base opcional da DRE dele: um arquivo importado ou o resultado realizado. Sem referência, a DRE se digita inteira
              na tela Resultados, com os totais calculados pela Estrutura da DRE.
            </p>
          )
        }
      />
      {cenario.isError ? (
        <Erro erro={mensagemDeErro(cenario.error, "Erro ao carregar o cenário.")} />
      ) : cenario.isPending ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : (
        <ConfiguracoesCenario key={`${cenario.data.nome}|${cenario.data.descricao}|${cenario.data.visualizacao}`} cenario={cenario.data} abaInicial={abaInicial} />
      )}
    </div>
  );
}
