import type { LucideIcon } from 'lucide-react';
import { ActivityIcon, FileTextIcon } from 'lucide-react';

import { StatusPill } from '@/components/status-pill';
import { cn } from '@/lib/utils';

export type ClinicalTimelineItem = {
  id: string;
  title: string;
  body: string;
  dateLabel: string;
  status?: string;
  redFlag?: boolean;
  type?: 'intake' | 'document' | string;
};

type ClinicalTimelineProps = {
  items: ClinicalTimelineItem[];
  emptyMessage?: string;
  compact?: boolean;
  className?: string;
};

function iconForType(type?: string): LucideIcon {
  return type === 'intake' ? ActivityIcon : FileTextIcon;
}

function toneForItem(item: ClinicalTimelineItem): 'critical' | 'info' | 'success' | 'neutral' {
  if (item.redFlag) return 'critical';
  if (item.type === 'intake') return 'info';
  if (item.type === 'document') return 'success';
  return 'neutral';
}

export function ClinicalTimeline({
  items,
  emptyMessage,
  compact = false,
  className,
}: ClinicalTimelineProps) {
  if (!items.length) {
    return emptyMessage ? (
      <p className="text-muted-foreground px-1 text-sm">{emptyMessage}</p>
    ) : null;
  }

  return (
    <ol className={cn('relative flex flex-col gap-0', className)}>
      <span
        aria-hidden
        className="bg-border absolute top-2 bottom-2 left-[1.125rem] w-px"
      />
      {items.map((item, index) => {
        const Icon = iconForType(item.type);
        const tone = toneForItem(item);
        return (
          <li
            className={cn('relative grid grid-cols-[2.25rem_1fr] gap-x-4', compact ? 'py-3' : 'py-4')}
            key={item.id}
          >
            <span
              className={cn(
                'relative z-10 flex size-9 items-center justify-center rounded-xl border bg-card shadow-sm',
                tone === 'critical' && 'border-clinical-critical/30 text-clinical-critical',
                tone === 'info' && 'border-clinical-info/30 text-clinical-info',
                tone === 'success' && 'border-clinical-success/30 text-clinical-success',
                tone === 'neutral' && 'text-muted-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <article
              className={cn(
                'min-w-0 rounded-2xl border bg-card p-4 shadow-sm',
                item.redFlag && 'border-clinical-critical/25',
                index === items.length - 1 && 'mb-0',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug">{item.title}</h3>
                {item.status ? (
                  <StatusPill tone={tone}>{item.status}</StatusPill>
                ) : item.redFlag ? (
                  <StatusPill tone="critical">Needs attention</StatusPill>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-6">
                {item.body.replaceAll('**', '').replaceAll('\n', ' ')}
              </p>
              <p className="text-primary mt-2 text-xs font-medium">{item.dateLabel}</p>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
