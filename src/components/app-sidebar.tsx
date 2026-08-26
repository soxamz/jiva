'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { LogoIcon } from '@/components/logo';
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
  const homeHref = user.role === 'patient' ? '/dashboard' : '/doctor';
  const navGroups = getNavGroups(user.role, pathname, t);
  const footerNavLinks = getFooterNavLinks(user.role, pathname, t);

  return (
    <Sidebar
      className={cn(
        '*:data-[slot=sidebar-inner]:bg-background',
        '*:data-[slot=sidebar-inner]:dark:bg-[radial-gradient(60%_18%_at_10%_0%,--theme(--color-foreground/.08),transparent)]',
        '**:data-[slot=sidebar-menu-button]:[&>span]:text-foreground/75'
      )}
      collapsible="icon"
      variant="sidebar"
    >
      <SidebarHeader className="h-14 justify-center border-b px-2">
        <SidebarMenuButton render={<Link href={homeHref} />} tooltip={t('sidebar.home')}>
          <LogoIcon />
          <span className="text-foreground! font-medium">JivaHQ</span>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <NavGroup key={group.label} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-0 p-0">
        <LatestChange />
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
