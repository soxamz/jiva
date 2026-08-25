import { redeemConsentAction } from '@/lib/actions';
import { DashboardCard } from '@/components/dashboard-card';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { requireUser } from '@/lib/dal';

export default async function DoctorPage() {
  const user = await requireUser(['doctor', 'responder']);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Doctor portal</h1>
        <p className="text-muted-foreground text-sm">
          Signed in as {user.name}. Redeem an active patient consent code.
        </p>
      </div>
      <section className="bg-border grid grid-cols-1 gap-px p-px lg:grid-cols-3">
        <DashboardCard className="gap-0 lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>Open patient record</CardTitle>
            <CardDescription>
              Use the patient-issued code to view a time-bound record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={redeemConsentAction} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="code">Consent code or PIN</FieldLabel>
                  <Input
                    id="code"
                    name="code"
                    className="font-mono uppercase"
                    defaultValue="JIVA-DEMO"
                    required
                  />
                </Field>
                <Button type="submit">Access patient summary</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </DashboardCard>
        <DashboardCard className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>Demo access</CardTitle>
            <CardDescription>For the seeded doctor account.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold">JIVA-DEMO</p>
            <p className="text-muted-foreground mt-2 text-sm">
              The patient can revoke the code from consent sharing at any time.
            </p>
          </CardContent>
        </DashboardCard>
      </section>
    </div>
  );
}
