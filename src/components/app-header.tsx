import Link from "next/link";
import { BellIcon } from "lucide-react";

import { signOutAction } from "@/lib/actions";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { type AppShellUser } from "@/components/app-shared";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "./mode-toggle";
import { LanguageToggle } from "./language-toggle";
import { getI18n } from "@/lib/i18n";

export async function AppHeader({ user }: { user: AppShellUser }) {
  const { t } = await getI18n();
  const isPatient = user.role === "patient";
  const activityHref = isPatient ? "/access-log" : "/emergency";
  const activityLabel = isPatient
    ? t("header.openAccessLog")
    : t("header.openEmergencyAccess");
  const profileId = user.doctorId ?? user.phoneMasked;

  return (
    <header className="bg-card/90 sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <CustomSidebarTrigger />
        <Separator
          className="mr-2 h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <AppBreadcrumbs
          page={{
            title: isPatient
              ? t("nav.patientDashboard")
              : t("header.clinicalWorkspace"),
          }}
        />
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          aria-label={activityLabel}
          className={buttonVariants({ size: "icon-sm", variant: "outline" })}
          href={activityHref}
          title={activityLabel}
        >
          <BellIcon data-icon="only" />
        </Link>
        <LanguageToggle />
        <ModeToggle />
        <Separator className="hidden h-6 sm:block" orientation="vertical" />
        <div className="hidden min-w-0 text-right sm:block">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-muted-foreground truncate text-xs">{profileId}</p>
        </div>
        <form action={signOutAction} className="hidden lg:block">
          <Button size="sm" type="submit" variant="outline">
            {t("header.signOut")}
          </Button>
        </form>
      </div>
    </header>
  );
}
