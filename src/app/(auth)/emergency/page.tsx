import Link from 'next/link';
import { Fingerprint, ShieldAlert } from 'lucide-react';

import { breakGlassAction } from '@/lib/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getI18n } from '@/lib/i18n';

export default async function EmergencyPage() {
  const { t } = await getI18n();

  return (
    <div className="grid gap-5">
      <div className="text-center">
        <div className="bg-destructive/10 text-destructive mx-auto mb-3 flex size-10 items-center justify-center rounded-md">
          <ShieldAlert className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold">{t('emergency.title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('emergency.description')}</p>
      </div>
      <Alert variant="destructive">
        <Fingerprint className="size-4" aria-hidden="true" />
        <AlertTitle>{t('emergency.override')}</AlertTitle>
        <AlertDescription>{t('emergency.overrideDescription')}</AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>{t('emergency.terminal')}</CardTitle>
          <CardDescription>{t('emergency.terminalDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={breakGlassAction} className="grid gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">{t('emergency.patientIdentifier')}</FieldLabel>
                <Input
                  id="identifier"
                  name="identifier"
                  inputMode="numeric"
                  defaultValue="9876543210"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="reason">{t('emergency.reason')}</FieldLabel>
                <Textarea id="reason" name="reason" defaultValue="Trauma/unconscious patient" />
              </Field>
              <Button type="submit">{t('emergency.initiate')}</Button>
            </FieldGroup>
          </form>
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
