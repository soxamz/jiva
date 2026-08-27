import Link from 'next/link';
import { ShieldCheckIcon } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { MedicalProfileForm } from '@/components/forms/medical-profile-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';
import { getI18n } from '@/lib/i18n';

function displayList(values: string[] | undefined) {
  return values?.join(', ') ?? '';
}

export default async function HealthInformationPage() {
  const { profile } = await getPatientWorkspace();
  const { t } = await getI18n();
  const emergencyContacts = (profile?.emergencyContacts ?? [])
    .map((contact) => `${contact.name} | ${contact.relation} | ${contact.phone}`)
    .join('\n');

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-muted-foreground text-sm">{t('health.record')}</p>
          <h1 className="text-2xl font-semibold">{t('health.title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('health.description')}</p>
        </div>
        <Link href="/emergency-card" className={buttonVariants({ variant: 'outline' })}>
          <ShieldCheckIcon data-icon="inline-start" aria-hidden />
          {t('health.viewEmergencyCard')}
        </Link>
      </section>

      <Card>
        <CardHeader>
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
  );
}
