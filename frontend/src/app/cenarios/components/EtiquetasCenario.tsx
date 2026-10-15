import { Bookmark, Star } from "lucide-react";

import { rotuloMarcacao, type MarcacaoCenario } from "../services/cenariosService";

/**
 * As etiquetas dos cenários (14/10/2026), depois da etiqueta da versão: "Vigente" (a versão mais recente da família),
 * com a estrela, como um favorito, e a da marcação, com o símbolo de marcação (o do botão Marcar Cenário). `classe`: o
 * contorno da etiqueta em cada tela.
 */
export function EtiquetaVigente({ classe }: { classe: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${classe}`} title="A versão mais recente do cenário">
      <Star className="size-3 shrink-0 fill-current" />
      Vigente
    </span>
  );
}

export function EtiquetaMarcacao({ marcacao, classe }: { marcacao: MarcacaoCenario | null; classe: string }) {
  if (!marcacao) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${classe}`}>
      <Bookmark className="size-3 shrink-0 fill-current" />
      {rotuloMarcacao(marcacao)}
    </span>
  );
}
