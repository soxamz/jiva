'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeartPulseIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getFooterNavLinks, getNavGroups, type AppShellUser } from '@/components/app-shared';
import { LatestChange } from '@/components/latest-change';
import { NavGroup } from '@/components/nav-group';
import { useI18n } from '@/components/i18n-provider';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function AppSidebar({ user }: { user: AppShellUser }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const homeHref =
    user.role === 'patient' ? '/dashboard' : user.role === 'responder' ? '/emergency' : '/doctor';
  const navGroups = getNavGroups(user.role, pathname, t);
  const footerNavLinks = getFooterNavLinks(user.role, pathname, t);

  return (
    <Sidebar
      className={cn(
        user.role === 'patient'
          ? 'patient-glass-sidebar'
          : '*:data-[slot=sidebar-inner]:bg-background',
        '**:data-[slot=sidebar-menu-button]:[&>span]:text-foreground/75'
      )}
      collapsible="icon"
      variant="sidebar"
    >
      <SidebarHeader className="h-14 justify-center border-b px-2">
        <SidebarMenuButton
          render={<Link aria-label={t('sidebar.home')} href={homeHref} />}
          tooltip={t('sidebar.home')}
        >
          <img src="/logo.svg" alt="Jiva" className="h-auto w-28 max-w-none dark:hidden" />
          <img
            src="/logo-dark.svg"
            alt="Jiva"
            className="hidden h-auto w-28 max-w-none dark:block"
          />
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <NavGroup key={group.label} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-0 p-0">
        {user.role === 'patient' ? (
          <div className="to-primary text-primary-foreground mx-3 mb-3 rounded-2xl bg-linear-to-b from-black p-3 transition-opacity group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0">
            <HeartPulseIcon className="size-4" aria-hidden />
            <p className="mt-2 text-sm font-semibold">{t('dashboard.checkSymptoms')}</p>
            <p className="text-primary-foreground/80 mt-1 text-xs leading-4">
              {t('dashboard.checkSymptomsDescription')}
            </p>
            <Link
              className="text-primary mt-3 inline-flex h-8 w-full items-center justify-center rounded-xl bg-white px-3 text-xs font-medium transition-colors hover:bg-sky-50 focus-visible:ring-3 focus-visible:ring-white/70 focus-visible:outline-none"
              href="/intake"
            >
              {t('dashboard.check')}
            </Link>
          </div>
        ) : (
          <LatestChange />
        )}
        <SidebarMenu className="border-t p-2">
          {footerNavLinks.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                className="text-muted-foreground"
                isActive={item.isActive}
                size="sm"
                tooltip={item.title}
                render={<Link href={item.path} />}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <div className="px-4 pt-4 pb-2 transition-opacity group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0">
          <p className="text-muted-foreground text-[9px] text-nowrap">JivaHQ SIH demo</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
