import { cn } from '@/lib/utils';

function Progress({
  value,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  value: number;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      data-slot="progress"
      className={cn('bg-muted h-2 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <div
        className="bg-primary h-full rounded-full transition-all"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export { Progress };
