import type { LucideIcon } from 'lucide-react';
import { DropletIcon, HeartPulseIcon, ShieldAlertIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type CriticalInfoItem = {
  label: string;
  value: string;
  detail?: string;
  tone?: 'critical' | 'warning' | 'neutral';
  icon?: LucideIcon;
};

type CriticalInfoBarProps = {
  items: CriticalInfoItem[];
  className?: string;
};

const defaultIcons: Record<NonNullable<CriticalInfoItem['tone']>, LucideIcon> = {
  critical: ShieldAlertIcon,
  warning: DropletIcon,
  neutral: HeartPulseIcon,
};

const toneClasses: Record<NonNullable<CriticalInfoItem['tone']>, string> = {
  critical: 'border-clinical-critical/30 bg-clinical-critical/5',
  warning: 'border-clinical-warning/30 bg-clinical-warning/5',
  neutral: 'border-border bg-card',
};

export function CriticalInfoBar({ items, className }: CriticalInfoBarProps) {
  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {items.map((item) => {
        const tone = item.tone ?? 'neutral';
        const Icon = item.icon ?? defaultIcons[tone];
        return (
          <div
            className={cn('rounded-2xl border p-4 shadow-sm', toneClasses[tone])}
            key={`${item.label}-${item.value}`}
          >
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
              <Icon className="size-4 shrink-0" aria-hidden />
              <span>{item.label}</span>
            </div>
            <p className="mt-2 text-xl font-semibold tracking-tight">{item.value}</p>
            {item.detail ? (
              <p className="text-muted-foreground mt-1 text-sm">{item.detail}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
