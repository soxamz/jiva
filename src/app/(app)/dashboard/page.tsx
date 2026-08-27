import Link from 'next/link';
import {
  ActivityIcon,
  ArrowRightIcon,
  FileTextIcon,
  HeartPulseIcon,
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
import { formatDateTime } from '@/lib/format';
import { getI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type DashboardLinkCardProps = {
  href: string;
  title: string;
  description: string;
  actionLabel: string;
  icon: typeof FileTextIcon;
  iconClassName: string;
};

function DashboardLinkCard({
  href,
  title,
  description,
  actionLabel,
  icon: Icon,
  iconClassName,
}: Readonly<DashboardLinkCardProps>) {
  return (
    <Link
      href={href}
      className="patient-bento-action group focus-visible:ring-ring/30 border-border/70 flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3.5 transition-[background-color,color] focus-visible:ring-3 focus-visible:outline-none"
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          iconClassName
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">{description}</span>
      </span>
      <span className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium group-hover:underline">
        {actionLabel}
        <ArrowRightIcon className="size-3" aria-hidden />
      </span>
    </Link>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  href,
  actionLabel,
  children,
  iconClassName = 'bg-sky-50 text-primary dark:bg-sky-950/40',
  className,
}: Readonly<{
  icon: typeof FileTextIcon;
  label: string;
  value?: React.ReactNode;
  href: string;
  actionLabel: string;
  children?: React.ReactNode;
  iconClassName?: string;
  className?: string;
}>) {
  return (
    <Card
      className={cn(
        'patient-glass-card min-h-40 min-w-0 overflow-hidden rounded-3xl py-5 [--card-spacing:--spacing(5)]',
        className
      )}
    >
      <CardContent className="flex h-full flex-col">
        <span className={cn('flex size-9 items-center justify-center rounded-xl', iconClassName)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <p className="text-muted-foreground mt-3 text-sm">{label}</p>
        {value !== undefined && (
          <p className="mt-1 text-2xl font-semibold tracking-normal text-balance">{value}</p>
        )}
        {children}
        <Link
          href={href}
          className={cn(
            buttonVariants({ size: 'xs', variant: 'secondary' }),
            'mt-auto h-8 w-full justify-center rounded-xl'
          )}
        >
          {actionLabel}
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();
  const medications = data.profile?.currentMedications ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1240px] min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-balance sm:text-4xl">
            {t('dashboard.hello', { name: data.user.name })}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('dashboard.readyForVisit')}</p>
        </div>
        <Link
          href="/health-information"
          className={cn(
            buttonVariants({ size: 'sm', variant: 'outline' }),
            'w-full rounded-xl sm:w-auto'
          )}
        >
          {t('dashboard.editHealthInformation')}
        </Link>
      </section>

      <section className="grid min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="patient-primary-summary min-h-40 min-w-0 rounded-3xl py-5 shadow-none [--card-spacing:--spacing(5)]">
          <CardContent className="flex h-full flex-col">
            <span className="bg-primary-foreground/15 flex size-10 items-center justify-center rounded-2xl">
              <HeartPulseIcon className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-lg font-semibold">{t('dashboard.checkSymptoms')}</p>
            <p className="text-primary-foreground/80 mt-1 text-xs leading-5">
              {t('dashboard.checkSymptomsDescription')}
            </p>
            <Link
              href="/intake"
              className="text-primary mt-auto inline-flex h-8 w-full items-center justify-center rounded-xl bg-white px-3 text-xs font-medium transition-colors hover:bg-sky-50 focus-visible:ring-3 focus-visible:ring-white/70 focus-visible:outline-none"
            >
              {t('dashboard.check')}
            </Link>
          </CardContent>
        </Card>
        <SummaryCard
          actionLabel={t('dashboard.manageAccess')}
          href="/share"
          icon={QrCodeIcon}
          iconClassName="bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
          label={t('dashboard.doctorAccess')}
          value={
            data.activeConsents.length === 0
              ? t('dashboard.noAccess')
              : t('dashboard.activeAccess', { count: data.activeConsents.length })
          }
        />
        <SummaryCard
          actionLabel={t('dashboard.addOrViewRecords')}
          href="/documents"
          icon={FileTextIcon}
          iconClassName="bg-sky-50 text-primary dark:bg-sky-950/40"
          label={t('dashboard.medicalRecords')}
          value={data.documents.length}
        />
        <SummaryCard
          actionLabel={t('dashboard.editHealthInformation')}
          href="/health-information"
          icon={PillIcon}
          iconClassName="bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
          label={t('dashboard.medicines')}
        >
          <div className="mt-2 flex min-h-10 flex-wrap content-start gap-1.5">
            {medications.length ? (
              medications.slice(0, 2).map((medication) => (
                <Badge className="max-w-full truncate" key={medication} variant="secondary">
                  {medication}
                </Badge>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">{t('dashboard.noMedicines')}</p>
            )}
          </div>
        </SummaryCard>
      </section>

      <section className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.75fr)]">
        <Card className="patient-glass-card min-w-0 rounded-3xl">
          <CardHeader className="pt-5">
            <CardTitle>{t('dashboard.recentUpdates')}</CardTitle>
            <CardDescription>{t('dashboard.recentUpdatesDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {data.timeline.length ? (
              <ul className="divide-border flex flex-col divide-y">
                {data.timeline.slice(0, 3).map((item) => (
                  <li className="flex min-w-0 items-start gap-3 px-5 py-4" key={item.id}>
                    <span
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl',
                        item.type === 'intake'
                          ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                          : 'text-primary bg-sky-50 dark:bg-sky-950/40'
                      )}
                    >
                      {item.type === 'intake' ? (
                        <ActivityIcon className="size-4" aria-hidden />
                      ) : (
                        <FileTextIcon className="size-4" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <p className="truncate font-medium">{item.title}</p>
                        {item.redFlag && (
                          <Badge className="shrink-0" variant="destructive">
                            {t('dashboard.needsAttention')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-5">
                        {item.body.replaceAll('**', '').replaceAll('\n', ' ')}
                      </p>
                      <p className="text-primary mt-1.5 text-xs font-medium">
                        {formatDateTime(item.date, locale)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground px-5 text-sm">{t('dashboard.noUpdates')}</p>
            )}
          </CardContent>
          <CardFooter className="pb-5">
            <Link
              href="/timeline"
              className={cn(
                buttonVariants({ size: 'sm', variant: 'secondary' }),
                'w-full rounded-xl'
              )}
            >
              {t('dashboard.viewUpdates')}
              <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </Link>
          </CardFooter>
        </Card>

        <aside className="flex min-w-0 flex-col gap-4" aria-label={t('dashboard.quickActions')}>
          <Card className="patient-glass-card rounded-3xl py-5 [--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle>{t('dashboard.quickActions')}</CardTitle>
              <CardDescription>{t('dashboard.quickActionsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="mt-3 flex flex-col gap-2">
              <DashboardLinkCard
                actionLabel={t('dashboard.add')}
                description={t('dashboard.addMedicalRecordDescription')}
                href="/documents"
                icon={FileTextIcon}
                iconClassName="bg-sky-50 text-primary dark:bg-sky-950/40"
                title={t('dashboard.addMedicalRecord')}
              />
              <DashboardLinkCard
                actionLabel={t('dashboard.shareRecords')}
                description={t('dashboard.shareWithDoctorDescription')}
                href="/share"
                icon={QrCodeIcon}
                iconClassName="bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                title={t('dashboard.shareWithDoctor')}
              />
              <DashboardLinkCard
                actionLabel={t('nav.accessLog')}
                description={t('dashboard.recordAccessDescription')}
                href="/access-log"
                icon={ActivityIcon}
                iconClassName="bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
                title={t('dashboard.recordAccess')}
              />
              <DashboardLinkCard
                actionLabel={t('dashboard.checkDetails')}
                description={t('dashboard.emergencyInformation')}
                href="/emergency-card"
                icon={ShieldCheckIcon}
                iconClassName="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                title={t('dashboard.emergencyCard')}
              />
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
