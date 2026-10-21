import { Suspense } from "react";

import { FaixaDaPublicacao } from "@/components/layout/FaixaDaPublicacao";

import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      {/* O modo de publicação (21/10/2026): quem entra durante o deploy vê o aviso. */}
      <FaixaDaPublicacao />
      <div className="flex flex-1 items-center justify-center p-4">
        <Suspense fallback={<p className="text-sm text-gray-600">Carregando...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
