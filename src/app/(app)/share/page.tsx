import { revokeConsentAction } from '@/lib/actions';
import { ConsentForm } from '@/components/forms/consent-form';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime, minutesUntil } from '@/lib/format';
import { getI18n } from '@/lib/i18n';

export default async function SharePage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader description={t('share.description')} title={t('share.title')} />
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t('share.create')}</CardTitle>
            <CardDescription>{t('share.createDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ConsentForm />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t('share.people')}</CardTitle>
            <CardDescription>{t('share.peopleDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.activeConsents.length ? (
              data.activeConsents.map((consent) => (
                <div
                  className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  key={consent.id}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-lg font-semibold tracking-wide">{consent.code}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {t('share.granted')}: {formatDateTime(consent.grantedAt, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="info">
                      {t('dashboard.minutesLeft', { count: minutesUntil(consent.expiresAt) })}
                    </StatusPill>
                    <form action={revokeConsentAction}>
                      <input type="hidden" name="consentId" value={consent.id} />
                      <Button type="submit" variant="destructive" size="sm">
                        {t('share.stop')}
                      </Button>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">{t('share.none')}</p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm xl:col-span-2">
          <CardContent className="flex flex-wrap items-center gap-2 py-5">
            <Badge variant="secondary">Demo doctor ID: HPR-DEMO-1001</Badge>
            <p className="text-muted-foreground text-sm">
              The doctor can enter the active access code in their portal.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
