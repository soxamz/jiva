import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type HistoryTimelineItem = {
  id: string;
  dateLabel: string;
  type: string;
  title: string;
};

export function HistoryTimeline({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  description?: string;
  emptyLabel: string;
  items: HistoryTimelineItem[];
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="border-b">
        <CardTitle className="type-section-title">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {items.length === 0 ? (
          <p className="type-card-body">{emptyLabel}</p>
        ) : (
          <ol className="relative ms-2 flex flex-col gap-5 border-s border-border ps-5">
            {items.map((item, index) => (
              <li key={item.id} className="relative">
                <span
                  className={cn(
                    "absolute -start-[1.4rem] top-1.5 size-2.5 rounded-full border-2 border-background",
                    index === 0 ? "bg-primary" : "bg-muted-foreground",
                  )}
                  aria-hidden
                />
                <p className="type-meta tabular-nums">
                  {item.dateLabel}
                </p>
                <p className="text-primary type-eyebrow mt-0.5">
                  {item.type}
                </p>
                <p className="type-card-body mt-1">
                  {item.title}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
