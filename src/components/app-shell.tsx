import { AppHeader } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import type { AppShellUser } from '@/components/app-shared';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export function AppShell({ user, children }: { user: AppShellUser; children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="min-w-0">
        <AppHeader user={user} />
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
