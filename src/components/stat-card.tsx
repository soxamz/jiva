import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value?: React.ReactNode;
  href?: string;
  actionLabel?: string;
  iconClassName?: string;
  className?: string;
  children?: React.ReactNode;
  highlight?: boolean;
};

export function StatCard({
  icon: Icon,
  label,
  value,
  href,
  actionLabel,
  iconClassName = 'bg-muted text-muted-foreground',
  className,
  children,
  highlight = false,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'min-h-40 min-w-0 rounded-2xl border shadow-sm',
        highlight && 'border-primary/20 bg-primary text-primary-foreground',
        className,
      )}
    >
      <CardContent className="flex h-full flex-col p-5">
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-xl',
            highlight ? 'bg-primary-foreground/15 text-primary-foreground' : iconClassName,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <p
          className={cn(
            'mt-3 text-sm font-medium',
            highlight ? 'text-primary-foreground/90' : 'text-muted-foreground',
          )}
        >
          {label}
        </p>
        {value !== undefined ? (
          <p
            className={cn(
              'mt-1 text-2xl font-semibold tracking-tight',
              highlight && 'text-primary-foreground',
            )}
          >
            {value}
          </p>
        ) : null}
        {children}
        {href && actionLabel ? (
          <Link
            href={href}
            className={cn(
              buttonVariants({
                size: 'sm',
                variant: highlight ? 'secondary' : 'secondary',
              }),
              'mt-auto w-full justify-center',
              highlight && 'bg-primary-foreground text-primary hover:bg-primary-foreground/90',
            )}
          >
            {actionLabel}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
