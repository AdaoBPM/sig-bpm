"use client";

import {
  ClipboardList,
  Gauge,
  Minus,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardStat } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

const ICONS = {
  clipboard: ClipboardList,
  gauge: Gauge,
  truck: Truck,
} as const;

type DashboardKpiCardsProps = {
  stats: DashboardStat[];
};

export function DashboardKpiCards({ stats }: DashboardKpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => {
        const Icon = ICONS[stat.icon];
        const TrendIcon =
          stat.trend === "up"
            ? TrendingUp
            : stat.trend === "down"
              ? TrendingDown
              : Minus;

        return (
          <Card key={stat.label} className="border-black/5 shadow-sm">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl font-bold tracking-tight tabular-nums">
                {stat.value}
              </CardTitle>
              <CardAction>
                <div className="flex size-10 items-center justify-center rounded-lg bg-bpm-primary/15 text-bpm-secondary">
                  <Icon className="size-5" aria-hidden />
                </div>
              </CardAction>
            </CardHeader>
            <CardFooter className="justify-between border-t-0 bg-transparent pt-0">
              <span className="text-xs text-muted-foreground">{stat.description}</span>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 font-medium tabular-nums",
                  stat.trend === "up" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                  stat.trend === "down" && "border-red-200 bg-red-50 text-red-800",
                  stat.trend === "neutral" && "border-border bg-muted text-muted-foreground",
                )}
              >
                <TrendIcon className="size-3" aria-hidden />
                {stat.delta}
              </Badge>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
