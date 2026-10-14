/**
 * As vigências das regras de rateio (14/10/2026): as verificações do cadastro e da apuração.
 *
 * - Duas regras da mesma chave e do mesmo destino não podem valer no mesmo mês (a apuração contaria o volume duas
 *   vezes); numa chave, as regras que valem juntas são todas por volume ou todas de percentual fixo.
 * - A vigência é mensal: a regra vale no mês quando começa até o dia 1º e não terminou antes dele.
 * - Uma chave sem regra num mês deixa os lançamentos de rateio dela fora de todas as unidades: as lacunas viram aviso.
 */

export type Vigencia = { inicio: Date; fim: Date | null };
export type RegraComVigencia = Vigencia & { id?: string; chave: string; destino: string; fixo: boolean };

const mesDe = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
/** O primeiro mês em que a regra vale (o do início, se começa no dia 1º; senão, o seguinte). */
const primeiroMes = (v: Vigencia) => mesDe(v.inicio) + (v.inicio.getUTCDate() === 1 ? 0 : 1);
/** O último mês em que a regra vale (o do fim); sem fim, nunca acaba. */
const ultimoMes = (v: Vigencia) => (v.fim ? mesDe(v.fim) : Number.POSITIVE_INFINITY);

/** As duas vigências têm algum mês em comum. */
export function sobrepoem(a: Vigencia, b: Vigencia) {
  return Math.max(primeiroMes(a), primeiroMes(b)) <= Math.min(ultimoMes(a), ultimoMes(b));
}

/** A regra vale no mês (1 a 12). */
export const valeNoMes = (v: Vigencia, ano: number, mes: number) => {
  const m = ano * 12 + mes - 1;
  return primeiroMes(v) <= m && m <= ultimoMes(v);
};

const ROTULO_MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
export const rotuloDoMes = (m: number) => `${ROTULO_MES[m % 12]}/${Math.floor(m / 12)}`;
/** "de JAN/2026 a DEZ/2026" ou, sem fim, "de JAN/2026 em diante". */
export const descreverVigencia = (v: Vigencia) => (v.fim ? `de ${rotuloDoMes(primeiroMes(v))} a ${rotuloDoMes(ultimoMes(v))}` : `de ${rotuloDoMes(primeiroMes(v))} em diante`);

/**
 * Por que a regra `nova` não pode valer junto com as `outras` (nulo se pode): a mesma chave e o mesmo destino no mesmo
 * mês, ou a mistura de regras por volume e de percentual fixo na mesma chave.
 */
export function conflitoDeVigencia(nova: RegraComVigencia, outras: RegraComVigencia[], nomeDaChave: (c: string) => string = (c) => c) {
  for (const o of outras) {
    if (o.id && o.id === nova.id) continue;
    if (o.chave !== nova.chave || !sobrepoem(nova, o)) continue;
    if (o.destino === nova.destino)
      return `Já existe uma regra de ${nomeDaChave(o.chave)} para este destino valendo ${descreverVigencia(o)}: encerre a vigência dela antes do início desta, ou ajuste as datas.`;
    if (o.fixo !== nova.fixo)
      return `${nomeDaChave(o.chave)} tem regras ${o.fixo ? "de percentual fixo" : "por volume"} valendo ${descreverVigencia(o)}: numa chave, as regras de um mesmo período são todas por volume ou todas de percentual fixo.`;
  }
  return null;
}

/**
 * Os meses sem regra de cada chave (as lacunas), do primeiro mês com regra de qualquer chave até `ate` (o mês, ano × 12 +
 * mês − 1): o aviso diz, por chave, os períodos sem regra (o último, "em diante", quando vai até `ate`).
 */
export function lacunasDasRegras(regras: RegraComVigencia[], chaves: string[], ate: number, nomeDaChave: (c: string) => string = (c) => c) {
  if (!regras.length) return chaves.map((c) => `${nomeDaChave(c)}: nenhuma regra cadastrada.`);
  const desde = Math.min(...regras.map(primeiroMes));
  const avisos: string[] = [];
  for (const chave of chaves) {
    const daChave = regras.filter((r) => r.chave === chave);
    const sem: number[] = [];
    for (let m = desde; m <= ate; m++) if (!daChave.some((r) => primeiroMes(r) <= m && m <= ultimoMes(r))) sem.push(m);
    if (!sem.length) continue;
    // Os meses seguidos viram períodos.
    const periodos: Array<[number, number]> = [];
    for (const m of sem) {
      const ultimo = periodos[periodos.length - 1];
      if (ultimo && ultimo[1] === m - 1) ultimo[1] = m;
      else periodos.push([m, m]);
    }
    const texto = periodos.map(([a, b]) => (b === ate ? `de ${rotuloDoMes(a)} em diante` : a === b ? `em ${rotuloDoMes(a)}` : `de ${rotuloDoMes(a)} a ${rotuloDoMes(b)}`));
    avisos.push(`${nomeDaChave(chave)}: sem regra ${texto.join(", ")}. Os lançamentos de rateio dela nesses meses não vão para nenhuma unidade.`);
  }
  return avisos;
}
