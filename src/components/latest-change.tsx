'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { XIcon } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';

export function LatestChange() {
  const { t } = useI18n();
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
        {t('sidebar.badge')}
      </span>
      <p className="text-xs font-medium">{t('sidebar.consentControls')}</p>
      <span className="text-muted-foreground text-[10px]">{t('sidebar.consentDescription')}</span>
      <Link
        className={cn(
          buttonVariants({ size: 'sm', variant: 'link' }),
          'w-max px-0 text-xs font-light'
        )}
        href="/share"
      >
        {t('sidebar.openSharing')}
      </Link>
      <Button
        aria-label={`Dismiss ${t('sidebar.consentControls')}`}
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
