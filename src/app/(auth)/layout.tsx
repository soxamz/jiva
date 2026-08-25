import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden lg:grid lg:grid-cols-2">
      <div className="relative hidden min-h-0 flex-col overflow-hidden p-8 lg:flex">
        <img
          src="https://i.pinimg.com/1200x/58/2f/50/582f50f37da10956a760473d74f85c48.jpg"
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover opacity-85 dark:brightness-[0.2]"
        />
        <Link href="/" className="relative z-20 inline-flex items-center text-2xl">
          JIVA
        </Link>
        <div className="relative z-20 mt-auto rounded-2xl p-2 shadow-xl backdrop-blur-sm">
          Welcome to Panery, where local food ecosystems thrive. Our mission is to empower local
          food producers and agents by providing a seamless platform to connect, collaborate, and
          grow together.
        </div>
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center-safe justify-center space-y-4 px-4 py-20 sm:px-6 lg:px-8">
          <Link href="/" className="lg:hidden">
            JIVA
          </Link>
          {children}

          <p className="text-muted-foreground px-8 text-center text-sm">
            By clicking continue, you agree to our{' '}
            <Link
              href="/terms-of-service"
              className="hover:text-primary underline underline-offset-4"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
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
