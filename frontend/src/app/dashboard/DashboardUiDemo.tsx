"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Demonstração de dialog + toast — referência do template. */
export function DashboardUiDemo() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        Componentes interativos
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => toast.success("Integração Sonner OK")}
        >
          Testar toast
        </Button>

        <Dialog>
          <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
            Abrir dialog
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Stack UI do template</DialogTitle>
              <DialogDescription>
                Sidebar, Card, Chart, Table, Field + react-hook-form e Sonner estão
                disponíveis para novas telas após o SPEC.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Fechar
              </DialogClose>
              <Button
                type="button"
                onClick={() => toast.info("Ação confirmada")}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
