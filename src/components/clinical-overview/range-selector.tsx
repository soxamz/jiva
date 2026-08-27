import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { OVERVIEW_RANGES, type OverviewRangeDays } from '@/lib/week-clinical-overview';
import { cn } from '@/lib/utils';

export function OverviewRangeSelector({
  days,
  labels,
}: {
  days: OverviewRangeDays;
  labels: Record<OverviewRangeDays, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Overview time range">
      {OVERVIEW_RANGES.map((range) => {
        const active = range === days;
        return (
          <Link
            key={range}
            href={`/clinical-overview?range=${range}`}
            className={cn(
              buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' }),
              'rounded-full'
            )}
            aria-current={active ? 'page' : undefined}
          >
            {labels[range]}
          </Link>
        );
      })}
    </div>
  );
}
