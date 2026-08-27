import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type QuickActionCardProps = {
  href: string;
  title: string;
  description: string;
  actionLabel: string;
  icon: LucideIcon;
  iconClassName?: string;
};

export function QuickActionCard({
  href,
  title,
  description,
  actionLabel,
  icon: Icon,
  iconClassName,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="hover:bg-accent group flex min-w-0 items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition-colors focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none"
    >
      <span
        className={cn(
          'bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl',
          iconClassName,
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">{description}</span>
      </span>
      <span className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium group-hover:underline">
        {actionLabel}
        <ArrowRightIcon className="size-3" aria-hidden />
      </span>
    </Link>
  );
}
