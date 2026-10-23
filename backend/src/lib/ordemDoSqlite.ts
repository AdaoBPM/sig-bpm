/**
 * A ordem do SQLite no PostgreSQL (23/10/2026, a migração do banco). O SQLite ordenava os enums pelo texto gravado; o
 * PostgreSQL os ordena pela ordem da declaração no schema (os enums são tipos do banco). Onde a tela mostra a ordem por
 * um enum, ordena-se aqui, pelo texto (o sort do JavaScript é estável: os empates ficam na ordem que veio do banco).
 */
export const peloTexto =
  <T>(campo: (x: T) => string) =>
  (a: T, b: T) => {
    const [x, y] = [campo(a), campo(b)];
    return x < y ? -1 : x > y ? 1 : 0;
  };
