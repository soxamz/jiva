"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulseIcon } from "lucide-react";

import {
  getFooterNavLinks,
  getNavGroups,
  type AppShellUser,
} from "@/components/app-shared";
import { LatestChange } from "@/components/latest-change";
import { NavGroup } from "@/components/nav-group";
import { useI18n } from "@/components/i18n-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar({ user }: { user: AppShellUser }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const homeHref =
    user.role === "patient"
      ? "/dashboard"
      : user.role === "responder"
        ? "/emergency"
        : "/doctor";
  const navGroups = getNavGroups(user.role, pathname, t);
  const footerNavLinks = getFooterNavLinks(user.role, pathname, t);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="h-16 justify-center border-b px-3">
        <SidebarMenuButton
          className="h-auto flex-col items-start gap-1 px-2 py-2"
          render={<Link aria-label={t("sidebar.home")} href={homeHref} />}
          tooltip={t("sidebar.home")}
        >
          <Image
            alt="Jiva"
            className="h-auto w-28 max-w-none dark:hidden"
            height={28}
            src="/logo.svg"
            width={112}
          />
          <Image
            alt="Jiva"
            className="hidden h-auto w-28 max-w-none dark:block"
            height={28}
            src="/logo-dark.svg"
            width={112}
          />
          <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase group-data-[collapsible=icon]:hidden">
            {t("sidebar.badge")}
          </span>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <NavGroup key={group.label} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-0 p-0">
        {user.role === "patient" ? (
          <div className="bg-primary/10 text-primary mx-3 mb-3 rounded-2xl border border-primary/15 p-4 transition-opacity group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0">
            <HeartPulseIcon className="size-4" aria-hidden />
            <p className="type-section-title mt-2">
              {t("dashboard.checkSymptoms")}
            </p>
            <p className="type-card-body mt-1">
              {t("dashboard.checkSymptomsDescription")}
            </p>
            <Link
              className="bg-primary text-primary-foreground mt-3 inline-flex h-8 w-full items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors hover:bg-primary/90 focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none"
              href="/intake"
            >
              {t("dashboard.check")}
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
          <Image
            alt="JivaHQ"
            className="h-auto w-16 max-w-none dark:hidden"
            height={21}
            src="/brand.svg"
            width={64}
          />
          <Image
            alt="JivaHQ"
            className="hidden h-auto w-16 max-w-none dark:block"
            height={21}
            src="/brand-dark.svg"
            width={64}
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
