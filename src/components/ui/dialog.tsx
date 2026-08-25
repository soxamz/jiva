import { cn } from '@/lib/utils';

function Dialog({ className, ...props }: React.ComponentProps<'dialog'>) {
  return (
    <dialog
      data-slot="dialog"
      className={cn(
        'bg-background text-foreground rounded-md border p-0 shadow-lg backdrop:bg-black/40',
        className
      )}
      {...props}
    />
  );
}

function DialogContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-content" className={cn('max-w-lg p-5', className)} {...props} />;
}

export { Dialog, DialogContent };
