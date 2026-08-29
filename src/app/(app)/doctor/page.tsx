import { QrCodeIcon } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireUser } from '@/lib/dal';
import { getI18n } from '@/lib/i18n';
import { MobileDoctor } from '@/components/mobile/mobile-doctor';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DoctorPage({
  searchParams,
}: PageProps) {
  const user = await requireUser(['doctor']);
  const { t } = await getI18n();
  const { access } = await searchParams;
  const accessError =
    access === 'assigned_to_another_clinician'
      ? t('doctor.accessBoundMessage')
      : access === 'access_unavailable'
        ? t('doctor.accessUnavailableMessage')
        : null;

  return (
    <>
      {/* Mobile view */}
      <MobileDoctor user={user} accessError={accessError} />

      {/* Desktop view */}
      <div className="hidden md:flex flex-col gap-6">
        <PageHeader
          description={t('doctor.signedIn', { name: user.name })}
          title={t('doctor.title')}
        />
        {accessError && (
          <Alert variant="destructive">
            <AlertTitle>{t('doctor.accessDeniedTitle')}</AlertTitle>
            <AlertDescription>{accessError}</AlertDescription>
          </Alert>
        )}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl shadow-sm lg:col-span-2">
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                  <QrCodeIcon className="size-5" aria-hidden />
                </span>
                <div>
                  <CardTitle>{t('doctor.openRecord')}</CardTitle>
                  <CardDescription>
                    {t('doctor.openRecordDescription')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 text-sm">
              <p className="text-muted-foreground max-w-xl leading-6">
                {t('doctor.openRecordDescription')}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="border-b">
              <CardTitle>{t('doctor.doctorId')}</CardTitle>
              <CardDescription>{t('doctor.doctorIdDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-semibold">
                {user.doctorId ?? t('doctor.notAssigned')}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                {t('doctor.revokeNotice')}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="border-b">
              <CardTitle>{t('doctor.consultationHours')}</CardTitle>
              <CardDescription>
                {t('doctor.consultationHoursDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {t('doctor.morningConsultation')}
                </span>
                <span className="font-medium">10:00 - 13:00</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {t('doctor.eveningConsultation')}
                </span>
                <span className="font-medium">17:00 - 20:00</span>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
