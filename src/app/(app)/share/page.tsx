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
import { getI18n } from '@/lib/i18n';

export default async function SharePage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('share.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('share.description')}</p>
      </div>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <DashboardCard className="gap-0">
          <CardHeader>
            <CardTitle>{t('share.create')}</CardTitle>
            <CardDescription>{t('share.createDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={grantConsentAction} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="doctorId">{t('share.doctorId')}</FieldLabel>
                  <Input id="doctorId" name="doctorId" defaultValue="HPR-DEMO-1001" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="durationMinutes">{t('share.duration')}</FieldLabel>
                  <Input
                    id="durationMinutes"
                    name="durationMinutes"
                    type="number"
                    min={1}
                    max={1440}
                    defaultValue={120}
                  />
                </Field>
                <Button type="submit">{t('share.createCode')}</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </DashboardCard>
        <DashboardCard className="gap-0">
          <CardHeader>
            <CardTitle>{t('share.people')}</CardTitle>
            <CardDescription>{t('share.peopleDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableCaption className="sr-only">
                Active access codes and expiry information.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-6">Code</TableHead>
                  <TableHead>{t('share.granted')}</TableHead>
                  <TableHead>{t('share.expires')}</TableHead>
                  <TableHead className="pe-6 text-right">{t('share.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activeConsents.map((consent) => (
                  <TableRow className="h-12" key={consent.id}>
                    <TableCell className="ps-6 font-mono font-medium">{consent.code}</TableCell>
                    <TableCell>{formatDateTime(consent.grantedAt, locale)}</TableCell>
                    <TableCell className="tabular-nums">
                      {t('dashboard.minutesLeft', { count: minutesUntil(consent.expiresAt) })}
                    </TableCell>
                    <TableCell className="pe-6 text-right">
                      <form action={revokeConsentAction}>
                        <input type="hidden" name="consentId" value={consent.id} />
                        <Button type="submit" variant="destructive" size="sm">
                          {t('share.stop')}
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {data.activeConsents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground ps-6">
                      {t('share.none')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </DashboardCard>
        <DashboardCard className="gap-0 xl:col-span-2">
          <CardContent className="flex items-center gap-2">
            <Badge variant="secondary">Demo doctor ID: HPR-DEMO-1001</Badge>
            <p className="text-muted-foreground text-sm">
              The doctor can enter the active access code in their portal.
            </p>
          </CardContent>
        </DashboardCard>
      </section>
    </div>
  );
}
