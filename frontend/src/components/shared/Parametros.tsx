/**
 * Departamento e atribuição — os parâmetros que a verificação do lançamento
 * compara. Mostrados por extenso: as siglas da planilha eram só abreviação.
 */
export function Parametros({
  departamento,
  atribuicao,
}: {
  departamento: string | null;
  atribuicao: string | null;
}) {
  if (!departamento && !atribuicao) {
    return <span className="text-xs text-gray-400">sem parâmetro</span>;
  }
  const texto = [departamento ?? "-", atribuicao ?? "-"].join(" · ");
  return (
    <span className="block max-w-64 truncate text-xs text-gray-500" title={texto}>
      {texto}
    </span>
  );
}
