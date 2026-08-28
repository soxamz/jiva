import {
  FileTextIcon,
  FlaskConicalIcon,
  StethoscopeIcon,
  TriangleAlertIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ClinicalRecordSummaryProps = {
  title: string;
  description: string;
  latestCheckLabel: string;
  latestCheck: string | null;
  items: Array<{
    label: string;
    value: number;
    kind: "checks" | "documents" | "urgent" | "labs";
  }>;
};

const icons = {
  checks: StethoscopeIcon,
  documents: FileTextIcon,
  urgent: TriangleAlertIcon,
  labs: FlaskConicalIcon,
} as const;

export function ClinicalRecordSummary({
  title,
  description,
  latestCheckLabel,
  latestCheck,
  items,
}: ClinicalRecordSummaryProps) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="border-b">
        <CardTitle className="type-section-title">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <dl className="grid grid-cols-2 divide-x divide-y border-border sm:grid-cols-4">
          {items.map((item) => {
            const Icon = icons[item.kind];
            return (
              <div className="flex min-w-0 flex-col gap-2 p-3" key={item.kind}>
                <Icon className="text-primary size-4" aria-hidden />
                <dt className="text-muted-foreground text-xs">{item.label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {item.value}
                </dd>
              </div>
            );
          })}
        </dl>
        {latestCheck ? (
          <div className="mt-4 border-t pt-4">
            <p className="text-muted-foreground text-xs">{latestCheckLabel}</p>
            <p className="mt-1 line-clamp-2 text-sm font-medium">
              {latestCheck}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
