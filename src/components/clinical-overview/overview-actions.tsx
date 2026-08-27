'use client';

import Link from 'next/link';
import { FilePlus2Icon, PrinterIcon } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function OverviewActions({
  printLabel,
  noteLabel,
}: {
  printLabel: string;
  noteLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => window.print()}
      >
        <PrinterIcon data-icon="inline-start" />
        {printLabel}
      </Button>
      <Link
        href="/intake"
        className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
      >
        <FilePlus2Icon data-icon="inline-start" />
        {noteLabel}
      </Link>
    </div>
  );
}
