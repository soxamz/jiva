import Image from "next/image";
import Link from "next/link";
import {
  AwardIcon,
  FlaskConicalIcon,
  LockIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";

import { getI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type PortalLinkProps = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone?: "default" | "emergency";
  disabled?: boolean;
};

function PortalLink({
  href,
  title,
  description,
  icon: Icon,
  disabled = false,
  tone = "default",
}: Readonly<PortalLinkProps>) {
  const content = (
    <div
      className={cn(
        "flex min-h-36 flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-5 py-6 text-center shadow-sm transition-colors",
        !disabled && "group-hover:border-teal-300 group-hover:bg-teal-50/40",
        disabled && "bg-slate-50 text-slate-400",
      )}
    >
      <span
        className={cn(
          "mb-4 flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-[#0D5F5A]",
          tone === "emergency" && "bg-rose-50 text-rose-600",
          disabled && "bg-slate-100 text-slate-400",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-52 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );

  if (disabled) {
    return (
      <div aria-disabled="true" className="cursor-not-allowed">
        {content}
      </div>
    );
  }

  return (
    <Link
      className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D5F5A] focus-visible:ring-offset-2"
      href={href}
    >
      {content}
    </Link>
  );
}

function BrandPanel() {
  return (
    <section className="relative hidden min-h-0 flex-col justify-between overflow-hidden bg-gradient-to-b from-[#0D5F5A] via-[#094743] to-[#062e2c] p-12 text-white lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.2),transparent_50%)]"
      />
      <Link href="/" className="relative inline-flex items-center">
        <Image
          alt="JivaHQ"
          className="h-auto w-36"
          height={36}
          src="/logo-dark.svg"
          width={144}
        />
      </Link>

      <div className="relative z-10 my-auto max-w-md space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-teal-200 backdrop-blur-sm">
          <ShieldCheckIcon className="size-4 text-teal-300" aria-hidden />
          <span>Healthcare Unified Platform</span>
        </div>
        <h1 className="text-3xl font-black leading-tight tracking-tight text-white">
          Your Lifetime Digital Health Vault
        </h1>
        <p className="text-sm font-medium leading-relaxed text-teal-100/90">
          Seamlessly connect patients and doctors with time-limited consent,
          AI-powered intake summaries, and ABDM-compliant record management.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/30 bg-teal-400/10 px-3.5 py-1.5 text-xs font-extrabold text-teal-100">
            <AwardIcon className="size-3.5" aria-hidden />
            ABDM Certified
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/30 bg-teal-400/10 px-3.5 py-1.5 text-xs font-extrabold text-teal-100">
            <LockIcon className="size-3.5" aria-hidden />
            Break-Glass Ready
          </span>
        </div>
      </div>

      <p className="relative z-10 text-xs font-medium text-teal-200/70">
        (c) {new Date().getFullYear()} JivaHQ Health Vault Systems. All rights
        reserved.
      </p>
    </section>
  );
}

export default async function Page() {
  const { t } = await getI18n();

  return (
    <main className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-2">
      <BrandPanel />

      <section className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          <Link className="mx-auto mb-10 flex w-fit lg:hidden" href="/">
            <Image
              alt="JivaHQ"
              className="h-auto w-28"
              height={28}
              src="/logo.svg"
              width={112}
            />
          </Link>

          <div className="text-center">
            <p className="text-xs font-bold uppercase text-[#0D5F5A]">
              Welcome to JivaHQ
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              Choose your portal
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Select the workspace that matches your role.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <PortalLink
              description="Access your health records and manage sharing."
              href="/sign-in/patient"
              icon={UserRoundIcon}
              title={t("auth.patient")}
            />
            <PortalLink
              description="Open records shared with your care team."
              href="/sign-in/doctor"
              icon={StethoscopeIcon}
              title={t("auth.doctor")}
            />
            <PortalLink
              description="Use audited emergency access for urgent care."
              href="/emergency"
              icon={ShieldAlertIcon}
              title={t("auth.emergencyResponder")}
              tone="emergency"
            />
            <PortalLink
              description={t("auth.labDescription")}
              href="#"
              icon={FlaskConicalIcon}
              title={t("auth.lab")}
              disabled
            />
          </div>

          <p className="mt-7 text-center text-sm text-slate-500">
            Already registered?{" "}
            <Link
              className="font-semibold text-[#0D5F5A] hover:underline"
              href="/sign-in"
            >
              {t("auth.signIn")}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
