import Link from "next/link";
import { EyeOff } from "lucide-react";

/**
 * Para o perfil que vê a tela (permissão Ver) mas não lê os dados dela
 * (permissão Ler): em vez da página em branco, o motivo.
 */
export function SemLeitura() {
  return (
    <div className="mx-auto mt-10 max-w-lg space-y-3 rounded-sm border border-gray-200 bg-white p-6 text-center">
      <EyeOff className="mx-auto size-8 text-gray-400" />
      <h1 className="text-lg font-bold text-gray-900">Sem permissão para ler os dados</h1>
      <p className="text-sm text-gray-600">
        O seu perfil vê esta tela no menu, mas não inclui a leitura dos dados dela. Se precisar, fale com o setor Contábil.
      </p>
      <Link href="/competencias" className="inline-block text-sm font-medium text-gray-900 underline underline-offset-2">
        Voltar às competências
      </Link>
    </div>
  );
}
