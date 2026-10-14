/**
 * Os dias úteis de um mês (13/10/2026, para a Jornada das premissas dos cenários analíticos): de segunda a sexta,
 * menos os feriados nacionais. Carnaval e Corpus Christi são pontos facultativos e contam como dias úteis (decisão do
 * usuário); os feriados estaduais e municipais e as paradas da fábrica se acertam na própria premissa, que se edita.
 */

/** O domingo de Páscoa do ano (algoritmo de Meeus/Jones/Butcher), no calendário gregoriano. */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/**
 * Os feriados nacionais do ano, como "MM-DD": Confraternização Universal, Sexta-Feira Santa (dois dias antes da
 * Páscoa), Tiradentes, Dia do Trabalho, Independência, Nossa Senhora Aparecida, Finados, Proclamação da República,
 * Dia Nacional de Zumbi e da Consciência Negra (nacional desde 2024) e Natal.
 */
export function feriadosNacionais(ano: number): Set<string> {
  const sexta = new Date(pascoa(ano).getTime() - 2 * 86_400_000);
  const mmdd = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "12-25"];
  if (ano >= 2024) fixos.push("11-20");
  return new Set([...fixos, mmdd(sexta)]);
}

/** Os dias úteis do mês (1 a 12): de segunda a sexta, menos os feriados nacionais. */
export function diasUteis(ano: number, mes: number): number {
  const feriados = feriadosNacionais(ano);
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= dias; d++) {
    const dia = new Date(Date.UTC(ano, mes - 1, d));
    const semana = dia.getUTCDay();
    if (semana === 0 || semana === 6) continue;
    if (feriados.has(`${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`)) continue;
    n++;
  }
  return n;
}
