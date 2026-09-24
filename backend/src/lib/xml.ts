import { Builder, parseStringPromise } from "xml2js";

const defaultParseOptions = {
  explicitArray: false,
  ignoreAttrs: false,
  trim: true,
} as const;

/**
 * Converte XML (SOAP envelope, respostas legadas) em objeto JavaScript.
 */
export async function parseXml<T = Record<string, unknown>>(
  xml: string,
): Promise<T> {
  return parseStringPromise(xml, defaultParseOptions) as Promise<T>;
}

/**
 * Monta XML a partir de objeto — útil para payloads SOAP customizados.
 */
export function buildXml(rootName: string, obj: Record<string, unknown>): string {
  const builder = new Builder({ headless: true, rootName });
  return builder.buildObject(obj);
}
