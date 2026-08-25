import { cn } from '@/lib/utils';

function Tabs({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="tabs" className={cn('flex flex-col gap-3', className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="tablist"
      data-slot="tabs-list"
      className={cn('bg-muted inline-flex w-fit rounded-md p-1', className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      role="tab"
      data-slot="tabs-trigger"
      className={cn(
        'data-[state=active]:bg-background rounded px-3 py-1.5 text-sm font-medium',
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="tabpanel"
      data-slot="tabs-content"
      className={cn('outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
