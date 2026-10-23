-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RecursoSistema" AS ENUM ('CENARIOS_SINTETICOS', 'CENARIOS_ANALITICOS', 'RESULTADOS_REALIZADOS', 'FECHAMENTO_MENSAL', 'CADASTROS_APURACAO', 'CADASTROS_CONTROLADORIA', 'CONTROLE_USUARIOS', 'ANALISES_GERENCIAIS');

-- CreateEnum
CREATE TYPE "AcaoPermissao" AS ENUM ('LER', 'EDITAR');

-- CreateEnum
CREATE TYPE "DepartamentoAcesso" AS ENUM ('PRODUCAO', 'SERVICOS', 'LOGISTICA', 'TECNICO', 'COMERCIAL', 'ADMINISTRATIVO', 'EXTRA_OPERACIONAL');

-- CreateEnum
CREATE TYPE "TipoConta" AS ENUM ('SINTETICA', 'ANALITICA');

-- CreateEnum
CREATE TYPE "TipoLinhaDRE" AS ENUM ('SECAO', 'ITEM', 'SUBTOTAL', 'TOTAL');

-- CreateEnum
CREATE TYPE "AtribuicaoCusto" AS ENUM ('DIRETA', 'INDIRETA');

-- CreateEnum
CREATE TYPE "BaldeAlocacao" AS ENUM ('PROJETO', 'PRODUCAO', 'METALURGIA', 'ARMADURA', 'ACOMPANHAMENTO', 'UNIDADE', 'MATRIZ', 'FILIAL', 'OBRAS', 'COMPLEMENTAR', 'DESPESAS', 'EXTRA', 'RN', 'LEBEN');

-- CreateEnum
CREATE TYPE "DestinoRateio" AS ENUM ('MATRIZ', 'FILIAL', 'MONTAGEM', 'COMPLEMENTAR');

-- CreateEnum
CREATE TYPE "BaseFisica" AS ENUM ('M3', 'KG', 'PISTA', 'DIA');

-- CreateEnum
CREATE TYPE "TipoLinha" AS ENUM ('PRODUTO', 'OBRA', 'FATURAMENTO');

-- CreateEnum
CREATE TYPE "StatusCompetencia" AS ENUM ('ABERTA', 'EM_CONFERENCIA', 'FECHADA');

-- CreateEnum
CREATE TYPE "TipoImportacao" AS ENUM ('BALANCETE', 'DRE_COMERCIAL', 'ESTOQUE_INICIAL', 'PROJETO', 'PRODUCAO', 'PRODUCAO_PISTA', 'PRODUCAO_ARMADURA', 'PRODUCAO_METALURGIA', 'EXPEDICAO', 'MONTAGEM', 'ACOMPANHAMENTO', 'MEDICAO', 'DEVOLUCAO', 'SAIDA', 'INDICADORES_ADMIN', 'INDICADORES_COMERCIAL', 'METAS_ORCAMENTO', 'REQUISICOES', 'NOTAS_FISCAIS', 'QUADRO_LOTACAO');

