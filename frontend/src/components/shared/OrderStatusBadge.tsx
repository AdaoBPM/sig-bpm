import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type OrderStatus = "novo" | "aprovado" | "entregue";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  novo: {
    label: "Novo",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  aprovado: {
    label: "Aprovado",
    className: "border-sky-200 bg-sky-50 text-sky-900",
  },
  entregue: {
    label: "Entregue",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
};

type OrderStatusBadgeProps = {
  status: OrderStatus;
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
