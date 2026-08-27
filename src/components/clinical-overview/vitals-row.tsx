import {
  ActivityIcon,
  DropletsIcon,
  HeartPulseIcon,
  ScaleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { VitalMetric, VitalStatus } from "@/lib/overview-vitals";
import { cn } from "@/lib/utils";

const icons = {
  bp: ActivityIcon,
  hr: HeartPulseIcon,
  weight: ScaleIcon,
  spo2: DropletsIcon,
} as const;

const sparkPaths = {
  bp: "M0 18 L8 14 L16 16 L24 8 L32 12 L40 6 L48 10",
  hr: "M0 12 L8 12 L12 4 L18 20 L24 10 L32 12 L40 11 L48 12",
  weight: "M0 14 L12 13 L24 12 L36 11 L48 10",
  spo2: "M0 10 L8 11 L16 9 L24 10 L32 8 L40 9 L48 8",
} as const;

function statusClass(status: VitalStatus) {
  if (status === "elevated") {
    return "border-destructive/30 text-destructive";
  }
  if (status === "not_recorded") return "";
  return "";
}

function Sparkline({
  kind,
  tone,
}: {
  kind: VitalMetric["kind"];
  tone: VitalStatus;
}) {
  const stroke =
    tone === "elevated"
      ? "stroke-destructive"
      : tone === "not_recorded"
        ? "stroke-muted-foreground/40"
        : "stroke-primary";
  return (
    <svg viewBox="0 0 48 24" className="text-muted h-8 w-full" aria-hidden>
      <path
        d={sparkPaths[kind]}
        fill="none"
        className={cn(stroke)}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VitalsRow({
  metrics,
  labels,
  statusLabels,
}: {
  metrics: VitalMetric[];
  labels: Record<VitalMetric["kind"], string>;
  statusLabels: Record<VitalStatus, string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = icons[metric.kind];
        return (
          <Card className="rounded-2xl shadow-sm" key={metric.kind} size="sm">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="bg-muted text-primary flex size-9 items-center justify-center rounded-md">
                  <Icon className="size-4" aria-hidden />
                </span>
                <Badge
                  variant="outline"
                  className={cn("capitalize", statusClass(metric.status))}
                >
                  {statusLabels[metric.status]}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {labels[metric.kind]}
                </p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
                    metric.status === "not_recorded" &&
                      "text-muted-foreground text-lg font-medium",
                  )}
                >
                  {metric.status === "not_recorded"
                    ? statusLabels.not_recorded
                    : metric.value}
                </p>
              </div>
              <Sparkline kind={metric.kind} tone={metric.status} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
