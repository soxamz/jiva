import Image from "next/image";
import Link from "next/link";
import { ShieldCheckIcon, LockIcon, AwardIcon } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden lg:grid lg:grid-cols-2 bg-slate-50">
      {/* Desktop Left Side Branding Banner */}
      <div className="relative hidden min-h-0 flex-col justify-between overflow-hidden bg-gradient-to-b from-[#0D5F5A] via-[#094743] to-[#062e2c] p-12 text-white lg:flex">
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-teal-200 text-xs font-bold backdrop-blur-sm">
            <ShieldCheckIcon className="size-4 text-teal-300" />
            <span>Healthcare Unified Platform</span>
          </div>

          <h2 className="text-3xl font-black leading-tight tracking-tight text-white">
            Your Lifetime Digital Health Vault
          </h2>
          <p className="text-sm leading-relaxed text-teal-100/90 font-medium">
            Seamlessly connect patients and doctors with time-limited consent, AI-powered intake summaries, and ABDM-compliant record management.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/30 bg-teal-400/10 px-3.5 py-1.5 text-xs font-extrabold text-teal-100">
              <AwardIcon className="size-3.5" />
              ABDM Certified
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/30 bg-teal-400/10 px-3.5 py-1.5 text-xs font-extrabold text-teal-100">
              <LockIcon className="size-3.5" />
              Break-Glass Ready
            </span>
          </div>
        </div>

        <div className="relative z-10 text-xs text-teal-200/70 font-medium">
          © {new Date().getFullYear()} JivaHQ Health Vault Systems. All rights reserved.
        </div>
      </div>

      {/* Auth Form Container Right */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain bg-slate-50">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center space-y-5 px-4 py-12 sm:px-6">
          <Link href="/" className="lg:hidden mx-auto">
            <Image
              alt="Jiva"
              className="h-auto w-28 dark:hidden"
              height={28}
              src="/logo.svg"
              width={112}
            />
            <Image
              alt="Jiva"
              className="hidden h-auto w-28 dark:block"
              height={28}
              src="/logo-dark.svg"
              width={112}
            />
          </Link>

          <div className="w-full rounded-[24px] border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl">
            {children}
          </div>

          <p className="text-slate-400 px-6 text-center text-xs font-medium">
            By logging in, you agree to the{" "}
            <Link
              href="/terms-of-service"
              className="hover:text-slate-800 text-slate-600 underline underline-offset-4 font-semibold"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy-policy"
              className="hover:text-slate-800 text-slate-600 underline underline-offset-4 font-semibold"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
