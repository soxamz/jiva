import {
  AlertTriangleIcon,
  HeartPulseIcon,
  PhoneIcon,
  PillIcon,
  ShieldAlertIcon,
} from 'lucide-react';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getEmergencyAccessData, isConsentAccessError } from '@/lib/dal';
import { formatDateTime, minutesUntil } from '@/lib/format';
import { getI18n } from '@/lib/i18n';

export default async function EmergencyAccessPage({
  params,
}: PageProps<'/emergency/access/[code]'>) {
  const { code } = await params;
  let data: Awaited<ReturnType<typeof getEmergencyAccessData>>;

  try {
    data = await getEmergencyAccessData(code);
  } catch (error) {
    if (isConsentAccessError(error)) {
      redirect('/emergency');
    }

    throw error;
  }

  const { locale, t } = await getI18n();
  const profile = data.profile;
  const urgentIntakes = data.recentIntakes.filter((intake) => intake.redFlag);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-destructive flex items-center gap-2 text-sm font-medium">
            <ShieldAlertIcon className="size-4" aria-hidden />
            {t('emergencyView.breakGlassActive')}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">{data.patient.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('emergencyView.authorizedResponder', { name: data.viewer.name })}
          </p>
        </div>
        <Badge variant="destructive">
          {t('emergencyView.remaining', { count: minutesUntil(data.consent.expiresAt) })}
        </Badge>
      </div>

      <Card className="border-destructive/25">
        <CardHeader>
          <CardTitle>{t('emergencyView.criticalInformation')}</CardTitle>
          <CardDescription>{t('emergencyView.criticalInformationDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-sm">{t('emergencyCard.bloodType')}</p>
            <p className="mt-1 text-3xl font-semibold">
              {profile?.bloodType ?? t('dashboard.notAdded')}
            </p>
          </div>
          <EmergencyList
            icon={AlertTriangleIcon}
            label={t('dashboard.allergies')}
            values={profile?.allergies ?? []}
            empty={t('emergencyCard.noAllergies')}
            variant="destructive"
          />
          <EmergencyList
            icon={HeartPulseIcon}
            label={t('emergencyView.conditions')}
            values={profile?.criticalConditions ?? []}
            empty={t('emergencyCard.noneListed')}
          />
          <EmergencyList
            icon={PillIcon}
            label={t('dashboard.medicines')}
            values={profile?.currentMedications ?? []}
            empty={t('emergencyCard.noneListed')}
          />
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneIcon className="size-4" aria-hidden />
              {t('dashboard.emergencyContacts')}
            </CardTitle>
            <CardDescription>{t('emergencyView.contactsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {profile?.emergencyContacts.length ? (
              <ul className="flex flex-col gap-3">
                {profile.emergencyContacts.map((contact) => (
                  <li className="flex items-center justify-between gap-3" key={contact.phone}>
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-muted-foreground text-sm">{contact.relation}</p>
                    </div>
                    <span className="font-mono text-sm">{contact.phone}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">{t('dashboard.noEmergencyContacts')}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('emergencyView.recentAlerts')}</CardTitle>
            <CardDescription>{t('emergencyView.recentAlertsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {urgentIntakes.length ? (
              <ul className="flex flex-col gap-4">
                {urgentIntakes.map((intake) => (
                  <li key={intake.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{intake.chiefComplaint}</p>
                      <Badge variant="destructive">{t('doctor.redFlag')}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {formatDateTime(intake.createdAt, locale)}
                    </p>
                    <p className="mt-2 text-sm leading-6">{intake.summary}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">{t('emergencyView.noRecentAlerts')}</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function EmergencyList({
  icon: Icon,
  label,
  values,
  empty,
  variant = 'secondary',
}: Readonly<{
  icon: typeof PillIcon;
  label: string;
  values: string[];
  empty: string;
  variant?: 'secondary' | 'destructive';
}>) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length ? (
          values.map((value) => (
            <Badge key={value} variant={variant}>
              {value}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground text-sm">{empty}</span>
        )}
      </div>
    </div>
  );
}