-- CreateEnum
CREATE TYPE "StatusImportacao" AS ENUM ('PROCESSANDO', 'CONCLUIDA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "TipoDivergencia" AS ENUM ('BALANCETE', 'PRECO_CONTRATO');

-- CreateEnum
CREATE TYPE "StatusDivergencia" AS ENUM ('ABERTA', 'JUSTIFICADA', 'RESOLVIDA_POR_REABERTURA', 'RESOLVIDA_POR_REAPURACAO');

-- CreateEnum
CREATE TYPE "TipoVenda" AS ENUM ('GLOBAL', 'MERCANTIL');

-- CreateEnum
CREATE TYPE "SituacaoCadastroObra" AS ENUM ('OK', 'SEM_CONTRATO', 'GENERICA', 'INCONSISTENTE');

-- CreateEnum
CREATE TYPE "TipoAlocacao" AS ENUM ('DIRETO', 'RATEIO');

-- CreateEnum
CREATE TYPE "ValidacaoLancamento" AS ENUM ('OK', 'ERRO_PARAMETRIZACAO', 'ERRO_DEPARTAMENTO', 'ERRO_ATRIBUICAO', 'SEM_DESTINO', 'CENTRO_NAO_CADASTRADO', 'SEM_ABA');

-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('M3', 'M2', 'M', 'KG', 'PISTA', 'DIA', 'UND');

-- CreateEnum
CREATE TYPE "NaturezaReceita" AS ENUM ('PRE_FABRICADO', 'FRETE', 'MONTAGEM', 'COMPLEMENTAR', 'DEVOLUCOES_INVENTARIOS');

-- CreateEnum
CREATE TYPE "OrigemReceita" AS ENUM ('PRODUCAO', 'EXPEDICAO', 'SAIDA', 'DEVOLUCAO', 'MEDICAO', 'LANCAMENTO');

-- CreateEnum
CREATE TYPE "CriterioReceita" AS ENUM ('CONTRATO', 'SEM_CONTRATO', 'GENERICA', 'LINHA_INCONSISTENTE', 'TABELA_ESTACA', 'NOTA_FISCAL', 'MEDICAO', 'LANCAMENTO');

-- CreateEnum
CREATE TYPE "ComponenteReceita" AS ENUM ('BRUTA', 'LIQUIDA', 'VARIACAO_ESTOQUE');

-- CreateEnum
CREATE TYPE "MarcacaoCenario" AS ENUM ('ORCAMENTO_EMPRESARIAL', 'RESULTADOS_ANTERIORES', 'RESULTADOS_VENDIDOS', 'PREVISAO');

-- CreateEnum
CREATE TYPE "VisualizacaoCenario" AS ENUM ('PARTICULAR', 'PUBLICA');

-- CreateEnum
CREATE TYPE "SituacaoRelatorio" AS ENUM ('EM_ELABORACAO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "AbaRelatorioExecutivo" AS ENUM ('CAPA', 'FATOS', 'RESULTADOS', 'COMERCIAL', 'PRODUCAO', 'SERVICOS', 'ADMINISTRATIVO', 'ENCERRAMENTO');

-- CreateTable
CREATE TABLE "perfis" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "recorte_setor" BOOLEAN NOT NULL DEFAULT false,
    "recorte_departamento" BOOLEAN NOT NULL DEFAULT false,
    "recorte_centro" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_permissoes" (
    "perfil_id" TEXT NOT NULL,
    "recurso" "RecursoSistema" NOT NULL,
    "acao" "AcaoPermissao" NOT NULL,

    CONSTRAINT "perfil_permissoes_pkey" PRIMARY KEY ("perfil_id","recurso","acao")
);

-- CreateTable
CREATE TABLE "perfil_permissoes_telas" (
    "perfil_id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "acao" "AcaoPermissao" NOT NULL,

    CONSTRAINT "perfil_permissoes_telas_pkey" PRIMARY KEY ("perfil_id","chave","acao")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "gestao" "DepartamentoAcesso",
    "ve_obras" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_centros" (
    "usuario_id" TEXT NOT NULL,
    "centro_custo_id" TEXT NOT NULL,

    CONSTRAINT "usuario_centros_pkey" PRIMARY KEY ("usuario_id","centro_custo_id")
);

-- CreateTable
CREATE TABLE "usuario_departamentos" (
    "usuario_id" TEXT NOT NULL,
    "departamento" "DepartamentoAcesso" NOT NULL,

    CONSTRAINT "usuario_departamentos_pkey" PRIMARY KEY ("usuario_id","departamento")
);

-- CreateTable
CREATE TABLE "usuario_setores" (
    "usuario_id" TEXT NOT NULL,
    "tipo_lista" "TipoImportacao" NOT NULL,

    CONSTRAINT "usuario_setores_pkey" PRIMARY KEY ("usuario_id","tipo_lista")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidade_id" TEXT,
    "usuario_id" TEXT,
    "usuario_nome" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "dados_antes" JSONB,
    "dados_depois" JSONB,
    "metadados" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linhas" (
    "id" TEXT NOT NULL,
    "tipo" "TipoLinha" NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade_negocio_id" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "unidade_medida" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_negocio" (
    "id" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centros_custo" (
    "id" TEXT NOT NULL,
    "coligada" INTEGER,
    "codigo_rm" TEXT,
    "nome_rm" TEXT NOT NULL,
    "nome_controladoria" TEXT,
    "departamento" TEXT,
    "departamento_sigla" TEXT,
    "atribuicao" "AtribuicaoCusto",
    "atribuicao_sigla" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "balde" "BaldeAlocacao",
    "unidade_negocio_id" TEXT,

    CONSTRAINT "centros_custo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_resultado" (
    "id" TEXT NOT NULL,
    "reduzido" TEXT NOT NULL,
    "conta" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo_conta" "TipoConta" NOT NULL,
    "departamento" TEXT,
    "atribuicao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "balde" "BaldeAlocacao",
    "linha_dre_id" TEXT,

    CONSTRAINT "contas_resultado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linhas_dre" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "grupo" TEXT NOT NULL,
    "grupo_sigla" TEXT NOT NULL,
    "atribuicao" TEXT,
    "atribuicao_sigla" TEXT,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoLinhaDRE" NOT NULL,
    "expressao" TEXT,
    "definicao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linhas_dre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linhas_dre_unidades" (
    "linha_dre_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT NOT NULL,

    CONSTRAINT "linhas_dre_unidades_pkey" PRIMARY KEY ("linha_dre_id","unidade_negocio_id")
);

-- CreateTable
CREATE TABLE "regras_rateio" (
    "id" TEXT NOT NULL,
    "chave" "BaldeAlocacao" NOT NULL,
    "destino" "DestinoRateio" NOT NULL,
    "unidade_destino_id" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "base_fisica" "BaseFisica" NOT NULL,
    "origem_do_volume" TEXT NOT NULL,
    "vigencia_inicio" TIMESTAMP(3) NOT NULL,
    "vigencia_fim" TIMESTAMP(3),
    "percentual_fixo" DECIMAL(65,30),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_rateio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_movimento" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "retorna_estoque" BOOLEAN NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_movimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tabela_estacas" (
    "id" TEXT NOT NULL,
    "secao" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "peca" TEXT NOT NULL,
    "preco_unitario" DECIMAL(65,30) NOT NULL,
    "preco_liquido" DECIMAL(65,30) NOT NULL,
    "vigencia_inicio" TIMESTAMP(3) NOT NULL,
    "vigencia_fim" TIMESTAMP(3),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabela_estacas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencias" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "status" "StatusCompetencia" NOT NULL DEFAULT 'ABERTA',
    "aberta_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aberta_por" TEXT NOT NULL,
    "apurada_em" TIMESTAMP(3),
    "apurada_por" TEXT,
    "apuracoes" INTEGER NOT NULL DEFAULT 0,
    "fechada_em" TIMESTAMP(3),
    "fechada_por" TEXT,
    "entradas_apuradas" JSONB,
    "cadastros_assinatura" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reaberturas_competencia" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "justificativa" TEXT NOT NULL,
    "reaberta_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reaberta_por" TEXT NOT NULL,
    "fechamento_anterior_em" TIMESTAMP(3),
    "fechamento_anterior_por" TEXT,

    CONSTRAINT "reaberturas_competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacoes" (
    "id" TEXT NOT NULL,
    "comparacao" BOOLEAN NOT NULL DEFAULT false,
    "enviada_de" TEXT,
    "competencia_id" TEXT NOT NULL,
    "tipo" "TipoImportacao" NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "hash_arquivo" TEXT NOT NULL,
    "importado_por" TEXT NOT NULL,
    "importado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linhas_lidas" INTEGER NOT NULL DEFAULT 0,
    "linhas_aceitas" INTEGER NOT NULL DEFAULT 0,
    "linhas_rejeitadas" INTEGER NOT NULL DEFAULT 0,
    "linhas_ignoradas" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusImportacao" NOT NULL DEFAULT 'PROCESSANDO',
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "motivo_rejeicao" TEXT,
    "relatorio_erros" JSONB,
    "resumo" JSONB,
    "substituida_em" TIMESTAMP(3),

    CONSTRAINT "importacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "divergencias" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "tipo" "TipoDivergencia" NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "conta_resultado_id" TEXT,
    "centro_custo_id" TEXT,
    "filial" INTEGER,
    "codigo_centro_custo" TEXT,
    "codigo_conta" TEXT,
    "preco_contrato_id" TEXT,
    "descricao" TEXT,
    "impacto" DECIMAL(65,30),
    "obra_id" TEXT,
    "valor_gravado" DECIMAL(65,30) NOT NULL,
    "valor_recebido" DECIMAL(65,30) NOT NULL,
    "diferenca" DECIMAL(65,30) NOT NULL,
    "detectada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusDivergencia" NOT NULL DEFAULT 'ABERTA',
    "justificativa" TEXT,
    "tratada_em" TIMESTAMP(3),
    "tratada_por" TEXT,

    CONSTRAINT "divergencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obras" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade_negocio_id" TEXT,
    "linha_id" TEXT,
    "tipo_venda" "TipoVenda",
    "generica" BOOLEAN NOT NULL DEFAULT false,
    "situacao_cadastro" "SituacaoCadastroObra" NOT NULL DEFAULT 'OK',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precos_contrato" (
    "id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "etapa" TEXT,
    "linha_texto" TEXT NOT NULL,
    "linha_id" TEXT,
    "conta_resultado" TEXT NOT NULL,
    "departamento" TEXT,
    "atribuicao" TEXT,
    "unidade" TEXT,
    "fornecimento" TEXT,
    "valor_unitario" DECIMAL(65,30),
    "valor_total" DECIMAL(65,30),
    "percentual_rl" DECIMAL(65,30),
    "importacao_id" TEXT,
    "vigente_desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "substituido_em" TIMESTAMP(3),

    CONSTRAINT "precos_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_contabeis" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "filial" INTEGER NOT NULL,
    "centro_custo_id" TEXT,
    "conta_resultado_id" TEXT NOT NULL,
    "valor_movimento" DECIMAL(65,30) NOT NULL,
    "codigo_centro_custo" TEXT,
    "nome_centro_custo" TEXT,
    "linha_arquivo" INTEGER NOT NULL,
    "cli_forn" TEXT,
    "emissao" TIMESTAMP(3),
    "historico" TEXT,
    "conta_adotada_id" TEXT,
    "classificado_em" TIMESTAMP(3),
    "departamento" TEXT,
    "atribuicao" TEXT,
    "linha_dre_id" TEXT,
    "balde" "BaldeAlocacao",
    "alocacao" "TipoAlocacao",
    "etiqueta" TEXT,
    "validacao" "ValidacaoLancamento" NOT NULL DEFAULT 'OK',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamentos_contabeis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_manuais" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "filial" INTEGER NOT NULL,
    "centro_custo_id" TEXT,
    "conta_resultado_id" TEXT,
    "descricao" TEXT NOT NULL,
    "balde" "BaldeAlocacao",
    "linha_dre_id" TEXT,
    "valor" DECIMAL(65,30) NOT NULL,
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamentos_manuais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estoque_saldos" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "linha_id" TEXT,
    "linha_texto" TEXT NOT NULL,
    "movimento_volume" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "movimento_valor" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "preco_movimento" DECIMAL(65,30),
    "criterio" "CriterioReceita",
    "saldo_volume" DECIMAL(65,30) NOT NULL,
    "saldo_valor" DECIMAL(65,30) NOT NULL,
    "preco_medio" DECIMAL(65,30) NOT NULL,
    "apurado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "congelado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "estoque_saldos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estoque_saldos_iniciais" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "linha_id" TEXT,
    "linha_texto" TEXT NOT NULL,
    "saldo_volume" DECIMAL(65,30) NOT NULL,
    "saldo_valor" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "estoque_saldos_iniciais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicadores_importados" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "linha_arquivo" INTEGER NOT NULL,

    CONSTRAINT "indicadores_importados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicadores_estrutura" (
    "id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "grupo" TEXT NOT NULL,
    "numero" TEXT NOT NULL DEFAULT '',
    "nome" TEXT NOT NULL,
    "sentido" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "descricao" TEXT,
    "formula" TEXT,
    "modo" TEXT NOT NULL,
    "peso" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicadores_estrutura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metas_importadas" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "linha_arquivo" INTEGER NOT NULL,

    CONSTRAINT "metas_importadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicadores_digitados" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "digitado_por" TEXT NOT NULL,
    "digitado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicadores_digitados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projetos" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL(65,30) NOT NULL,
    "data" TIMESTAMP(3),
    "nome_peca" TEXT,
    "codigo_peca" TEXT,
    "produto" TEXT,
    "grupo" TEXT,
    "secao" TEXT,
    "comprimento" DECIMAL(65,30),
    "peso_kg" DECIMAL(65,30),
    "linha_arquivo" INTEGER,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producoes" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "grupo" TEXT,
    "secao" TEXT,
    "comprimento" DECIMAL(65,30),
    "quantidade_pecas" INTEGER,
    "quantidade" DECIMAL(65,30) NOT NULL,
    "data" TIMESTAMP(3),
    "codigo_controle" TEXT,
    "produto" TEXT,
    "nome_peca" TEXT,
    "linha_arquivo" INTEGER,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producoes_pista" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL(65,30) NOT NULL,
    "data" TIMESTAMP(3),
    "linha_arquivo" INTEGER,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'PISTA',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producoes_pista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producoes_armadura" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL(65,30) NOT NULL,
    "categoria" TEXT,
    "linha_arquivo" INTEGER,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'KG',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producoes_armadura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producoes_metalurgia" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "finalidade" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL(65,30) NOT NULL,
    "linha_arquivo" INTEGER,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'KG',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producoes_metalurgia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expedicoes" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "valor_frete" DECIMAL(65,30),
    "quantidade" DECIMAL(65,30) NOT NULL,
    "data" TIMESTAMP(3),
    "numero_carga" TEXT,
    "nome_peca" TEXT,
    "codigo_controle" TEXT,
    "peso_kg" DECIMAL(65,30),
    "volume_informado" DECIMAL(65,30),
    "linha_arquivo" INTEGER,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expedicoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "montagens" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL(65,30) NOT NULL,
    "data" TIMESTAMP(3),
    "grupo" TEXT,
    "secao" TEXT,
    "quantidade_pecas" DECIMAL(65,30),
    "linha_arquivo" INTEGER,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "montagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acompanhamentos" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL(65,30) NOT NULL,
    "etapa" TEXT,
    "observacao" TEXT,
    "linha_arquivo" INTEGER,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'DIA',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acompanhamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicoes" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "valor_medido" DECIMAL(65,30),
    "quantidade" DECIMAL(65,30) NOT NULL,
    "tipo_lancamento" TEXT,
    "cliente" TEXT,
    "tipo_faturamento" TEXT,
    "valor_faturamento" DECIMAL(65,30),
    "execucao_anterior" DECIMAL(65,30),
    "execucao_atual" DECIMAL(65,30),
    "linha_arquivo" INTEGER,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucoes" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "tipo_movimento_id" TEXT,
    "valor" DECIMAL(65,30),
    "quantidade" DECIMAL(65,30) NOT NULL,
    "data" TIMESTAMP(3),
    "nota_fiscal" TEXT,
    "filial" INTEGER,
    "codigo_produto" TEXT,
    "descricao" TEXT,
    "movimento" TEXT,
    "nome_movimento" TEXT,
    "creditos" DECIMAL(65,30),
    "linha_arquivo" INTEGER,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devolucoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saidas" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "tipo_movimento_id" TEXT,
    "valor" DECIMAL(65,30),
    "quantidade" DECIMAL(65,30) NOT NULL,
    "data" TIMESTAMP(3),
    "nota_fiscal" TEXT,
    "filial" INTEGER,
    "codigo_produto" TEXT,
    "descricao" TEXT,
    "movimento" TEXT,
    "nome_movimento" TEXT,
    "creditos" DECIMAL(65,30),
    "linha_arquivo" INTEGER,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receitas_previas" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT NOT NULL,
    "natureza" "NaturezaReceita" NOT NULL,
    "receita_bruta" DECIMAL(65,30) NOT NULL,
    "impostos" DECIMAL(65,30) NOT NULL,
    "receita_liquida" DECIMAL(65,30) NOT NULL,
    "variacao_estoque" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "apurado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "congelado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "receitas_previas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receitas_previas_precos" (
    "receita_previa_id" TEXT NOT NULL,
    "preco_contrato_id" TEXT NOT NULL,

    CONSTRAINT "receitas_previas_precos_pkey" PRIMARY KEY ("receita_previa_id","preco_contrato_id")
);

-- CreateTable
CREATE TABLE "volumes_operacionais" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "regra_rateio_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT NOT NULL,
    "quantidade" DECIMAL(65,30) NOT NULL,
    "percentual" DECIMAL(65,30) NOT NULL,
    "apurado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "congelado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "volumes_operacionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_apurados" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT,
    "centro_custo_id" TEXT,
    "linha_dre_id" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "percentual_rol" DECIMAL(65,30),
    "composicao" JSONB,
    "apurado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apurado_por" TEXT,
    "congelado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "resultados_apurados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclassificacoes_conta" (
    "id" TEXT NOT NULL,
    "codigo_centro_custo" TEXT NOT NULL,
    "conta_origem_id" TEXT NOT NULL,
    "conta_destino_id" TEXT NOT NULL,
    "motivo" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reclassificacoes_conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receitas_previas_itens" (
    "id" TEXT NOT NULL,
    "receita_previa_id" TEXT NOT NULL,
    "origem" "OrigemReceita" NOT NULL,
    "registro_id" TEXT,
    "obra_codigo" TEXT,
    "linha" TEXT,
    "quantidade" DECIMAL(65,30),
    "criterio" "CriterioReceita" NOT NULL,
    "preco_bruto" DECIMAL(65,30),
    "preco_liquido" DECIMAL(65,30),
    "preco_bruto_id" TEXT,
    "preco_liquido_id" TEXT,
    "receita_bruta" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "receita_liquida" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "variacao_estoque" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "venda" "TipoVenda",
    "detalhe" TEXT,
    "detalhe_descricao" TEXT,

    CONSTRAINT "receitas_previas_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_receita" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT NOT NULL,
    "natureza" "NaturezaReceita" NOT NULL,
    "componente" "ComponenteReceita" NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "observacao" TEXT NOT NULL,
    "venda" "TipoVenda",
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamentos_receita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conferencias_planilha" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "hash_arquivo" TEXT NOT NULL,
    "enviado_por" TEXT NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valores" JSONB NOT NULL,

    CONSTRAINT "conferencias_planilha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cenarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'SINTETICO',
    "descricao" TEXT,
    "marcacao" "MarcacaoCenario",
    "nome_arquivo" TEXT,
    "importado_em" TIMESTAMP(3),
    "criado_por" TEXT,
    "criado_por_id" TEXT,
    "visualizacao" "VisualizacaoCenario" NOT NULL DEFAULT 'PUBLICA',
    "comparado_com_id" TEXT,
    "variacoes_maximas" JSONB,
    "indices_reajuste" JSONB,
    "indices_do_comparativo" JSONB,
    "realocacoes" JSONB,
    "rateios_assinatura" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "familia_id" TEXT,
    "revisao_de_id" TEXT,
    "versao_salva_em" TIMESTAMP(3),
    "versao_salva_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cenarios_resultados" (
    "cenario_id" TEXT NOT NULL,
    "visao" INTEGER NOT NULL,
    "linha_dre_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "cenarios_resultados_pkey" PRIMARY KEY ("cenario_id","visao","linha_dre_id","mes")
);

-- CreateTable
CREATE TABLE "cenarios_indicadores" (
    "cenario_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'IMPORTADO',

    CONSTRAINT "cenarios_indicadores_pkey" PRIMARY KEY ("cenario_id","nome","mes")
);

-- CreateTable
CREATE TABLE "cenarios_justificativas" (
    "cenario_id" TEXT NOT NULL,
    "visao" INTEGER NOT NULL,
    "linha_dre_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "usuario_nome" TEXT NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cenarios_justificativas_pkey" PRIMARY KEY ("cenario_id","visao","linha_dre_id")
);

-- CreateTable
CREATE TABLE "cenarios_premissas_justificativas" (
    "cenario_id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "usuario_nome" TEXT NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cenarios_premissas_justificativas_pkey" PRIMARY KEY ("cenario_id","chave")
);

-- CreateTable
CREATE TABLE "cenarios_premissas" (
    "cenario_id" TEXT NOT NULL,
    "unidade" INTEGER NOT NULL,
    "venda" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "cenarios_premissas_pkey" PRIMARY KEY ("cenario_id","unidade","venda","chave","mes")
);

-- CreateTable
CREATE TABLE "cenarios_centros" (
    "cenario_id" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "linha_dre_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "cenarios_centros_pkey" PRIMARY KEY ("cenario_id","grupo","linha_dre_id","mes")
);

-- CreateTable
CREATE TABLE "cenarios_investimentos" (
    "id" TEXT NOT NULL,
    "cenario_id" TEXT NOT NULL,
    "unidade" INTEGER NOT NULL,
    "conta" TEXT NOT NULL,
    "nome_referencia" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL,
    "condicao_pagamento" TEXT,
    "inicio" INTEGER NOT NULL,
    "valor_total" DECIMAL(65,30) NOT NULL,
    "valor_pos_uso" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vida_util" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cenarios_investimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correspondencias_tarefas" (
    "id" TEXT NOT NULL,
    "filial" INTEGER,
    "tarefa" TEXT NOT NULL,
    "linha_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correspondencias_tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cenarios_reajustes" (
    "id" TEXT NOT NULL,
    "cenario_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" TEXT,
    "usuario_nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "modo" TEXT,
    "reajuste" DECIMAL(65,30),
    "visao" INTEGER,
    "replicado" BOOLEAN NOT NULL DEFAULT false,
    "contas" JSONB,
    "meses" JSONB,
    "valores" INTEGER NOT NULL DEFAULT 0,
    "soma_antes" DECIMAL(65,30),
    "soma_depois" DECIMAL(65,30),
    "descricao" TEXT,

    CONSTRAINT "cenarios_reajustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisicoes_itens" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "identificador" TEXT,
    "tipo_movimento" TEXT,
    "nome_tipo_movimento" TEXT,
    "data_baixa" TIMESTAMP(3),
    "filial" INTEGER,
    "codigo_centro_custo" TEXT,
    "nome_centro_custo" TEXT,
    "projeto" TEXT,
    "tarefa" TEXT,
    "nome_tarefa" TEXT,
    "natureza_orcamentaria" TEXT,
    "conta_contabil" TEXT NOT NULL,
    "descricao_conta" TEXT,
    "codigo_produto" TEXT,
    "descricao_item" TEXT,
    "quantidade" DECIMAL(65,30),
    "conta_estoque" TEXT,
    "valor_unitario" DECIMAL(65,30),
    "valor_total" DECIMAL(65,30) NOT NULL,
    "linha_arquivo" INTEGER NOT NULL,

    CONSTRAINT "requisicoes_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotacoes_centros" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "centro_custo" TEXT NOT NULL,
    "unidade" TEXT,
    "departamento" TEXT,
    "atribuicao" TEXT,
    "clt" INTEGER NOT NULL,
    "pj" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "linha_arquivo" INTEGER NOT NULL,

    CONSTRAINT "lotacoes_centros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_fiscais_itens" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "identificador" TEXT,
    "data_emissao" TIMESTAMP(3),
    "data_saida" TIMESTAMP(3),
    "numero" TEXT,
    "filial" INTEGER,
    "codigo_centro_custo" TEXT,
    "nome_centro_custo" TEXT,
    "projeto" TEXT,
    "tarefa" TEXT,
    "nome_tarefa" TEXT,
    "codigo_fornecedor" TEXT,
    "fornecedor" TEXT,
    "codigo_produto" TEXT,
    "descricao_item" TEXT,
    "quantidade" DECIMAL(65,30),
    "subtotal" DECIMAL(65,30),
    "desconto" DECIMAL(65,30),
    "valor_total" DECIMAL(65,30) NOT NULL,
    "cfop" TEXT,
    "tipo_movimento" TEXT,
    "nome_tipo_movimento" TEXT,
    "natureza_orcamentaria" TEXT,
    "conta_contabil" TEXT NOT NULL,
    "linha_arquivo" INTEGER NOT NULL,

    CONSTRAINT "notas_fiscais_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios_executivos" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "criado_por_id" TEXT NOT NULL,
    "criado_por_nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "cenario_comparado_id" TEXT,

    CONSTRAINT "relatorios_executivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios_executivos_abas" (
    "relatorio_id" TEXT NOT NULL,
    "departamento" "AbaRelatorioExecutivo" NOT NULL,
    "blocos" JSONB NOT NULL,
    "situacao" "SituacaoRelatorio" NOT NULL DEFAULT 'EM_ELABORACAO',
    "atualizado_por" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "finalizado_por" TEXT,
    "finalizado_em" TIMESTAMP(3),

    CONSTRAINT "relatorios_executivos_abas_pkey" PRIMARY KEY ("relatorio_id","departamento")
);

-- CreateTable
CREATE TABLE "painel_itens" (
    "id" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "quadro" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "sentido" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "formato_acumulado" TEXT,
    "percentual" TEXT,
    "casas_percentual" INTEGER NOT NULL DEFAULT 1,
    "separar" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "painel_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfis_codigo_key" ON "perfis"("codigo");

-- CreateIndex
CREATE INDEX "perfil_permissoes_recurso_acao_idx" ON "perfil_permissoes"("recurso", "acao");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuario_setores_tipo_lista_idx" ON "usuario_setores"("tipo_lista");

-- CreateIndex
CREATE INDEX "audit_log_usuario_id_created_at_idx" ON "audit_log"("usuario_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_entidade_entidade_id_idx" ON "audit_log"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "linhas_tipo_ordem_idx" ON "linhas"("tipo", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "linhas_tipo_codigo_key" ON "linhas"("tipo", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_negocio_codigo_key" ON "unidades_negocio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "centros_custo_codigo_rm_key" ON "centros_custo"("codigo_rm");

-- CreateIndex
CREATE INDEX "centros_custo_nome_controladoria_idx" ON "centros_custo"("nome_controladoria");

-- CreateIndex
CREATE INDEX "centros_custo_balde_idx" ON "centros_custo"("balde");

-- CreateIndex
CREATE UNIQUE INDEX "contas_resultado_reduzido_key" ON "contas_resultado"("reduzido");

-- CreateIndex
CREATE INDEX "contas_resultado_conta_idx" ON "contas_resultado"("conta");

-- CreateIndex
CREATE INDEX "contas_resultado_linha_dre_id_idx" ON "contas_resultado"("linha_dre_id");

-- CreateIndex
CREATE UNIQUE INDEX "linhas_dre_codigo_key" ON "linhas_dre"("codigo");

-- CreateIndex
CREATE INDEX "linhas_dre_grupo_sigla_idx" ON "linhas_dre"("grupo_sigla");

-- CreateIndex
CREATE INDEX "linhas_dre_unidades_unidade_negocio_id_idx" ON "linhas_dre_unidades"("unidade_negocio_id");

-- CreateIndex
CREATE INDEX "regras_rateio_chave_idx" ON "regras_rateio"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "regras_rateio_chave_destino_vigencia_inicio_key" ON "regras_rateio"("chave", "destino", "vigencia_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_movimento_codigo_key" ON "tipos_movimento"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tabela_estacas_secao_grupo_vigencia_inicio_key" ON "tabela_estacas"("secao", "grupo", "vigencia_inicio");

-- CreateIndex
CREATE INDEX "competencias_status_idx" ON "competencias"("status");

-- CreateIndex
CREATE UNIQUE INDEX "competencias_ano_mes_key" ON "competencias"("ano", "mes");

-- CreateIndex
CREATE INDEX "reaberturas_competencia_competencia_id_reaberta_em_idx" ON "reaberturas_competencia"("competencia_id", "reaberta_em");

-- CreateIndex
CREATE INDEX "importacoes_competencia_id_tipo_idx" ON "importacoes"("competencia_id", "tipo");

-- CreateIndex
CREATE INDEX "importacoes_hash_arquivo_idx" ON "importacoes"("hash_arquivo");

-- CreateIndex
CREATE INDEX "divergencias_competencia_id_status_idx" ON "divergencias"("competencia_id", "status");

-- CreateIndex
CREATE INDEX "divergencias_status_idx" ON "divergencias"("status");

-- CreateIndex
CREATE UNIQUE INDEX "obras_codigo_key" ON "obras"("codigo");

-- CreateIndex
CREATE INDEX "obras_situacao_cadastro_idx" ON "obras"("situacao_cadastro");

-- CreateIndex
CREATE INDEX "precos_contrato_obra_id_versao_idx" ON "precos_contrato"("obra_id", "versao");

-- CreateIndex
CREATE INDEX "precos_contrato_chave_substituido_em_idx" ON "precos_contrato"("chave", "substituido_em");

-- CreateIndex
CREATE INDEX "precos_contrato_substituido_em_idx" ON "precos_contrato"("substituido_em");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_competencia_id_validacao_idx" ON "lancamentos_contabeis"("competencia_id", "validacao");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_competencia_id_etiqueta_idx" ON "lancamentos_contabeis"("competencia_id", "etiqueta");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_competencia_id_filial_idx" ON "lancamentos_contabeis"("competencia_id", "filial");

-- CreateIndex
CREATE INDEX "lancamentos_manuais_competencia_id_motivo_idx" ON "lancamentos_manuais"("competencia_id", "motivo");

-- CreateIndex
CREATE UNIQUE INDEX "estoque_saldos_competencia_id_obra_id_linha_texto_key" ON "estoque_saldos"("competencia_id", "obra_id", "linha_texto");

-- CreateIndex
CREATE UNIQUE INDEX "estoque_saldos_iniciais_competencia_id_obra_id_linha_texto_key" ON "estoque_saldos_iniciais"("competencia_id", "obra_id", "linha_texto");

-- CreateIndex
CREATE INDEX "indicadores_importados_importacao_id_idx" ON "indicadores_importados"("importacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "indicadores_importados_competencia_id_nome_key" ON "indicadores_importados"("competencia_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "indicadores_estrutura_nome_key" ON "indicadores_estrutura"("nome");

-- CreateIndex
CREATE INDEX "indicadores_estrutura_ordem_idx" ON "indicadores_estrutura"("ordem");

-- CreateIndex
CREATE INDEX "metas_importadas_importacao_id_idx" ON "metas_importadas"("importacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "metas_importadas_competencia_id_nome_key" ON "metas_importadas"("competencia_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "indicadores_digitados_competencia_id_nome_key" ON "indicadores_digitados"("competencia_id", "nome");

-- CreateIndex
CREATE INDEX "projetos_competencia_id_idx" ON "projetos"("competencia_id");

-- CreateIndex
CREATE INDEX "projetos_importacao_id_idx" ON "projetos"("importacao_id");

-- CreateIndex
CREATE INDEX "producoes_competencia_id_linha_id_idx" ON "producoes"("competencia_id", "linha_id");

-- CreateIndex
CREATE INDEX "producoes_importacao_id_idx" ON "producoes"("importacao_id");

-- CreateIndex
CREATE INDEX "producoes_pista_competencia_id_idx" ON "producoes_pista"("competencia_id");

-- CreateIndex
CREATE INDEX "producoes_pista_importacao_id_idx" ON "producoes_pista"("importacao_id");

-- CreateIndex
CREATE INDEX "producoes_armadura_competencia_id_idx" ON "producoes_armadura"("competencia_id");

-- CreateIndex
CREATE INDEX "producoes_armadura_importacao_id_idx" ON "producoes_armadura"("importacao_id");

-- CreateIndex
CREATE INDEX "producoes_metalurgia_competencia_id_finalidade_idx" ON "producoes_metalurgia"("competencia_id", "finalidade");

-- CreateIndex
CREATE INDEX "producoes_metalurgia_importacao_id_idx" ON "producoes_metalurgia"("importacao_id");

-- CreateIndex
CREATE INDEX "expedicoes_competencia_id_linha_id_idx" ON "expedicoes"("competencia_id", "linha_id");

-- CreateIndex
CREATE INDEX "expedicoes_importacao_id_idx" ON "expedicoes"("importacao_id");

-- CreateIndex
CREATE INDEX "montagens_competencia_id_idx" ON "montagens"("competencia_id");

-- CreateIndex
CREATE INDEX "montagens_importacao_id_idx" ON "montagens"("importacao_id");

-- CreateIndex
CREATE INDEX "acompanhamentos_competencia_id_idx" ON "acompanhamentos"("competencia_id");

-- CreateIndex
CREATE INDEX "acompanhamentos_importacao_id_idx" ON "acompanhamentos"("importacao_id");

-- CreateIndex
CREATE INDEX "medicoes_competencia_id_idx" ON "medicoes"("competencia_id");

-- CreateIndex
CREATE INDEX "medicoes_importacao_id_idx" ON "medicoes"("importacao_id");

-- CreateIndex
CREATE INDEX "devolucoes_competencia_id_idx" ON "devolucoes"("competencia_id");

-- CreateIndex
CREATE INDEX "devolucoes_importacao_id_idx" ON "devolucoes"("importacao_id");

-- CreateIndex
CREATE INDEX "saidas_competencia_id_idx" ON "saidas"("competencia_id");

-- CreateIndex
CREATE INDEX "saidas_importacao_id_idx" ON "saidas"("importacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "receitas_previas_competencia_id_unidade_negocio_id_natureza_key" ON "receitas_previas"("competencia_id", "unidade_negocio_id", "natureza");

-- CreateIndex
CREATE INDEX "receitas_previas_precos_preco_contrato_id_idx" ON "receitas_previas_precos"("preco_contrato_id");

-- CreateIndex
CREATE UNIQUE INDEX "volumes_operacionais_competencia_id_regra_rateio_id_key" ON "volumes_operacionais"("competencia_id", "regra_rateio_id");

-- CreateIndex
CREATE INDEX "resultados_apurados_competencia_id_linha_dre_id_idx" ON "resultados_apurados"("competencia_id", "linha_dre_id");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_apurados_competencia_id_unidade_negocio_id_centr_key" ON "resultados_apurados"("competencia_id", "unidade_negocio_id", "centro_custo_id", "linha_dre_id");

-- CreateIndex
CREATE UNIQUE INDEX "reclassificacoes_conta_codigo_centro_custo_conta_origem_id_key" ON "reclassificacoes_conta"("codigo_centro_custo", "conta_origem_id");

-- CreateIndex
CREATE INDEX "receitas_previas_itens_receita_previa_id_idx" ON "receitas_previas_itens"("receita_previa_id");

-- CreateIndex
CREATE INDEX "lancamentos_receita_competencia_id_idx" ON "lancamentos_receita"("competencia_id");

-- CreateIndex
CREATE INDEX "conferencias_planilha_competencia_id_enviado_em_idx" ON "conferencias_planilha"("competencia_id", "enviado_em");

-- CreateIndex
CREATE UNIQUE INDEX "cenarios_marcacao_key" ON "cenarios"("marcacao");

-- CreateIndex
CREATE INDEX "cenarios_resultados_linha_dre_id_idx" ON "cenarios_resultados"("linha_dre_id");

-- CreateIndex
CREATE INDEX "cenarios_justificativas_linha_dre_id_idx" ON "cenarios_justificativas"("linha_dre_id");

-- CreateIndex
CREATE INDEX "cenarios_centros_linha_dre_id_idx" ON "cenarios_centros"("linha_dre_id");

-- CreateIndex
CREATE INDEX "cenarios_investimentos_cenario_id_idx" ON "cenarios_investimentos"("cenario_id");

-- CreateIndex
CREATE UNIQUE INDEX "cenarios_investimentos_cenario_id_nome_referencia_key" ON "cenarios_investimentos"("cenario_id", "nome_referencia");

-- CreateIndex
CREATE UNIQUE INDEX "correspondencias_tarefas_filial_tarefa_key" ON "correspondencias_tarefas"("filial", "tarefa");

-- CreateIndex
CREATE INDEX "cenarios_reajustes_cenario_id_criado_em_idx" ON "cenarios_reajustes"("cenario_id", "criado_em");

-- CreateIndex
CREATE INDEX "requisicoes_itens_competencia_id_conta_contabil_idx" ON "requisicoes_itens"("competencia_id", "conta_contabil");

-- CreateIndex
CREATE INDEX "requisicoes_itens_importacao_id_idx" ON "requisicoes_itens"("importacao_id");

-- CreateIndex
CREATE INDEX "lotacoes_centros_competencia_id_idx" ON "lotacoes_centros"("competencia_id");

-- CreateIndex
CREATE INDEX "lotacoes_centros_importacao_id_idx" ON "lotacoes_centros"("importacao_id");

-- CreateIndex
CREATE INDEX "notas_fiscais_itens_competencia_id_conta_contabil_idx" ON "notas_fiscais_itens"("competencia_id", "conta_contabil");

-- CreateIndex
CREATE INDEX "notas_fiscais_itens_importacao_id_idx" ON "notas_fiscais_itens"("importacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "relatorios_executivos_ano_mes_key" ON "relatorios_executivos"("ano", "mes");

-- AddForeignKey
ALTER TABLE "perfil_permissoes" ADD CONSTRAINT "perfil_permissoes_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_permissoes_telas" ADD CONSTRAINT "perfil_permissoes_telas_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_centros" ADD CONSTRAINT "usuario_centros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_centros" ADD CONSTRAINT "usuario_centros_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_departamentos" ADD CONSTRAINT "usuario_departamentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_setores" ADD CONSTRAINT "usuario_setores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linhas" ADD CONSTRAINT "linhas_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_resultado" ADD CONSTRAINT "contas_resultado_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linhas_dre_unidades" ADD CONSTRAINT "linhas_dre_unidades_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linhas_dre_unidades" ADD CONSTRAINT "linhas_dre_unidades_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_rateio" ADD CONSTRAINT "regras_rateio_unidade_destino_id_fkey" FOREIGN KEY ("unidade_destino_id") REFERENCES "unidades_negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencias" ADD CONSTRAINT "competencias_aberta_por_fkey" FOREIGN KEY ("aberta_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencias" ADD CONSTRAINT "competencias_apurada_por_fkey" FOREIGN KEY ("apurada_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencias" ADD CONSTRAINT "competencias_fechada_por_fkey" FOREIGN KEY ("fechada_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaberturas_competencia" ADD CONSTRAINT "reaberturas_competencia_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reaberturas_competencia" ADD CONSTRAINT "reaberturas_competencia_reaberta_por_fkey" FOREIGN KEY ("reaberta_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacoes" ADD CONSTRAINT "importacoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacoes" ADD CONSTRAINT "importacoes_importado_por_fkey" FOREIGN KEY ("importado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "divergencias" ADD CONSTRAINT "divergencias_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "divergencias" ADD CONSTRAINT "divergencias_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "divergencias" ADD CONSTRAINT "divergencias_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obras" ADD CONSTRAINT "obras_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obras" ADD CONSTRAINT "obras_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precos_contrato" ADD CONSTRAINT "precos_contrato_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precos_contrato" ADD CONSTRAINT "precos_contrato_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis" ADD CONSTRAINT "lancamentos_contabeis_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis" ADD CONSTRAINT "lancamentos_contabeis_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis" ADD CONSTRAINT "lancamentos_contabeis_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis" ADD CONSTRAINT "lancamentos_contabeis_conta_resultado_id_fkey" FOREIGN KEY ("conta_resultado_id") REFERENCES "contas_resultado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis" ADD CONSTRAINT "lancamentos_contabeis_conta_adotada_id_fkey" FOREIGN KEY ("conta_adotada_id") REFERENCES "contas_resultado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis" ADD CONSTRAINT "lancamentos_contabeis_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_manuais" ADD CONSTRAINT "lancamentos_manuais_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_manuais" ADD CONSTRAINT "lancamentos_manuais_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_manuais" ADD CONSTRAINT "lancamentos_manuais_conta_resultado_id_fkey" FOREIGN KEY ("conta_resultado_id") REFERENCES "contas_resultado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_manuais" ADD CONSTRAINT "lancamentos_manuais_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_saldos" ADD CONSTRAINT "estoque_saldos_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_saldos" ADD CONSTRAINT "estoque_saldos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_saldos" ADD CONSTRAINT "estoque_saldos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_saldos_iniciais" ADD CONSTRAINT "estoque_saldos_iniciais_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_saldos_iniciais" ADD CONSTRAINT "estoque_saldos_iniciais_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_saldos_iniciais" ADD CONSTRAINT "estoque_saldos_iniciais_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_saldos_iniciais" ADD CONSTRAINT "estoque_saldos_iniciais_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicadores_importados" ADD CONSTRAINT "indicadores_importados_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicadores_importados" ADD CONSTRAINT "indicadores_importados_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_importadas" ADD CONSTRAINT "metas_importadas_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_importadas" ADD CONSTRAINT "metas_importadas_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicadores_digitados" ADD CONSTRAINT "indicadores_digitados_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes" ADD CONSTRAINT "producoes_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes" ADD CONSTRAINT "producoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes" ADD CONSTRAINT "producoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes" ADD CONSTRAINT "producoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_pista" ADD CONSTRAINT "producoes_pista_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_pista" ADD CONSTRAINT "producoes_pista_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_pista" ADD CONSTRAINT "producoes_pista_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_pista" ADD CONSTRAINT "producoes_pista_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_armadura" ADD CONSTRAINT "producoes_armadura_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_armadura" ADD CONSTRAINT "producoes_armadura_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_armadura" ADD CONSTRAINT "producoes_armadura_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_armadura" ADD CONSTRAINT "producoes_armadura_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_metalurgia" ADD CONSTRAINT "producoes_metalurgia_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_metalurgia" ADD CONSTRAINT "producoes_metalurgia_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_metalurgia" ADD CONSTRAINT "producoes_metalurgia_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes_metalurgia" ADD CONSTRAINT "producoes_metalurgia_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedicoes" ADD CONSTRAINT "expedicoes_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedicoes" ADD CONSTRAINT "expedicoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedicoes" ADD CONSTRAINT "expedicoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedicoes" ADD CONSTRAINT "expedicoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "montagens" ADD CONSTRAINT "montagens_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "montagens" ADD CONSTRAINT "montagens_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "montagens" ADD CONSTRAINT "montagens_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "montagens" ADD CONSTRAINT "montagens_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acompanhamentos" ADD CONSTRAINT "acompanhamentos_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acompanhamentos" ADD CONSTRAINT "acompanhamentos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acompanhamentos" ADD CONSTRAINT "acompanhamentos_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acompanhamentos" ADD CONSTRAINT "acompanhamentos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicoes" ADD CONSTRAINT "medicoes_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicoes" ADD CONSTRAINT "medicoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicoes" ADD CONSTRAINT "medicoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicoes" ADD CONSTRAINT "medicoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucoes" ADD CONSTRAINT "devolucoes_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucoes" ADD CONSTRAINT "devolucoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucoes" ADD CONSTRAINT "devolucoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucoes" ADD CONSTRAINT "devolucoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucoes" ADD CONSTRAINT "devolucoes_tipo_movimento_id_fkey" FOREIGN KEY ("tipo_movimento_id") REFERENCES "tipos_movimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_tipo_movimento_id_fkey" FOREIGN KEY ("tipo_movimento_id") REFERENCES "tipos_movimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receitas_previas" ADD CONSTRAINT "receitas_previas_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receitas_previas" ADD CONSTRAINT "receitas_previas_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receitas_previas_precos" ADD CONSTRAINT "receitas_previas_precos_receita_previa_id_fkey" FOREIGN KEY ("receita_previa_id") REFERENCES "receitas_previas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receitas_previas_precos" ADD CONSTRAINT "receitas_previas_precos_preco_contrato_id_fkey" FOREIGN KEY ("preco_contrato_id") REFERENCES "precos_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volumes_operacionais" ADD CONSTRAINT "volumes_operacionais_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volumes_operacionais" ADD CONSTRAINT "volumes_operacionais_regra_rateio_id_fkey" FOREIGN KEY ("regra_rateio_id") REFERENCES "regras_rateio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volumes_operacionais" ADD CONSTRAINT "volumes_operacionais_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_apurados" ADD CONSTRAINT "resultados_apurados_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_apurados" ADD CONSTRAINT "resultados_apurados_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_apurados" ADD CONSTRAINT "resultados_apurados_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_apurados" ADD CONSTRAINT "resultados_apurados_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclassificacoes_conta" ADD CONSTRAINT "reclassificacoes_conta_conta_origem_id_fkey" FOREIGN KEY ("conta_origem_id") REFERENCES "contas_resultado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclassificacoes_conta" ADD CONSTRAINT "reclassificacoes_conta_conta_destino_id_fkey" FOREIGN KEY ("conta_destino_id") REFERENCES "contas_resultado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receitas_previas_itens" ADD CONSTRAINT "receitas_previas_itens_receita_previa_id_fkey" FOREIGN KEY ("receita_previa_id") REFERENCES "receitas_previas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_receita" ADD CONSTRAINT "lancamentos_receita_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_receita" ADD CONSTRAINT "lancamentos_receita_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conferencias_planilha" ADD CONSTRAINT "conferencias_planilha_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conferencias_planilha" ADD CONSTRAINT "conferencias_planilha_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios" ADD CONSTRAINT "cenarios_comparado_com_id_fkey" FOREIGN KEY ("comparado_com_id") REFERENCES "cenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios_resultados" ADD CONSTRAINT "cenarios_resultados_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios_resultados" ADD CONSTRAINT "cenarios_resultados_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios_indicadores" ADD CONSTRAINT "cenarios_indicadores_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios_justificativas" ADD CONSTRAINT "cenarios_justificativas_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios_justificativas" ADD CONSTRAINT "cenarios_justificativas_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios_premissas_justificativas" ADD CONSTRAINT "cenarios_premissas_justificativas_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios_premissas" ADD CONSTRAINT "cenarios_premissas_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios_centros" ADD CONSTRAINT "cenarios_centros_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios_centros" ADD CONSTRAINT "cenarios_centros_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios_investimentos" ADD CONSTRAINT "cenarios_investimentos_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correspondencias_tarefas" ADD CONSTRAINT "correspondencias_tarefas_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenarios_reajustes" ADD CONSTRAINT "cenarios_reajustes_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicoes_itens" ADD CONSTRAINT "requisicoes_itens_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicoes_itens" ADD CONSTRAINT "requisicoes_itens_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotacoes_centros" ADD CONSTRAINT "lotacoes_centros_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotacoes_centros" ADD CONSTRAINT "lotacoes_centros_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais_itens" ADD CONSTRAINT "notas_fiscais_itens_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais_itens" ADD CONSTRAINT "notas_fiscais_itens_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios_executivos_abas" ADD CONSTRAINT "relatorios_executivos_abas_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorios_executivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O log de auditoria é imutável (SPEC, RF011): nenhum perfil altera ou exclui registro,
-- nem pela API nem direto no banco. Equivalente PostgreSQL dos gatilhos SQLite da migração
-- 20260930140000_auditoria_imutavel (ver backend/prisma/PORTABILIDADE.md).
--
-- Vai no FIM da migração inicial do PostgreSQL (prisma/migrations/0_init/migration.sql),
-- para que `prisma migrate deploy` crie as tabelas e os gatilhos juntos.

CREATE OR REPLACE FUNCTION audit_log_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'O log de auditoria é imutável: registros não podem ser alterados.';
  END IF;
  RAISE EXCEPTION 'O log de auditoria é imutável: registros não podem ser excluídos.';
END;
$$;

CREATE TRIGGER "audit_log_sem_alteracao" BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_imutavel();

CREATE TRIGGER "audit_log_sem_exclusao" BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_imutavel();

-- O SQLite não tem TRUNCATE; no PostgreSQL ele passa por cima dos gatilhos de linha.
CREATE TRIGGER "audit_log_sem_truncate" BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_imutavel();
