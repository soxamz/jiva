import Link from 'next/link';
import { Fingerprint, ShieldAlert } from 'lucide-react';

import { breakGlassAction } from '@/lib/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function EmergencyPage() {
  return (
    <div className="grid gap-5">
      <div className="text-center">
        <div className="bg-destructive/10 text-destructive mx-auto mb-3 flex size-10 items-center justify-center rounded-md">
          <ShieldAlert className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold">Emergency Break-Glass</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Mock responder flow. Every access is logged as an immutable audit event.
        </p>
      </div>
      <Alert variant="destructive">
        <Fingerprint className="size-4" aria-hidden="true" />
        <AlertTitle>Demo biometric override</AlertTitle>
        <AlertDescription>
          Use patient phone 9876543210 or Aadhaar 123412341234 to open a 1-hour emergency view.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Responder terminal</CardTitle>
          <CardDescription>Provide a patient identifier and reason code.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={breakGlassAction} className="grid gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">Patient phone or Aadhaar</FieldLabel>
                <Input
                  id="identifier"
                  name="identifier"
                  inputMode="numeric"
                  defaultValue="9876543210"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="reason">Emergency reason</FieldLabel>
                <Textarea id="reason" name="reason" defaultValue="Trauma/unconscious patient" />
              </Field>
              <Button type="submit">Initiate audited access</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Link
        href="/sign-in"
        className={buttonVariants({ variant: 'link', className: 'justify-self-center' })}
      >
        Return to sign in
      </Link>
    </div>
  );
}
