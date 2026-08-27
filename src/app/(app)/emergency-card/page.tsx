import Link from 'next/link';
import { PhoneIcon, ShieldCheckIcon } from 'lucide-react';

import { CriticalInfoBar } from '@/components/critical-info-bar';
import { PageHeader } from '@/components/page-header';
import { PatientProfileStrip } from '@/components/patient-profile-strip';
import { StatusPill } from '@/components/status-pill';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';
import { getI18n } from '@/lib/i18n';

export default async function EmergencyCardPage() {
  const data = await getPatientWorkspace();
  const { t } = await getI18n();
  const profile = data.profile;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        actions={
          <Link href="/health-information" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            {t('dashboard.editHealthInformation')}
          </Link>
        }
        description={t('emergencyCard.description')}
        title={t('emergencyCard.title')}
      />

      <Card className="rounded-2xl border-primary/20 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <PatientProfileStrip name={data.user.name} subtitle={t('emergencyCard.verifiedDescription')} />
          <StatusPill tone="success">
            <ShieldCheckIcon className="size-3.5" aria-hidden />
            {t('emergencyCard.verified')}
          </StatusPill>
        </CardContent>
      </Card>

      <CriticalInfoBar
        items={[
          {
            label: t('emergencyCard.bloodType'),
            value: profile?.bloodType ?? 'NA',
            tone: 'warning',
          },
          {
            label: t('dashboard.allergies'),
            value:
              (profile?.allergies ?? []).length > 0
                ? (profile?.allergies ?? []).join(', ')
                : t('emergencyCard.noAllergies'),
            tone: 'critical',
          },
          {
            label: t('health.criticalConditions'),
            value:
              (profile?.criticalConditions ?? []).length > 0
                ? (profile?.criticalConditions ?? []).join(', ')
                : t('emergencyCard.noneListed'),
            tone: 'neutral',
          },
        ]}
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t('health.currentMedicines')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(profile?.currentMedications ?? []).length ? (
              profile?.currentMedications.map((medication) => (
                <Badge key={medication} variant="secondary">
                  {medication}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">{t('emergencyCard.noneListed')}</Badge>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PhoneIcon aria-hidden />
              <CardTitle>{t('dashboard.emergencyContacts')}</CardTitle>
            </div>
            <CardDescription>{t('dashboard.emergencyContactsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
              {(profile?.emergencyContacts ?? []).map((contact) => (
                <li key={contact.phone} className="flex flex-col gap-1 px-6 py-4">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-muted-foreground text-sm">{contact.relation}</p>
                  <a className="font-mono text-sm text-primary hover:underline" href={`tel:${contact.phone}`}>
                    {contact.phone}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
