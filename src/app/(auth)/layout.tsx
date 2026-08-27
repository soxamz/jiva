import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden lg:grid lg:grid-cols-2">
      <div className="bg-muted relative hidden min-h-0 flex-col border-r p-8 lg:flex">
        <Link href="/" className="inline-flex items-center">
          <Image
            alt="Jiva"
            className="h-auto w-32 dark:hidden"
            height={32}
            src="/logo.svg"
            width={128}
          />
          <Image
            alt="Jiva"
            className="hidden h-auto w-32 dark:block"
            height={32}
            src="/logo-dark.svg"
            width={128}
          />
        </Link>
        <div className="mt-auto max-w-sm">
          <p className="text-lg font-semibold">
            Your health records, in one place.
          </p>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Access your information, share it when needed, and keep your
            emergency details ready.
          </p>
        </div>
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain">
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
          {children}

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
