import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import type { AppShellUser } from "@/components/app-shared";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getI18n } from "@/lib/i18n";

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
      <AppSidebar user={user} />
      <SidebarInset
        className="!w-0 min-w-0 overflow-x-clip"
        id="main-content"
        tabIndex={-1}
      >
        <AppHeader user={user} />
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col p-4 focus:outline-none md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
