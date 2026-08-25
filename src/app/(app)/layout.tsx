import { AppShell } from '@/components/app-shell';
import { getAppShellUser } from '@/lib/dal';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getAppShellUser();

  return <AppShell user={user}>{children}</AppShell>;
}
