'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

const latestChange = {
  badge: 'HEALTH VAULT',
  title: 'Consent controls',
  description: 'Grant and revoke access.',
  readMore: { href: '/share', label: 'Open sharing' },
} as const;

export function LatestChange() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        'group/latest-change size-full min-h-27 justify-center border-t',
        'relative flex size-full flex-col gap-1 overflow-hidden px-4 pt-3 pb-1 *:text-nowrap',
        'transition-opacity group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0'
      )}
    >
      <span className="text-muted-foreground font-mono text-[10px] font-light">
        {latestChange.badge}
      </span>
      <p className="text-xs font-medium">{latestChange.title}</p>
      <span className="text-muted-foreground text-[10px]">{latestChange.description}</span>
      <Button
        className="w-max px-0 text-xs font-light"
        size="sm"
        variant="link"
        render={<Link href={latestChange.readMore.href} />}
        nativeButton={false}
      >
        {latestChange.readMore.label}
      </Button>
      <Button
        className="absolute top-2 right-2 z-10 size-6 rounded-full opacity-0 transition-opacity group-hover/latest-change:opacity-100"
        onClick={() => setIsOpen(false)}
        size="icon-sm"
        variant="ghost"
      >
        <XIcon className="text-muted-foreground size-3.5" />{' '}
      </Button>
    </div>
  );
}
