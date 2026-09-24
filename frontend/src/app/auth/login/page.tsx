import { Suspense } from "react";

import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Suspense fallback={<p className="text-sm text-gray-600">Carregando...</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
