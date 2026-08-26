import Link from 'next/link';
import {
  ActivityIcon,
  AlertTriangleIcon,
  FileTextIcon,
  HeartPulseIcon,
  PhoneIcon,
  PillIcon,
  QrCodeIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime, minutesUntil } from '@/lib/format';
import { getI18n } from '@/lib/i18n';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';

function DashboardAction({
  href,
  title,
  description,
  icon: Icon,
  actionLabel,
  variant = 'secondary',
}: Readonly<{
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ 'aria-hidden'?: boolean }>;
  actionLabel: string;
  variant?: 'default' | 'secondary';
}>) {
  return (
    <Item variant="outline" className="h-full">
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemHeader>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription>{description}</ItemDescription>
        </ItemContent>
      </ItemHeader>
      <ItemActions>
        <Link href={href} className={buttonVariants({ size: 'sm', variant })}>
          {actionLabel}
        </Link>
      </ItemActions>
    </Item>
  );
}

export default async function DashboardPage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();
  const latestIntake = data.intakeSessions[0];
  const urgentIntakes = data.intakeSessions.filter((intake) => intake.redFlag).length;
  const healthCompleteness =
    (data.profile?.bloodType ? 25 : 0) +
    ((data.profile?.allergies?.length ?? 0) > 0 ? 25 : 0) +
    ((data.profile?.currentMedications?.length ?? 0) > 0 ? 25 : 0) +
    ((data.profile?.emergencyContacts?.length ?? 0) > 0 ? 25 : 0);
  const medications = data.profile?.currentMedications ?? [];
  const allergies = data.profile?.allergies ?? [];
  const emergencyContacts = data.profile?.emergencyContacts ?? [];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{t('dashboard.healthSpace')}</p>
          <h1 className="text-2xl font-semibold">
            {t('dashboard.hello', { name: data.user.name })}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('dashboard.readyForVisit')}</p>
        </div>
        <Link href="/emergency-card" className={buttonVariants({ variant: 'outline' })}>
          <ShieldCheckIcon data-icon="inline-start" aria-hidden />
          {t('dashboard.emergencyCard')}
        </Link>
      </section>

      <section className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Item variant="outline" className="h-full">
          <ItemMedia variant="icon">
            <FileTextIcon aria-hidden />
          </ItemMedia>
          <ItemHeader>
            <ItemContent>
              <ItemTitle className="text-2xl">{data.documents.length}</ItemTitle>
              <ItemDescription>{t('dashboard.medicalRecords')}</ItemDescription>
            </ItemContent>
          </ItemHeader>
          <ItemActions>
            <Link
              href="/documents"
              className={buttonVariants({ size: 'sm', variant: 'secondary' })}
            >
              {t('dashboard.addOrViewRecords')}
            </Link>
          </ItemActions>
        </Item>
        <Item variant="outline" className="h-full">
          <ItemMedia variant="icon">
            <ShieldCheckIcon aria-hidden />
          </ItemMedia>
          <ItemHeader>
            <ItemContent>
              <ItemTitle className="text-2xl">
                {t('dashboard.ready', { percent: healthCompleteness })}
              </ItemTitle>
              <ItemDescription>{t('dashboard.emergencyInformation')}</ItemDescription>
            </ItemContent>
          </ItemHeader>
          <ItemActions>
            <Link
              href="/emergency-card"
              className={buttonVariants({ size: 'sm', variant: 'secondary' })}
            >
              {t('dashboard.checkDetails')}
            </Link>
          </ItemActions>
        </Item>
        <Item variant="outline" className="h-full">
          <ItemMedia variant="icon">
            <QrCodeIcon aria-hidden />
          </ItemMedia>
          <ItemHeader>
            <ItemContent>
              <ItemTitle className="text-2xl">
                {data.activeConsents.length === 0
                  ? t('dashboard.noAccess')
                  : t('dashboard.activeAccess', { count: data.activeConsents.length })}
              </ItemTitle>
              <ItemDescription>{t('dashboard.doctorAccess')}</ItemDescription>
            </ItemContent>
          </ItemHeader>
          <ItemActions>
            <Link href="/share" className={buttonVariants({ size: 'sm' })}>
              {t('dashboard.shareRecords')}
            </Link>
          </ItemActions>
        </Item>
        <DashboardAction
          actionLabel={t('dashboard.add')}
          description={t('dashboard.addMedicalRecordDescription')}
          href="/documents"
          icon={FileTextIcon}
          title={t('dashboard.addMedicalRecord')}
        />
        <DashboardAction
          actionLabel={t('dashboard.check')}
          description={t('dashboard.checkSymptomsDescription')}
          href="/intake"
          icon={HeartPulseIcon}
          title={t('dashboard.checkSymptoms')}
          variant="default"
        />
        <DashboardAction
          actionLabel={t('dashboard.shareRecords')}
          description={t('dashboard.shareWithDoctorDescription')}
          href="/share"
          icon={QrCodeIcon}
          title={t('dashboard.shareWithDoctor')}
        />
      </section>

      <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.recentUpdates')}</CardTitle>
              <CardDescription>{t('dashboard.recentUpdatesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {data.timeline.length > 0 ? (
                <ul className="divide-border flex flex-col divide-y">
                  {data.timeline.slice(0, 4).map((item) => (
                    <li className="flex items-start gap-2 px-4 py-4" key={item.id}>
                      <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
                        {item.type === 'intake' ? (
                          <ActivityIcon aria-hidden />
                        ) : (
                          <FileTextIcon aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.title}</p>
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                          {item.body}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {formatDateTime(item.date, locale)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground px-4 text-sm">{t('dashboard.noUpdates')}</p>
              )}
            </CardContent>
            <CardFooter>
              <Link
                href="/timeline"
                className={buttonVariants({ size: 'sm', variant: 'secondary' })}
              >
                {t('dashboard.viewUpdates')}
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.latestSymptomCheck')}</CardTitle>
              <CardDescription>{t('dashboard.latestSymptomDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {latestIntake ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={latestIntake.redFlag ? 'destructive' : 'success'}>
                      {latestIntake.redFlag ? t('dashboard.needsAttention') : t('dashboard.saved')}
                    </Badge>
                    <span className="text-muted-foreground text-sm">
                      {latestIntake.chiefComplaint}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-6">{latestIntake.summary}</p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t('dashboard.noSymptomCheck')}</p>
              )}
            </CardContent>
            <CardFooter>
              <Link href="/intake" className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
                {t('dashboard.checkSymptoms')}
              </Link>
            </CardFooter>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.importantInformation')}</CardTitle>
              <CardDescription>{t('dashboard.importantInformationDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-sm">{t('dashboard.bloodGroup')}</span>
                <strong className="text-2xl">
                  {data.profile?.bloodType ?? t('dashboard.notAdded')}
                </strong>
              </div>
              <ul className="divide-border flex flex-col divide-y">
                <li className="flex items-start gap-2 py-4">
                  <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <PillIcon aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{t('dashboard.medicines')}</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {medications.length > 0 ? (
                        medications.slice(0, 3).map((medication) => (
                          <Badge key={medication} variant="secondary">
                            {medication}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {t('dashboard.noMedicines')}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-2 py-4">
                  <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <AlertTriangleIcon aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{t('dashboard.allergies')}</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {allergies.length > 0 ? (
                        allergies.map((allergy) => <Badge key={allergy}>{allergy}</Badge>)
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {t('dashboard.noAllergies')}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="gap-2">
              <Link
                href="/health-information"
                className={buttonVariants({ size: 'sm', variant: 'secondary' })}
              >
                {t('dashboard.editHealthInformation')}
              </Link>
              <Link
                href="/emergency-card"
                className={buttonVariants({ size: 'sm', variant: 'secondary' })}
              >
                {t('dashboard.openEmergencyCard')}
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PhoneIcon aria-hidden />
                <CardTitle>{t('dashboard.emergencyContacts')}</CardTitle>
              </div>
              <CardDescription>{t('dashboard.emergencyContactsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {emergencyContacts.length > 0 ? (
                <ul className="divide-border flex flex-col divide-y">
                  {emergencyContacts.slice(0, 2).map((contact) => (
                    <li
                      className="flex items-center justify-between gap-3 px-5 py-3"
                      key={contact.phone}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{contact.name}</p>
                        <p className="text-muted-foreground text-sm">{contact.relation}</p>
                      </div>
                      <span className="text-muted-foreground shrink-0 font-mono text-sm">
                        {contact.phone}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground px-5 text-sm">
                  {t('dashboard.noEmergencyContacts')}
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Link
                href="/health-information"
                className={buttonVariants({ size: 'sm', variant: 'secondary' })}
              >
                {t('dashboard.updateContacts')}
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.recordAccess')}</CardTitle>
              <CardDescription>{t('dashboard.recordAccessDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {data.activeConsents.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {data.activeConsents.slice(0, 2).map((consent) => (
                    <li className="flex items-center justify-between gap-3" key={consent.id}>
                      <span className="font-mono font-medium">{consent.code}</span>
                      <span className="text-muted-foreground text-sm">
                        {t('dashboard.minutesLeft', { count: minutesUntil(consent.expiresAt) })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-3">
                  <PhoneIcon aria-hidden />
                  <p className="text-muted-foreground text-sm">{t('dashboard.noDoctorAccess')}</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Link href="/share" className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
                {t('dashboard.manageAccess')}
              </Link>
            </CardFooter>
          </Card>
        </div>
      </section>

      {urgentIntakes > 0 && (
        <p className="text-destructive text-sm">{t('dashboard.urgentNotice')}</p>
      )}
    </div>
  );
}
