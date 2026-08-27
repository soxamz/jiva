import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type HistoryTimelineItem = {
  id: string;
  dateLabel: string;
  type: string;
  title: string;
};

const dotColors = [
  'bg-primary',
  'bg-amber-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-violet-500',
] as const;

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
    <Card className="patient-glass-card gap-0 rounded-3xl shadow-sm">
      <CardHeader className="border-b">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        ) : (
          <ol className="relative ms-2 flex flex-col gap-5 border-s border-border ps-5">
            {items.map((item, index) => (
              <li key={item.id} className="relative">
                <span
                  className={cn(
                    'absolute -start-[1.4rem] top-1.5 size-2.5 rounded-full border-2 border-background',
                    dotColors[index % dotColors.length]
                  )}
                  aria-hidden
                />
                <p className="text-muted-foreground text-xs tabular-nums">{item.dateLabel}</p>
                <p className="text-primary mt-0.5 text-xs font-semibold tracking-wide uppercase">
                  {item.type}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-5">{item.title}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
