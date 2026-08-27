import Image from "next/image";
import Link from "next/link";
import { ShieldCheckIcon } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden lg:grid lg:grid-cols-2">
      <div className="relative hidden min-h-0 flex-col overflow-hidden border-r border-white/10 bg-[#0b2e28] p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_45%)]"
        />
        <Link href="/" className="relative inline-flex items-center gap-3">
          <span className="bg-primary flex size-10 items-center justify-center rounded-xl">
            <ShieldCheckIcon className="size-5 text-white" aria-hidden />
          </span>
          <span className="text-xl font-semibold tracking-tight">JivaHQ</span>
        </Link>
        <div className="relative mt-auto max-w-md">
          <p className="text-3xl font-semibold leading-tight tracking-tight">
            Your Lifetime Digital Health Vault
          </p>
          <p className="mt-4 text-sm leading-7 text-teal-100/80">
            Securely access, manage, and share your comprehensive medical records across
            the healthcare ecosystem with military-grade encryption.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-teal-300/20 bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-50">
              ABDM Compliant
            </span>
            <span className="rounded-full border border-teal-300/20 bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-50">
              Blockchain Secured
            </span>
          </div>
        </div>
      </div>
      <div className="bg-page flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center-safe justify-center space-y-4 px-4 py-20 sm:px-6 lg:px-8">
          <Link href="/" className="lg:hidden">
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
          <div className="w-full rounded-2xl border bg-card p-6 shadow-sm sm:p-8">{children}</div>

          <p className="text-muted-foreground px-8 text-center text-sm">
            By clicking continue, you agree to our{" "}
            <Link
              href="/terms-of-service"
              className="hover:text-primary underline underline-offset-4"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy-policy"
              className="hover:text-primary underline underline-offset-4"
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
