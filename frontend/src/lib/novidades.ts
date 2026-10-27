import { navGrupos, permissaoDaTela } from "./navigation-config";

/**
 * As Novidades (24/10/2026, pedido do Adão): o resumo do que cada publicação trouxe, para os usuários, no modal
 * Novidades (o menu do usuário e o sino ao lado do nome). Cada registro é de uma publicação, um processo (o link do menu
 * lateral) e uma tela; o modal junta os registros por dia, processo e tela. O usuário vê só os das telas que alcança (a
 * permissão da `rota`, a mesma do menu); sem `rota`, todos. A cada publicação, os registros dela entram aqui, no alto.
 */
export type Novidade = {
  /** Quando foi publicada (a data e a hora da tag), "AAAA-MM-DDTHH:MM": a ordem e o que o usuário ainda não viu. */
  publicada: string;
  /** O processo (o link do menu lateral) ou "Todo o SIG". */
  processo: string;
  /** A tela do processo; sem ela, o processo todo. */
  tela?: string;
  /** Um endereço da tela, para a permissão (permissaoDaTela); sem ele, todos os usuários. */
  rota?: string;
  /** Só para o Administrador. */
  soAdministrador?: boolean;
  itens: string[];
};

export const TODO_O_SIG = "Todo o SIG";

const RE = "/analises-gerenciais/relatorios-executivos";
const RESULTADOS = "/relatorios/resultados";
const PAINEL = "/relatorios/painel";
const DRE = "/competencias/0000-00/dre";

