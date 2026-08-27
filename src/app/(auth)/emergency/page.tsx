import Link from 'next/link';
import { Fingerprint, ShieldAlert } from 'lucide-react';

import { BreakGlassForm } from '@/components/forms/break-glass-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getI18n } from '@/lib/i18n';

export default async function EmergencyPage() {
  const { t } = await getI18n();

  return (
    <div className="grid gap-5">
      <div className="text-center">
        <div className="bg-destructive/10 text-destructive mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-destructive/20">
          <ShieldAlert className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold">{t('emergency.title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('emergency.description')}</p>
      </div>
      <Alert className="rounded-2xl" variant="destructive">
        <Fingerprint className="size-4" aria-hidden="true" />
        <AlertTitle>{t('emergency.override')}</AlertTitle>
        <AlertDescription>{t('emergency.overrideDescription')}</AlertDescription>
      </Alert>
      <Card className="rounded-2xl border-destructive/20 bg-[#1a1414] text-white shadow-lg dark:bg-[#1a1414]">
        <CardHeader>
          <CardTitle className="text-destructive">{t('emergency.terminal')}</CardTitle>
          <CardDescription className="text-white/70">
            {t('emergency.terminalDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BreakGlassForm />
        </CardContent>
      </Card>
      <Link
        href="/sign-in"
        className={buttonVariants({ variant: 'link', className: 'justify-self-center' })}
      >
        {t('emergency.returnToSignIn')}
      </Link>
    </div>
  );
}
