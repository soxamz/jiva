import { headers } from 'next/headers';

import { revokeConsentAction } from '@/lib/actions';
import { PageHeader } from '@/components/page-header';
import { PatientShareQr } from '@/components/share/patient-share-qr';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime } from '@/lib/format';
import { getI18n } from '@/lib/i18n';

function getAppUrl(requestHeaders: Headers) {
  const configuredUrl = process.env.JIVA_APP_URL?.trim().replace(/\/$/, '');
  if (configuredUrl) return configuredUrl;

  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';
  return host ? `${protocol}://${host}` : 'http://localhost:3000';
}

export default async function SharePage() {
  const [data, { locale, t }, requestHeaders] = await Promise.all([
    getPatientWorkspace(),
    getI18n(),
    headers(),
  ]);
  const shareUrl = data.shareToken
    ? `${getAppUrl(requestHeaders)}/share/scan/${data.shareToken}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description={t('share.description')}
        title={t('share.title')}
      />
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t('share.create')}</CardTitle>
            <CardDescription>{t('share.createDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {shareUrl ? (
              <PatientShareQr
                downloadPngLabel={t('share.downloadPng')}
                downloadSvgLabel={t('share.downloadSvg')}
                loadingLabel={t('share.qrLoading')}
                value={shareUrl}
              />
            ) : (
              <p className="text-muted-foreground text-sm">{t('share.none')}</p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t('share.people')}</CardTitle>
            <CardDescription>{t('share.peopleDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.activeConsents.length ? (
              data.activeConsents.map(({ consent, doctor }) => (
                <div
                  className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={consent.id}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{doctor.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {t('share.doctorId')}: {doctor.doctorId ?? '-'}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {t('share.granted')}:{' '}
                      {formatDateTime(consent.grantedAt, locale)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {t('share.lastAuthenticated')}:{' '}
                      {consent.lastAuthenticatedAt
                        ? formatDateTime(consent.lastAuthenticatedAt, locale)
                        : '-'}
                    </p>
                  </div>
                  <form action={revokeConsentAction}>
                    <input name="consentId" type="hidden" value={consent.id} />
                    <Button size="sm" type="submit" variant="outline">
                      {t('share.stop')}
                    </Button>
                  </form>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">{t('share.none')}</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
