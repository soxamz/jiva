import Link from 'next/link';
import { BellIcon } from 'lucide-react';

import { signOutAction } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { AppBreadcrumbs } from '@/components/app-breadcrumbs';
import { type AppShellUser } from '@/components/app-shared';
import { CustomSidebarTrigger } from '@/components/custom-sidebar-trigger';
import { DecorIcon } from '@/components/decor-icon';
import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ModeToggle } from './mode-toggle';
import { LanguageToggle } from './language-toggle';
import { getI18n } from '@/lib/i18n';

export async function AppHeader({ user }: { user: AppShellUser }) {
  const { t } = await getI18n();
  const isPatient = user.role === 'patient';
  const activityHref = isPatient ? '/access-log' : '/emergency';
  const activityLabel = isPatient ? t('header.openAccessLog') : t('header.openEmergencyAccess');

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6',
        isPatient
          ? 'patient-glass-header'
          : 'bg-background/95 supports-backdrop-filter:bg-background/50 backdrop-blur-sm'
      )}
    >
      <DecorIcon className="hidden md:block" position="bottom-left" />
      <div className="flex min-w-0 items-center gap-3">
        <CustomSidebarTrigger />
        <Separator
          className="mr-2 h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <AppBreadcrumbs
          page={{ title: isPatient ? t('nav.patientDashboard') : t('header.clinicalWorkspace') }}
        />
      </div>
      <div className="hidden items-center gap-2 lg:flex">
        <Link
          aria-label={activityLabel}
          className={buttonVariants({ size: 'icon-sm', variant: 'outline' })}
          href={activityHref}
          title={activityLabel}
        >
          <BellIcon data-icon="only" />
        </Link>
        <LanguageToggle />
        <ModeToggle />
        <form action={signOutAction}>
          <Button size="sm" type="submit" variant="outline">
            {t('header.signOut')}
          </Button>
        </form>
      </div>
    </header>
  );
}
