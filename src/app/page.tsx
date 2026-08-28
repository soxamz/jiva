import Image from "next/image";
import Link from "next/link";
import {
  HeartPulseIcon,
  ShieldAlertIcon,
  StethoscopeIcon,
  UserPlusIcon,
  UserRoundIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type PortalLinkProps = {
  href: string;
  title: string;
  description: string;
  icon: typeof UserRoundIcon;
  tone?: "default" | "destructive";
};

function PortalLink({
  href,
  title,
  description,
  icon: Icon,
  tone = "default",
}: Readonly<PortalLinkProps>) {
  return (
    <Link className="group block h-full focus-visible:outline-none" href={href}>
      <Card className="h-full transition-colors group-hover:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardContent className="flex min-h-30 flex-col items-center justify-center gap-2 px-4 py-5 text-center">
          <span
            className={cn(
              "bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full",
              tone === "destructive" && "bg-destructive/10 text-destructive",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs leading-5">
            {description}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function Page() {
  const { t } = await getI18n();

  return (
    <main className="bg-background">
      <div className="grid lg:grid-cols-2 h-screen">
        <section className="relative flex min-h-80 flex-col overflow-hidden border-r border-white/10 bg-[#0b2e28] px-6 py-7 text-white sm:px-10 sm:py-9 lg:min-h-full lg:px-12 lg:py-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_45%)]"
          />
          <Link
            aria-label="JivaHQ"
            className="relative inline-flex w-fit items-center"
            href="/"
          >
            <Image
              alt="JivaHQ"
              className="h-auto w-28"
              height={28}
              src="/logo-dark.svg"
              width={112}
            />
          </Link>

          <div className="relative my-auto max-w-md py-12 lg:py-0">
            <Badge
              className="rounded-full border-teal-300/20 bg-teal-400/10 text-teal-50"
              variant="outline"
            >
              <HeartPulseIcon data-icon="inline-start" aria-hidden />
              Health vault
            </Badge>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Your lifetime digital health vault
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-teal-100/80">
              Securely access, manage, and share your health information when it
              matters.
            </p>
          </div>

          <div className="relative flex flex-wrap gap-2">
            <Badge
              className="rounded-full border-teal-300/20 bg-teal-400/10 text-teal-50"
              variant="outline"
            >
              Secure consent controls
            </Badge>
            <Badge
              className="rounded-full border-teal-300/20 bg-teal-400/10 text-teal-50"
              variant="outline"
            >
              Emergency-ready information
            </Badge>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-xl">
            <div className="mb-7 text-center">
              <p className="text-sm font-medium">Welcome to JivaHQ</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Choose how you want to continue
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Select a portal to access the right workspace.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <PortalLink
                description="Access your health records and manage sharing."
                href="/sign-in/patient"
                icon={UserRoundIcon}
                title={t("auth.patient")}
              />
              <PortalLink
                description="Open patient records shared with your care team."
                href="/sign-in/doctor"
                icon={StethoscopeIcon}
                title={t("auth.doctor")}
              />
              <PortalLink
                description="Use audited emergency access for urgent care."
                href="/emergency"
                icon={ShieldAlertIcon}
                title={t("auth.emergencyResponder")}
                tone="destructive"
              />
              <PortalLink
                description="Register a demo patient, doctor, or responder profile."
                href="/sign-up"
                icon={UserPlusIcon}
                title={t("auth.createAccount")}
              />
            </div>

            <p className="text-muted-foreground mt-6 text-center text-sm">
              Already registered?{" "}
              <Link
                className="text-primary font-medium hover:underline"
                href="/sign-in"
              >
                {t("auth.signIn")}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
