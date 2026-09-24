"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Inbox, Search } from "lucide-react";

import { OrderStatusBadge } from "@/components/shared/OrderStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency } from "@/utils/formatters";

import {
  PEDIDOS_MOCK,
  type PedidoListagem,
} from "./utils/mockPedidos";

type DemoMode = "normal" | "loading" | "erro" | "vazio";

export function PedidosListagemContent() {
  useRegistrarAcessoTela("/pedidos/listagem");

  const [busca, setBusca] = useState("");
  const [demo, setDemo] = useState<DemoMode>("normal");
  const buscaDebounced = useDebounce(busca, 300);

  const filtrados = useMemo(() => {
    if (!buscaDebounced.trim()) return PEDIDOS_MOCK;
    const termo = buscaDebounced.toLowerCase();
    return PEDIDOS_MOCK.filter(
      (p) =>
        p.id.toLowerCase().includes(termo) ||
        p.cliente.toLowerCase().includes(termo),
    );
  }, [buscaDebounced]);

  const data: PedidoListagem[] = demo === "vazio" ? [] : filtrados;
  const isLoading = demo === "loading";
  const error = demo === "erro" ? "Falha ao carregar pedidos (demo)." : null;

  return (
    <Card className="border-black/5 shadow-sm">
      <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Listagem</CardTitle>
          <CardDescription>
            {data.length} registro(s) — busca com debounce e estados de UI.
          </CardDescription>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="busca-pedidos"
            placeholder="Buscar ID ou cliente…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={demo}
          onValueChange={(value) => setDemo(value as DemoMode)}
        >
          <TabsList variant="line">
            <TabsTrigger value="normal">Dados</TabsTrigger>
            <TabsTrigger value="loading">Loading</TabsTrigger>
            <TabsTrigger value="erro">Erro</TabsTrigger>
            <TabsTrigger value="vazio">Vazio</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum pedido encontrado</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setBusca("")}>
              Limpar busca
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.id}</TableCell>
                  <TableCell>{item.cliente}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(item.valor)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.criadoEm}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">shadcn Table</Badge>
          <Badge variant="outline">PermissionGuard</Badge>
          <Badge variant="outline">Mock data</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
