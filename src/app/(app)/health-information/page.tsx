import Link from 'next/link';
import { ShieldCheckIcon } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { buttonVariants } from '@/components/ui/button';
import { MedicalProfileForm } from '@/components/forms/medical-profile-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';
import { getI18n } from '@/lib/i18n';

function displayList(values: string[] | undefined) {
  return values?.join(', ') ?? '';
}

import { MobileHealthInfo } from "@/components/mobile/mobile-health-info";

export default async function HealthInformationPage() {
  const { profile } = await getPatientWorkspace();
  const { t } = await getI18n();
  const emergencyContacts = (profile?.emergencyContacts ?? [])
    .map((contact) => `${contact.name} | ${contact.relation} | ${contact.phone}`)
    .join('\n');

  return (
    <>
      <MobileHealthInfo data={{ profile }} />

      <div className="hidden md:flex max-w-4xl flex-col gap-6">
        <PageHeader
          actions={
            <Link href="/emergency-card" className={buttonVariants({ variant: 'outline' })}>
              <ShieldCheckIcon data-icon="inline-start" aria-hidden />
              {t('health.viewEmergencyCard')}
            </Link>
          }
          description={t('health.description')}
          title={t('health.title')}
        />

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <p className="text-muted-foreground text-sm">{t('health.record')}</p>
            <CardTitle>{t('health.emergencyDetails')}</CardTitle>
            <CardDescription>{t('health.emergencyDetailsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <MedicalProfileForm
              allergies={displayList(profile?.allergies)}
              bloodType={profile?.bloodType ?? 'O+'}
              criticalConditions={displayList(profile?.criticalConditions)}
              currentMedications={displayList(profile?.currentMedications)}
              emergencyContacts={emergencyContacts}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