export const NOVIDADES: Novidade[] = [
  // 27/10/2026, 16:00
  {
    publicada: "2026-10-27T16:00",
    processo: "Contestação de Gastos",
    soAdministrador: true,
    itens: ["Novo processo em Apuração dos Resultados, logo acima do Fechamento Mensal, em desenvolvimento."],
  },
  {
    publicada: "2026-10-27T16:00",
    processo: "Registros dos Indicadores",
    soAdministrador: true,
    itens: ["Novo processo em Apuração dos Resultados, logo acima dos Cadastros da Apuração, em desenvolvimento."],
  },
  {
    publicada: "2026-10-27T16:00",
    processo: "Integrações e Consultas",
    soAdministrador: true,
    itens: ["O processo Integrações, da Central de Conectividade, passa a se chamar Integrações e Consultas."],
  },
  // 27/10/2026, 15:37
  {
    publicada: "2026-10-27T15:37",
    processo: "Demonstrativos Financeiros",
    soAdministrador: true,
    itens: ["Novo processo em Análises Gerenciais, em desenvolvimento."],
  },
  // 27/10/2026, 15:29
  {
    publicada: "2026-10-27T15:29",
    processo: "Relatórios Executivos",
    rota: RE,
    itens: ["Na barra do topo, a situação do relatório (Em Elaboração ou Finalizado) fica à direita, depois das abas."],
  },
  {
    publicada: "2026-10-27T15:29",
    processo: "Fechamento Mensal",
    tela: "Barra de Etapas",
    rota: "/competencias/0000-00/importar",
    itens: ["A situação da competência fica à direita da barra de etapas, depois de Divergências."],
  },
  {
    publicada: "2026-10-27T15:29",
    processo: "Balanço Patrimonial",
    soAdministrador: true,
    itens: ["Novo processo em Apuração dos Resultados, em desenvolvimento."],
  },
  // 27/10/2026, fim da tarde
  {
    publicada: "2026-10-27T14:51",
    processo: "Relatórios Executivos",
    rota: RE,
    itens: [
      "O slide é montado na tela padrão (1920 × 1080) e, na apresentação e no PDF, se ajusta inteiro à tela de quem abre: os blocos ficam nos mesmos lugares em qualquer resolução.",
      "Transições, antes do Adicionar: Esmaecer, Rolar Vertical ou Rolar Horizontal, para os slides do grupo aberto.",
      "Na Imagem de Fundo, Aplicar Em Todo o Grupo põe a mesma imagem, com a posição e os ajustes, em todas as páginas do grupo.",
      "A Anotação e o Texto Livre crescem sozinhos quando o texto passa da altura da caixa.",
      "Cortar e Posicionar (ao adicionar uma imagem e no menu da edição): o tamanho do bloco — na proporção da imagem, numa fração do slide ou o atual —, a posição e o tamanho da imagem no quadro e os ajustes de brilho, matiz, saturação, desfoque e transparência.",
      "Nos modais das imagens, os valores das barras também se digitam, e o Restaurar Ajustes fica no rodapé.",
      "Ao criar um relatório a partir de outro, as imagens de fundo vêm sempre, mesmo sem manter as imagens e os textos.",
      "O Excluir Relatório fica na aba Configurações. Na lista do Cenário de Comparação, sem cenário escolhido, fica em destaque o marcado como Orçamento.",
    ],
  },
  {
    publicada: "2026-10-27T14:51",
    processo: "Fechamento Mensal",
    tela: "Linhas",
    rota: "/competencias/0000-00/linhas",
    itens: ["A etapa Linhas mostra a DRE das linhas no mês, na mesma estrutura da aba Linhas dos Resultados Empresariais."],
  },
  {
    publicada: "2026-10-27T14:51",
    processo: "Resultados Empresariais",
    tela: "Resultados",
    rota: RESULTADOS,
    itens: ["A aba Rateios por Obras saiu da tela; ela volta, como Rateios das Linhas, no processo Resultados por Obra."],
  },
  {
    publicada: "2026-10-27T14:51",
    processo: "Painéis de Bordo",
    soAdministrador: true,
    itens: ["Novo processo em Análises Gerenciais, em desenvolvimento."],
  },
  // 27/10/2026, tarde
  {
    publicada: "2026-10-27T12:35",
    processo: TODO_O_SIG,
    tela: "Sobre Esta Tela",
    itens: [
      "Os textos do Sobre e do Como Usar de cada tela trazem só o caminho e o uso atuais, com os nomes novos das telas do Fechamento Mensal.",
    ],
  },
  {
    publicada: "2026-10-27T12:35",
    processo: "Resultados Empresariais",
    tela: "Resultados",
    rota: RESULTADOS,
    itens: [
      "No Exportar, em Excel, a caixa Incluir a Aba Detalhes acrescenta no fim do arquivo os movimentos do balancete de cada aba exportada, item a item (a emissão, o cliente ou fornecedor e o histórico), com a parte que vai à aba, como no Exportar dos extratos.",
    ],
  },
  {
    publicada: "2026-10-27T12:35",
    processo: "Fechamento Mensal",
    tela: "Totais",
    rota: "/competencias/0000-00/indicadores",
    itens: [
      "A tela Totais junta os Indicadores e os Rateios do mês, cada um numa aba.",
    ],
  },
  {
    publicada: "2026-10-27T12:35",
    processo: "Fechamento Mensal",
    tela: "Prévias",
    rota: "/competencias/0000-00/receita-previa",
    itens: [
      "A tela Prévias (Prévias de Receita e Estoque) junta a Receita e o Estoque do mês, cada um numa aba.",
    ],
  },
  {
    publicada: "2026-10-27T12:35",
    processo: "Fechamento Mensal",
    tela: "Resultados",
    rota: DRE,
    itens: [
      "A tela DRE do mês passa a se chamar Resultados.",
    ],
  },
  {
    publicada: "2026-10-27T12:35",
    processo: "Controle de Usuários",
    tela: "Perfis",
    rota: "/perfis",
    itens: [
      "Na matriz do perfil, as telas Totais (abas Indicadores e Rateios) e Prévias (abas Receita e Estoque) do Fechamento Mensal, com as permissões que cada perfil já tinha; a DRE do mês aparece como Resultados.",
    ],
  },
  // 27/10/2026
  {
    publicada: "2026-10-27T08:38",
    processo: TODO_O_SIG,
    tela: "Menu Lateral",
    itens: [
      "A Central de Conectividade passa para cima da Controladoria.",
    ],
  },
  {
    publicada: "2026-10-27T08:38",
    processo: "Resultados Empresariais",
    tela: "Resultados",
    rota: RESULTADOS,
    itens: [
      "As abas Linhas e Rateios por Obras, antes de Obras: a DRE de cada linha de produto e de obra, da receita à Margem de Contribuição, e só os custos dela que não vieram dos centros de obra, com a lista das linhas por unidade.",
      "O Exportar traz a Linha Atual, Todas as Linhas e os Rateios por Obras de Todas as Linhas.",
    ],
  },
  {
    publicada: "2026-10-27T08:38",
    processo: "Fechamento Mensal",
    tela: "Linhas",
    rota: "/competencias/0000-00/linhas",
    itens: [
      "A etapa Linhas, depois da DRE: a apuração divide a DRE de cada unidade entre as linhas de produto e de obra e grava o resultado, que o fechamento trava.",
      "A conferência do mês antes de fechar: a Margem de Contribuição da DRE de cada unidade contra a soma das linhas, a margem de cada linha, de que passo veio cada valor, os documentos e os avisos.",
      "Nas competências fechadas antes da etapa, o botão Gravar grava as linhas uma vez; a competência apurada antes dela não fecha sem reapurar.",
    ],
  },
  {
    publicada: "2026-10-27T08:38",
    processo: "Fechamento Mensal",
    tela: "Importações",
    rota: "/competencias/0000-00/importar",
    itens: [
      "As Requisições e as Notas Fiscais voltaram (as abas Requisições (Lista) e Notas Fiscais (Lista) do LISTAS REALIZADO (RESULTADOS), também no Importar Arquivo): a tarefa delas leva os custos às linhas. Importá-las depois de apurar pede reapurar.",
      "As listas avisam os registros que citam uma linha inativa.",
    ],
  },
  {
    publicada: "2026-10-27T08:38",
    processo: "Cadastros da Controladoria",
    tela: "Alocação nas Linhas",
    rota: "/cadastros/alocacao-linhas",
    itens: [
      "A aba Alocação nas Linhas: as regras com que os custos sem tarefa chegam às linhas — cada centro de custo, ou o rateio dos centros sem regra própria, vai a uma linha ou se divide por uma base (volume produzido, projetos, kg da metalúrgica e da armadura, dias de acompanhamento ou receita).",
    ],
  },
  {
    publicada: "2026-10-27T08:38",
    processo: "Cadastros da Controladoria",
    tela: "Regras de Rateio",
    rota: "/cadastros/regras-rateio",
    itens: [
      "Nos rateios fixos, cada destino com percentual se divide entre as linhas da unidade dele, somando 100%: é como a parte do rateio chega às linhas na etapa Linhas.",
    ],
  },
  {
    publicada: "2026-10-27T08:38",
    processo: "Cenários Analíticos",
    rota: "/cenarios/analiticos",
    itens: [
      "As premissas trazem só as linhas ativas do cadastro (a Metalúrgica passa a ser linha de apoio, inativa).",
    ],
  },
  {
    publicada: "2026-10-27T08:38",
    processo: "Controle de Usuários",
    tela: "Perfis",
    rota: "/perfis",
    itens: [
      "Na matriz do perfil: a aba Alocação nas Linhas, a etapa Linhas do Fechamento Mensal (Editar grava as linhas dos meses fechados) e as abas Linhas e Rateios por Obras dos Resultados Empresariais.",
      "O grupo Central de Conectividade antes da Controladoria, como no menu.",
    ],
  },
  // 26/10/2026
  {
    publicada: "2026-10-26T15:47",
    processo: "Relatórios Executivos",
    tela: "Relatório Executivo",
    rota: RE,
    itens: ["O bloco movido uma só coluna ou linha, para um espaço vazio, passa a ficar no lugar novo: antes, não se salvava e voltava ao lugar ao escolher outro bloco."],
  },
  {
    publicada: "2026-10-26T09:56",
    processo: TODO_O_SIG,
    tela: "Novidades",
    itens: ["O modal Novidades, no menu do usuário: o resumo do que cada publicação trouxe às telas que você usa. O sino ao lado do nome avisa quando há novidades."],
  },
  {
    publicada: "2026-10-26T09:56",
    processo: TODO_O_SIG,
    tela: "Introdução ao SIG",
    itens: ["A Introdução ao SIG, no menu do usuário, ficou mais curta: vai direto ao layout e às partes das telas."],
  },
  {
    publicada: "2026-10-26T09:56",
    processo: "Biblioteca de APIs",
    rota: "/central-de-conectividade/biblioteca-de-apis",
    itens: [
      "A nova Central de Conectividade, com a Biblioteca de APIs: as DREs, os cards e os indicadores do Painel de Bordo dos Resultados Empresariais e dos Cenários para outros aplicativos (planilhas, o Power BI), em tabela ou em visual, com o login e a senha do SIG.",
      "Em abas: Como Conectar (os passos e os exemplos em curl e no Power Query), Resultados Empresariais e Cenários (as APIs, com Pré-visualizar) e Acesso às APIs (quem chama e de onde, com os bloqueios).",
      "As APIs ficam desligadas até o TI ligá-las no endereço com HTTPS; a biblioteca, a pré-visualização e os bloqueios já funcionam.",
    ],
  },
  {
    publicada: "2026-10-26T09:56",
    processo: "Controle de Usuários",
    tela: "Perfis",
    rota: "/perfis",
    itens: ["Na matriz do perfil, o grupo Central de Conectividade: a Biblioteca de APIs (Ler, para usar as APIs; Editar, para bloquear APIs, usuários e endereços)."],
  },
  {
    publicada: "2026-10-26T09:56",
    processo: "Controle de Usuários",
    tela: "Auditoria",
    rota: "/auditoria",
    itens: ["Os pedidos às APIs da Biblioteca entram com Incluir Acessos, como os acessos às telas."],
  },
  // 24/10/2026
  {
    publicada: "2026-10-24T14:59",
    processo: "Relatórios Executivos",
    tela: "Relatório Executivo",
    rota: RE,
    itens: [
      "A edição como no Canva: clique num bloco para escolhê-lo; os quadrados nos cantos e nos lados o redimensionam, e a borda destacada o move.",
      "Um só menu de edição, logo abaixo das abas, com as opções do bloco escolhido (as que não valem para ele ficam quase apagadas).",
      "As alterações se salvam sozinhas: no lugar do Gravar, o aviso Salvando…, Salvo às… ou Não Salvo, antes do Adicionar.",
      "Desfazer e Refazer no menu da edição (Ctrl+Z e Ctrl+Y).",
      "Copiar e colar os blocos (Ctrl+C, Ctrl+X e Ctrl+V, ou os botões do menu), também entre páginas, abas e relatórios.",
      "Colar textos e imagens de outros programas (o modal Colar no Slide) e links de vídeos do YouTube, do Instagram, do Facebook e do LinkedIn.",
      "Ao arrastar um bloco, os outros não piscam mais.",
    ],
  },
  {
    publicada: "2026-10-24T14:59",
    processo: "Controle de Usuários",
    tela: "Auditoria",
    rota: "/auditoria",
    itens: ["As gravações seguidas de um grupo dos Relatórios Executivos pela mesma pessoa ficam numa entrada só, a mais recente (com quantas foram e desde quando)."],
  },
  {
    publicada: "2026-10-24T11:40",
    processo: "Resultados Empresariais",
    tela: "Resultados",
    rota: RESULTADOS,
    itens: ["Nos modais do extrato das contas e do Balancete, o botão Exportar baixa o Excel com as Movimentações e os Detalhes, item a item."],
  },
  {
    publicada: "2026-10-24T11:40",
    processo: "Fechamento Mensal",
    tela: "DRE",
    rota: DRE,
    itens: ["Nos modais do extrato das contas e do Balancete, o botão Exportar baixa o Excel com as Movimentações e os Detalhes, item a item."],
  },
  {
    publicada: "2026-10-24T11:04",
    processo: "Resultados Empresariais",
    tela: "Resultados",
    rota: RESULTADOS,
    itens: ["Em Serviços, a linha Frete e Descarga nos Gastos Gerais Variáveis, com o frete dos complementares (o percentual sobre a Receita Líquida Complementar)."],
  },
  {
    publicada: "2026-10-24T11:04",
    processo: "Fechamento Mensal",
    tela: "DRE",
    rota: DRE,
    itens: ["Em Serviços, a linha Frete e Descarga nos Gastos Gerais Variáveis, com o frete dos complementares."],
  },
  {
    publicada: "2026-10-24T11:04",
    processo: "Cenários Sintéticos",
    rota: "/cenarios/sinteticos",
    itens: ["O Frete e Descarga dos complementares também nos cenários, na visão Serviços."],
  },
  {
    publicada: "2026-10-24T11:04",
    processo: "Cenários Analíticos",
    rota: "/cenarios/analiticos",
    itens: ["O Frete e Descarga dos complementares também nos cenários, nas premissas das linhas complementares."],
  },
  {
    publicada: "2026-10-24T09:39",
    processo: "Cadastros da Controladoria",
    tela: "Contas de Resultado",
    rota: "/cadastros/contas-resultado",
    itens: [
      "O Departamento da conta passou a ser editável.",
      "A gravação recusa a conta que nenhuma aba de Resultados lê e mostra as combinações permitidas, para escolher uma.",
      "Recarregar pela planilha também recusa essas contas, em vermelho na prévia.",
    ],
  },
  {
    publicada: "2026-10-24T09:39",
    processo: TODO_O_SIG,
    tela: "Topo da Tela",
    soAdministrador: true,
    itens: ["Para o Administrador, ao lado do nome, quantos usuários estão online (os nomes aparecem ao parar o mouse em cima)."],
  },
  // 23/10/2026
  {
    publicada: "2026-10-23T18:44",
    processo: TODO_O_SIG,
    tela: "Endereço e Banco de Dados",
    itens: ["O SIG passou para um novo banco de dados, no endereço http://192.168.0.16:3020; os dados e as telas continuam os mesmos."],
  },
  {
    publicada: "2026-10-23T18:44",
    processo: "Fechamento Mensal",
    tela: "DRE",
    rota: DRE,
    itens: ["O Apurar Competência ficou bem mais rápido (de cerca de 85 para 9 segundos)."],
  },
  {
    publicada: "2026-10-23T18:44",
    processo: "Controle de Usuários",
    tela: "Usuários",
    rota: "/usuarios",
    itens: ["Criar e alterar usuários com o perfil Administrador voltou a funcionar."],
  },
  {
    publicada: "2026-10-23T14:33",
    processo: "Resultados Empresariais",
    tela: "Painel de Bordo",
    rota: PAINEL,
    itens: [
      "Nos cards com gráfico, o acumulado na largura de um mês, num quadro cinza; a legenda ACUM. em negrito.",
      "Na aba Indicadores, as colunas do orçado com o nome da marcação (Previsão AGO/26, Previsão Acum.).",
    ],
  },
  {
    publicada: "2026-10-23T14:33",
    processo: "Resultados Empresariais",
    tela: "Resultados",
    rota: RESULTADOS,
    itens: ["A Comparação começa na primeira marcação que houver, na ordem Previsão, Orçamento, Anterior e Vendido."],
  },
  {
    publicada: "2026-10-23T14:33",
    processo: "Controle de Usuários",
    tela: "Auditoria",
    rota: "/auditoria",
    itens: ["Os Relatórios Executivos na Auditoria: a gravação, a finalização e a reabertura de cada grupo, com o mês."],
  },
  {
    publicada: "2026-10-23T14:33",
    processo: "Cadastros da Controladoria",
    tela: "Indicadores",
    rota: "/cadastros/estrutura-indicadores",
    itens: [
      "A Metodologia pode usar outros indicadores do cadastro e as metas, no mês ou no Acumulado no Ano.",
      "O Acumulado pode ter a própria fórmula (Fórmula do Acumulado); os indicadores de Cálculo do Sistema (GME 4, GME 8 e as Eficiências da Operação Totais) podem ser escritos pela Metodologia.",
    ],
  },
  {
    publicada: "2026-10-23T08:50",
    processo: "Relatórios Executivos",
    tela: "Relatório Executivo",
    rota: RE,
    itens: [
      "Sem o recorte de departamentos: quem lê a tela vê todas as abas, e quem a edita edita, finaliza e reabre todas.",
      "Finalizar (e Reabrir) vale para o grupo aberto, com todas as abas dele; o grupo finalizado ganha o check verde na barra do topo.",
      "Se outra pessoa gravou o mesmo grupo depois que você abriu o relatório, o aviso pergunta o que fazer: Recarregar ou Gravar por Cima.",
    ],
  },
  // 22/10/2026
  {
    publicada: "2026-10-22T19:48",
    processo: "Resultados Empresariais",
    tela: "Resultados",
    rota: RESULTADOS,
    itens: ["Na Comparação, os cenários marcados de qualquer exercício (o ano na opção; num de outro exercício, os mesmos meses dele)."],
  },
  {
    publicada: "2026-10-22T19:48",
    processo: "Resultados Empresariais",
    tela: "Painel de Bordo",
    rota: PAINEL,
    itens: ["Na Comparação, os cenários marcados de qualquer exercício."],
  },
  {
    publicada: "2026-10-22T19:48",
    processo: "Cenários Sintéticos",
    rota: "/cenarios/sinteticos",
    itens: ["As marcações com nomes curtos: Orçamento, Anterior, Vendido e Previsão."],
  },
  {
    publicada: "2026-10-22T19:48",
    processo: "Cenários Analíticos",
    rota: "/cenarios/analiticos",
    itens: ["As marcações com nomes curtos: Orçamento, Anterior, Vendido e Previsão."],
  },
  {
    publicada: "2026-10-22T19:48",
    processo: "Relatórios Executivos",
    tela: "Relatório Executivo",
    rota: RE,
    itens: [
      "A aba Configurações, antes da Capa, com o Cenário de Comparação dos cards e das tabelas (de início, o Orçamento; ou um dos cenários públicos).",
      "Nos cards e nas tabelas, o comparado com o nome do cenário escolhido.",
    ],
  },
  {
    publicada: "2026-10-22T16:37",
    processo: "Relatórios Executivos",
    tela: "Relatório Executivo",
    rota: RE,
    itens: ["Exportar em PDF: toda a apresentação, o grupo ou a aba atual.", "O bloco Tabela: os Resultados de uma aba, com o modo, os meses e as linhas."],
  },
  {
    publicada: "2026-10-22T16:37",
    processo: "Resultados Empresariais",
    tela: "Resultados",
    rota: RESULTADOS,
    itens: ["No Exportar, a opção Imagem: a tabela do jeito que está na tela, em PNG."],
  },
  {
    publicada: "2026-10-22T16:37",
    processo: "Cenários Sintéticos",
    rota: "/cenarios/sinteticos",
    itens: ["Nos Resultados do cenário, a opção Imagem no Exportar: a tabela do jeito que está na tela, em PNG."],
  },
  {
    publicada: "2026-10-22T16:37",
    processo: "Cenários Analíticos",
    rota: "/cenarios/analiticos",
    itens: ["Nos Resultados do cenário, a opção Imagem no Exportar: a tabela do jeito que está na tela, em PNG."],
  },
  {
    publicada: "2026-10-22T13:54",
    processo: "Resultados Empresariais",
    tela: "Painel de Bordo",
    rota: PAINEL,
    itens: ["Com a meta zero, o destaque com a cor de melhor ou pior.", "Os indicadores em reais com as unidades R$ em Milhões (M) e R$ em Milhares (K)."],
  },
  {
    publicada: "2026-10-22T13:54",
    processo: "Relatórios Executivos",
    tela: "Relatório Executivo",
    rota: RE,
    itens: [
      "Os cards de Indicadores no formato dos cards do Painel de Bordo, com o gráfico (os meses e o acumulado, só o acumulado ou nenhum), os Rótulos e o Tipo.",
      "Os blocos ficam onde se põem, em todas as páginas, sem se sobrepor; o bloco empurrado volta ao lugar quando o arrastado sai de cima dele.",
      "Na tela inteira, o rodapé com a legenda dos cards e o contador dos slides.",
    ],
  },
  {
    publicada: "2026-10-22T10:39",
    processo: "Relatórios Executivos",
    tela: "Relatório Executivo",
    rota: RE,
    itens: [
      "O slide tem a largura da tela inteira e se reduz na edição: a edição sai igual à apresentação.",
      "As fontes Roboto, Open Sans, Montserrat, Lato e Poppins, os tamanhos até 144 e as imagens PNG transparentes.",
      "Nas imagens, a borda, o sombreamento e o Trocar Imagem.",
    ],
  },
  {
    publicada: "2026-10-22T10:39",
    processo: "Fechamento Mensal",
    tela: "DRE",
    rota: DRE,
    itens: ["Sem o primeiro total da ROL, que passou a linha de resultado; os totais num tom mais forte.", "As exportações em Excel e PDF com os fundos amarelos da tela."],
  },
  {
    publicada: "2026-10-22T10:39",
    processo: "Fechamento Mensal",
    tela: "Conferência",
    rota: "/competencias/0000-00/conferencia-planilha",
    itens: ["A exportação sem o primeiro total da ROL e com os fundos amarelos da tela."],
  },
  {
    publicada: "2026-10-22T10:39",
    processo: "Resultados Empresariais",
    tela: "Resultados",
    rota: RESULTADOS,
    itens: ["As exportações em Excel e PDF sem o primeiro total da ROL e com os fundos amarelos da tela."],
  },
  {
    publicada: "2026-10-22T09:08",
    processo: "Fechamento Mensal",
    tela: "DRE",
    rota: DRE,
    itens: ["Ao fechar a competência, o aviso da Receita sem valor só aparece quando não há nem a receita calculada nem ajuste manual."],
  },
  {
    publicada: "2026-10-22T08:50",
    processo: "Fechamento Mensal",
    tela: "Importações",
    rota: "/competencias/0000-00/importar",
    itens: ["O Balancete com mais de uma tabela dinâmica na aba: o total do mês é a soma dos Total Geral (o mesmo mês em duas tabelas é recusado)."],
  },
];

