import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import type { AppShellUser } from "@/components/app-shared";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getI18n } from "@/lib/i18n";
import { MobileNav } from "@/components/mobile/mobile-nav";

export async function AppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: React.ReactNode;
}) {
  const { t } = await getI18n();
  return (
    <SidebarProvider>
      <a
        className="bg-primary text-primary-foreground focus-visible:ring-ring/50 fixed top-3 left-3 z-1000 -translate-y-20 rounded-lg px-3 py-2 text-sm font-medium transition-transform focus:translate-y-0 focus-visible:ring-3 focus-visible:outline-none"
        href="#main-content"
      >
        {t("header.skipToContent")}
      </a>
      <div className="hidden md:block shrink-0">
        <AppSidebar user={user} />
      </div>
      <SidebarInset
        className="!w-0 min-w-0 overflow-x-clip"
        id="main-content"
        tabIndex={-1}
      >
        <div className="hidden md:block shrink-0">
          <AppHeader user={user} />
        </div>
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-0 md:p-6 focus:outline-none">
          {children}
        </div>
        <MobileNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
