'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function Page() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm text-muted-foreground">JivaHQ</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Lifetime Digital Health Vault
        </h1>
        <p className="mt-3 text-muted-foreground">
          Intelligent clinical intake — adaptive SOCRATES interview with voice,
          rule-based red flags, and physician draft summaries.
        </p>
      </div>
      <Link href="/clinical-intake">
        <Button type="button">Start clinical intake</Button>
      </Link>
    </main>
  );
}