/** A publicação mais recente: ao abrir as Novidades, tudo até ela fica visto. */
export const ULTIMA_PUBLICACAO = NOVIDADES.reduce((m, n) => (n.publicada > m ? n.publicada : m), "");

/** As novidades das telas que o usuário alcança (as do Administrador, só para ele). */
export function novidadesDoUsuario(pode: (permissao: string) => boolean, administrador: boolean) {
  return NOVIDADES.filter((n) => {
    if (n.soAdministrador && !administrador) return false;
    const permissao = n.rota ? permissaoDaTela(n.rota) : null;
    return !permissao || pode(permissao);
  });
}

/** A ordem dos processos no modal: Todo o SIG e, depois, a do menu lateral. */
export function ordemDoProcesso(processo: string) {
  if (processo === TODO_O_SIG) return -1;
  const i = navGrupos.flatMap((g) => g.itens).findIndex((x) => x.title === processo);
  return i < 0 ? 999 : i;
}

/** O ícone do processo no menu lateral. */
export const iconeDoProcesso = (processo: string) => navGrupos.flatMap((g) => g.itens).find((x) => x.title === processo)?.icon;

/** Até quando o usuário viu as novidades (a publicada da última vista), guardado no navegador; nunca, null. */
const CHAVE = (usuarioId: string) => `sig-bpm:novidades-vistas:${usuarioId}`;
const EVENTO = "sig-bpm:novidades-vistas";

export function vistasAte(usuarioId: string): string | null {
  try {
    return localStorage.getItem(CHAVE(usuarioId));
  } catch {
    return null;
  }
}

export function marcarVistas(usuarioId: string) {
  try {
    localStorage.setItem(CHAVE(usuarioId), ULTIMA_PUBLICACAO);
  } catch {
    // Sem o armazenamento do navegador, o sino volta na próxima vez.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Avisa quando as vistas mudam (nesta ou em outra aba do navegador), para o useSyncExternalStore. */
export function assinarVistas(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}
