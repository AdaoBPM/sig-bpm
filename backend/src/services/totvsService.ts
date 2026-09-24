/**
 * Integração TOTVS RM — stub do template com modo mock.
 *
 * Stack aprovada para SOAP/XML:
 * - `soap` — clientes WSDL (DataServer, processos com envelope SOAP)
 * - `xml2js` — parse/build via `lib/xml.ts` quando a resposta não passa pelo client soap
 *
 * Consultas diretas ao banco legado: `config/mssql.ts` (MSSQL).
 * Implementar métodos reais quando o SPEC confirmar integração.
 */

import { env } from "../config/env.js";

// import soap from "soap";
// import { parseXml } from "../lib/xml.js";

export type PedidoTotvsMock = {
  id: string;
  cliente: string;
  status: string;
  valor: number;
  dataEmissao: string;
};

const PEDIDOS_MOCK: PedidoTotvsMock[] = [
  {
    id: "RM-10482",
    cliente: "Construtora Alfa",
    status: "aprovado",
    valor: 42800.5,
    dataEmissao: "2026-06-24",
  },
  {
    id: "RM-10479",
    cliente: "Obras Beta Ltda",
    status: "novo",
    valor: 19200,
    dataEmissao: "2026-06-23",
  },
  {
    id: "RM-10471",
    cliente: "Engenharia Gama",
    status: "entregue",
    valor: 67500,
    dataEmissao: "2026-06-20",
  },
];

export const totvsService = {
  async healthCheck() {
    return {
      configured: env.totvsConfigured,
      mode: env.totvsConfigured ? "soap" : "mock",
      stack: ["soap", "xml2js", "mssql (opcional)"],
      message: env.totvsConfigured
        ? "TOTVS_WSDL_URL definido — implementar métodos SOAP no projeto"
        : "Modo mock ativo — configure TOTVS_WSDL_URL quando o SPEC exigir integração",
    };
  },

  /**
   * Retorna dados fictícios quando WSDL não está configurado.
   * Com WSDL, substituir por cliente SOAP real.
   */
  async consultarPedidos(): Promise<PedidoTotvsMock[]> {
    if (env.totvsConfigured) {
      throw new Error(
        "TOTVS_WSDL_URL configurado — implementar consultarPedidos com soap.createClientAsync",
      );
    }

    return PEDIDOS_MOCK;
  },

  /**
   * Exemplo de fluxo SOAP (implementar quando houver WSDL no SPEC):
   *
   * const client = await soap.createClientAsync(process.env.TOTVS_WSDL_URL!);
   * client.setSecurity(new soap.BasicAuthSecurity(user, pass));
   * const [result] = await client.MeuMetodoAsync({ param: "valor" });
   * return result;
   */
  async exemploSoapPlaceholder() {
    throw new Error("Integração TOTVS SOAP não implementada neste template");
  },
};
