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
  const latestIntake = data.intakeSessions[0];
  const urgentIntakes = data.intakeSessions.filter((intake) => intake.redFlag).length;
  const healthCompleteness =
    (data.profile?.bloodType ? 25 : 0) +
    ((data.profile?.allergies?.length ?? 0) > 0 ? 25 : 0) +
    ((data.profile?.currentMedications?.length ?? 0) > 0 ? 25 : 0) +
    ((data.profile?.emergencyContacts?.length ?? 0) > 0 ? 25 : 0);
  const medications = data.profile?.currentMedications ?? [];
  const allergies = data.profile?.allergies ?? [];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">Your health space</p>
          <h1 className="text-2xl font-semibold">Hello, {data.user.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Keep your records ready for the next doctor visit.
          </p>
        </div>
        <Link href="/emergency-card" className={buttonVariants({ variant: 'outline' })}>
          <ShieldCheckIcon data-icon="inline-start" aria-hidden />
          Emergency card
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
              <ItemDescription>Medical records</ItemDescription>
            </ItemContent>
          </ItemHeader>
          <ItemActions>
            <Link
              href="/documents"
              className={buttonVariants({ size: 'sm', variant: 'secondary' })}
            >
              Add or view records
            </Link>
          </ItemActions>
        </Item>
        <Item variant="outline" className="h-full">
          <ItemMedia variant="icon">
            <ShieldCheckIcon aria-hidden />
          </ItemMedia>
          <ItemHeader>
            <ItemContent>
              <ItemTitle className="text-2xl">{healthCompleteness}% ready</ItemTitle>
              <ItemDescription>Emergency information</ItemDescription>
            </ItemContent>
          </ItemHeader>
          <ItemActions>
            <Link
              href="/emergency-card"
              className={buttonVariants({ size: 'sm', variant: 'secondary' })}
            >
              Check details
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
                  ? 'No access'
                  : `${data.activeConsents.length} active`}
              </ItemTitle>
              <ItemDescription>Doctor access</ItemDescription>
            </ItemContent>
          </ItemHeader>
          <ItemActions>
            <Link href="/share" className={buttonVariants({ size: 'sm' })}>
              Share records
            </Link>
          </ItemActions>
        </Item>
        <DashboardAction
          actionLabel="Add"
          description="Add a report, prescription, or discharge summary."
          href="/documents"
          icon={FileTextIcon}
          title="Add a medical record"
        />
        <DashboardAction
          actionLabel="Check"
          description="Tell us what you are feeling before a doctor visit."
          href="/intake"
          icon={HeartPulseIcon}
          title="Check symptoms"
          variant="default"
        />
        <DashboardAction
          actionLabel="Share records"
          description="Give a doctor temporary access that you can stop anytime."
          href="/share"
          icon={QrCodeIcon}
          title="Share with a doctor"
        />
      </section>

      <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent health updates</CardTitle>
            <CardDescription>Your latest records and symptom checks.</CardDescription>
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
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{item.body}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatDateTime(item.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground px-4 text-sm">No health updates yet.</p>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/timeline" className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
              View all updates
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Important health information</CardTitle>
            <CardDescription>Useful details for you and your care team.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-sm">Blood group</span>
              <strong className="text-2xl">{data.profile?.bloodType ?? 'Not added'}</strong>
            </div>
            <ul className="divide-border flex flex-col divide-y">
              <li className="flex items-start gap-2 py-4">
                <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <PillIcon aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">Medicines</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {medications.length > 0 ? (
                      medications.slice(0, 3).map((medication) => (
                        <Badge key={medication} variant="secondary">
                          {medication}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">No medicines added.</span>
                    )}
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-2 py-4">
                <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <AlertTriangleIcon aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">Allergies</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {allergies.length > 0 ? (
                      allergies.map((allergy) => <Badge key={allergy}>{allergy}</Badge>)
                    ) : (
                      <span className="text-muted-foreground text-sm">No allergies added.</span>
                    )}
                  </div>
                </div>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Link
              href="/emergency-card"
              className={buttonVariants({ size: 'sm', variant: 'secondary' })}
            >
              Open emergency card
            </Link>
          </CardFooter>
        </Card>
      </section>

      <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest symptom check</CardTitle>
            <CardDescription>Saved so you can discuss it with a doctor.</CardDescription>
          </CardHeader>
          <CardContent>
            {latestIntake ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={latestIntake.redFlag ? 'destructive' : 'success'}>
                    {latestIntake.redFlag ? 'Needs quick attention' : 'Saved'}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    {latestIntake.chiefComplaint}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm leading-6">{latestIntake.summary}</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                You have not checked any symptoms yet.
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/intake" className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
              Check symptoms
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Record access</CardTitle>
            <CardDescription>Only share records for as long as you choose.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.activeConsents.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {data.activeConsents.slice(0, 2).map((consent) => (
                  <li className="flex items-center justify-between gap-3" key={consent.id}>
                    <span className="font-mono font-medium">{consent.code}</span>
                    <span className="text-muted-foreground text-sm">
                      {minutesUntil(consent.expiresAt)} min left
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3">
                <PhoneIcon aria-hidden />
                <p className="text-muted-foreground text-sm">
                  No doctor has access to your records.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/share" className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
              Manage access
            </Link>
          </CardFooter>
        </Card>
      </section>

      {urgentIntakes > 0 && (
        <p className="text-destructive text-sm">
          You have a symptom check marked for quick attention. Please contact a healthcare
          professional if you need help.
        </p>
      )}
    </div>
  );
}
