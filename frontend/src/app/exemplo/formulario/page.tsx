import { Suspense } from "react";

import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { MetaDiariaForm } from "./MetaDiariaForm";

export default function FormularioExemploPage() {
  return (
    <ProtectedLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Formulário de referência</h1>
            <Badge variant="outline">Field + RHF + Zod</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Padrão recomendado para cadastros e lançamentos em sistemas internos BPM.
          </p>
        </div>

        <Card className="border-black/5 shadow-sm">
          <CardHeader>
            <CardTitle>Lançamento de produção</CardTitle>
            <CardDescription>
              Validação client-side com Zod — persistência entra após o SPEC.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<LoadingSkeleton rows={4} />}>
              <MetaDiariaForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
