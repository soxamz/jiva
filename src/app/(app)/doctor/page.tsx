import { DoctorConsentForm } from '@/components/doctor-consent-form';
import { DashboardCard } from '@/components/dashboard-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/dal';
import { getI18n } from '@/lib/i18n';

export default async function DoctorPage({ searchParams }: PageProps<'/doctor'>) {
  const user = await requireUser(['doctor', 'responder']);
  const { t } = await getI18n();
  const { access } = await searchParams;
  const accessError =
    access === 'assigned_to_another_clinician'
      ? t('doctor.accessBoundMessage')
      : access === 'access_unavailable'
        ? t('doctor.accessUnavailableMessage')
        : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">{t('doctor.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('doctor.signedIn', { name: user.name })}</p>
      </div>
      {accessError && (
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-2xl border px-4 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium">{t('doctor.accessDeniedTitle')}</p>
          <p className="mt-1">{accessError}</p>
        </div>
      )}
      <section className="bg-border grid grid-cols-1 gap-px p-px lg:grid-cols-3">
        <DashboardCard className="gap-0 lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>{t('doctor.openRecord')}</CardTitle>
            <CardDescription>{t('doctor.openRecordDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <DoctorConsentForm />
          </CardContent>
        </DashboardCard>
        <DashboardCard className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>{t('doctor.doctorId')}</CardTitle>
            <CardDescription>{t('doctor.doctorIdDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold">
              {user.doctorId ?? t('doctor.notAssigned')}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">{t('doctor.revokeNotice')}</p>
          </CardContent>
        </DashboardCard>
      </section>
    </div>
  );
}
