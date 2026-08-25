import { grantConsentAction, revokeConsentAction } from '@/lib/actions';
import { DashboardCard } from '@/components/dashboard-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime, minutesUntil } from '@/lib/format';

export default async function SharePage() {
  const data = await getPatientWorkspace();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Consent sharing</h1>
        <p className="text-muted-foreground text-sm">
          Generate time-bound access codes for doctors.
        </p>
      </div>
      <section className="bg-border grid grid-cols-1 gap-px p-px xl:grid-cols-[0.75fr_1.25fr]">
        <DashboardCard className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>Generate access</CardTitle>
            <CardDescription>Default access is 2 hours, maximum 24 hours.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={grantConsentAction} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="doctorId">Doctor ID</FieldLabel>
                  <Input id="doctorId" name="doctorId" defaultValue="HPR-DEMO-1001" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="durationMinutes">Duration in minutes</FieldLabel>
                  <Input
                    id="durationMinutes"
                    name="durationMinutes"
                    type="number"
                    min={1}
                    max={1440}
                    defaultValue={120}
                  />
                </Field>
                <Button type="submit">Generate QR/PIN</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </DashboardCard>
        <DashboardCard className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>Active shares</CardTitle>
            <CardDescription>Revoke access immediately from this list.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableCaption className="sr-only">
                Active access codes and expiry information.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-6">Code</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="pe-6 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activeConsents.map((consent) => (
                  <TableRow className="h-12" key={consent.id}>
                    <TableCell className="ps-6 font-mono font-medium">{consent.code}</TableCell>
                    <TableCell>{formatDateTime(consent.grantedAt)}</TableCell>
                    <TableCell className="tabular-nums">
                      {minutesUntil(consent.expiresAt)} min
                    </TableCell>
                    <TableCell className="pe-6 text-right">
                      <form action={revokeConsentAction}>
                        <input type="hidden" name="consentId" value={consent.id} />
                        <Button type="submit" variant="destructive" size="sm">
                          Revoke
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {data.activeConsents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground ps-6">
                      No active consent links.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </DashboardCard>
        <DashboardCard className="gap-0 xl:col-span-2">
          <CardContent className="flex items-center gap-2">
            <Badge variant="secondary">Demo doctor code: JIVA-DEMO</Badge>
            <p className="text-muted-foreground text-sm">
              Scan or enter an active code in the doctor portal.
            </p>
          </CardContent>
        </DashboardCard>
      </section>
    </div>
  );
}
