import { cn } from '@/lib/utils';

export function DashboardSkeleton() {
  return (
    <div
      className={cn(
        'bg-border grid grid-cols-2 gap-px p-px lg:grid-cols-4',
        '*:bg-background/90 *:min-h-48 *:w-full'
      )}
    >
      <div />
      <div />
      <div />
      <div />
      <div className="col-span-2 min-h-114! lg:col-span-4" />
      <div className="col-span-2 min-h-92! lg:col-span-2" />
      <div className="col-span-2 min-h-92! lg:col-span-2" />
    </div>
  );
}
