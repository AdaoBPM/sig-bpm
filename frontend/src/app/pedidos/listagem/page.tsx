import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Badge } from "@/components/ui/badge";

import { PedidosListagemContent } from "./PedidosListagemContent";

export default function PedidosListagemPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="pedidos:view">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
              <Badge variant="secondary">Módulo exemplo</Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Padrão de listagem com Card, Input, Tabs e Table do shadcn/ui — base
              para CRUDs do SPEC.
            </p>
          </div>

          <PedidosListagemContent />
        </div>
      </PermissionGuard>
    </ProtectedLayout>
  );
}
