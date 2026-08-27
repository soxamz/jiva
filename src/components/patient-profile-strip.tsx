import { UserRoundIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type PatientProfileStripProps = {
  name: string;
  subtitle?: string;
  imageUrl?: string | null;
  className?: string;
};

export function PatientProfileStrip({
  name,
  subtitle,
  imageUrl,
  className,
}: PatientProfileStripProps) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-12 shrink-0 rounded-full border object-cover"
          src={imageUrl}
        />
      ) : (
        <span className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-full border">
          {initials || <UserRoundIcon className="size-5" aria-hidden />}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold">{name}</p>
        {subtitle ? (
          <p className="text-muted-foreground truncate text-sm">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
