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

import { DashboardCard } from '@/components/dashboard-card';
import { JivaActivityChart } from '@/components/jiva-activity-chart';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime, minutesUntil } from '@/lib/format';

function buildActivityRows(
  timeline: Array<{ date: Date; type: string }>
): Array<{ day: string; documents: number; intakes: number }> {
  const formatter = new Intl.DateTimeFormat('en', { weekday: 'short' });
  const rows = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);

    return {
      date,
      day: formatter.format(date),
      documents: 0,
      intakes: 0,
    };
  });

  for (const item of timeline) {
    const eventDate = new Date(item.date);
    eventDate.setHours(0, 0, 0, 0);
    const row = rows.find((candidate) => candidate.date.getTime() === eventDate.getTime());

    if (!row) {
      continue;
    }

    if (item.type === 'intake') {
      row.intakes += 1;
    } else {
      row.documents += 1;
    }
  }

  return rows.map(({ day, documents, intakes }) => ({ day, documents, intakes }));
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'secondary',
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ 'aria-hidden'?: boolean }>;
  tone?: 'secondary' | 'success' | 'warning' | 'destructive';
}) {
  return (
    <DashboardCard>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-normal tracking-wide">{label}</CardTitle>
        <Badge variant={tone}>
          <Icon aria-hidden />
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-row items-end gap-2">
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
      </CardContent>
      <CardFooter className="bg-background rounded-none text-xs">
        <span className="text-muted-foreground">{helper}</span>
      </CardFooter>
    </DashboardCard>
  );
}

export default async function DashboardPage() {
  const data = await getPatientWorkspace();
  const latestIntake = data.intakeSessions[0];
  const urgentIntakes = data.intakeSessions.filter((intake) => intake.redFlag).length;
  const processedDocuments = data.documents.filter(
    ({ document }) => document.status === 'processed'
  ).length;
  const extractionScores = data.documents
    .map(({ structured }) => structured?.aiConfidenceScore)
    .filter((score): score is number => typeof score === 'number');
  const averageConfidence =
    extractionScores.length > 0
      ? Math.round(
          extractionScores.reduce((sum, score) => sum + score, 0) / extractionScores.length
        )
      : 0;
  const healthCompleteness =
    (data.profile?.bloodType ? 25 : 0) +
    ((data.profile?.allergies?.length ?? 0) > 0 ? 25 : 0) +
    ((data.profile?.currentMedications?.length ?? 0) > 0 ? 25 : 0) +
    ((data.profile?.emergencyContacts?.length ?? 0) > 0 ? 25 : 0);
  const activityRows = buildActivityRows(data.timeline);
  const medications = data.profile?.currentMedications ?? [];
  const allergies = data.profile?.allergies ?? [];
  const emergencyContacts = data.profile?.emergencyContacts ?? [];
  const latestAudit = data.auditLogs[0];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">Patient dashboard</p>
          <h1 className="text-2xl font-semibold tracking-normal">{data.user.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/documents" className={buttonVariants({ variant: 'outline' })}>
            <FileTextIcon data-icon="inline-start" aria-hidden />
            Upload record
          </Link>
          <Link href="/share" className={buttonVariants()}>
            <QrCodeIcon data-icon="inline-start" aria-hidden />
            Share records
          </Link>
        </div>
      </section>

      <section className="bg-border grid grid-cols-1 gap-px p-px md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          helper={`${processedDocuments} processed in vault`}
          icon={FileTextIcon}
          label="Documents"
          value={String(data.documents.length)}
        />
        <StatCard
          helper="Time-bound consent links"
          icon={QrCodeIcon}
          label="Active shares"
          tone="success"
          value={String(data.activeConsents.length)}
        />
        <StatCard
          helper="Detected by intake rules"
          icon={AlertTriangleIcon}
          label="Red flags"
          tone={urgentIntakes > 0 ? 'destructive' : 'secondary'}
          value={String(urgentIntakes)}
        />
        <StatCard
          helper={`${averageConfidence}% average AI confidence`}
          icon={ShieldCheckIcon}
          label="Extraction quality"
          tone="warning"
          value={averageConfidence ? `${averageConfidence}%` : 'N/A'}
        />

        <DashboardCard className="gap-0 md:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Health activity</CardTitle>
              <Badge variant="secondary">Last 7 days</Badge>
            </div>
            <CardDescription>
              Document uploads and intake sessions recorded in Neon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JivaActivityChart rows={activityRows} />
          </CardContent>
        </DashboardCard>

        <DashboardCard className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>Emergency profile</CardTitle>
            <CardDescription>Offline-style critical care summary.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-sm">Blood type</span>
              <strong className="text-2xl tabular-nums">
                {data.profile?.bloodType ?? 'Not set'}
              </strong>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Profile completeness</span>
                <span className="font-medium tabular-nums">{healthCompleteness}%</span>
              </div>
              <Progress value={healthCompleteness} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(data.profile?.allergies ?? []).length > 0 ? (
                data.profile?.allergies.map((allergy) => (
                  <Badge key={allergy} variant="warning">
                    {allergy}
                  </Badge>
                ))
              ) : (
                <Badge variant="secondary">No allergies listed</Badge>
              )}
            </div>
          </CardContent>
          <CardFooter className="bg-background rounded-none">
            <Link
              href="/emergency-card"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              View emergency card
            </Link>
          </CardFooter>
        </DashboardCard>

        <DashboardCard className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>Latest intake</CardTitle>
            <CardDescription>BYOD triage output.</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-54 flex-col justify-between gap-4">
            {latestIntake ? (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={latestIntake.redFlag ? 'destructive' : 'success'}>
                      {latestIntake.redFlag ? 'Urgent' : 'Routine'}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      Severity {latestIntake.severity}/10
                    </span>
                  </div>
                  <p className="font-medium">{latestIntake.chiefComplaint}</p>
                  <p className="text-muted-foreground line-clamp-4 text-sm">
                    {latestIntake.summary}
                  </p>
                </div>
                <Link href="/intake" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  Start new intake
                </Link>
              </>
            ) : (
              <div className="flex min-h-40 flex-col justify-center gap-3">
                <HeartPulseIcon aria-hidden />
                <p className="text-muted-foreground text-sm">No intake has been submitted yet.</p>
                <Link href="/intake" className={buttonVariants({ size: 'sm' })}>
                  Start intake
                </Link>
              </div>
            )}
          </CardContent>
        </DashboardCard>

        <DashboardCard className="gap-0 md:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>Clinical timeline</CardTitle>
            <CardDescription>Latest documents and intake events.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border flex flex-col divide-y">
              {data.timeline.slice(0, 5).map((item) => (
                <li className="flex min-h-18 items-start gap-3 px-6 py-4" key={item.id}>
                  <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-2xl">
                    {item.type === 'intake' ? (
                      <ActivityIcon aria-hidden />
                    ) : (
                      <FileTextIcon aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate font-medium">{item.title}</p>
                      <Badge variant={item.redFlag ? 'destructive' : 'secondary'}>
                        {item.type}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-sm">{item.body}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatDateTime(item.date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </DashboardCard>

        <DashboardCard className="gap-0 md:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>Active access</CardTitle>
            <CardDescription>
              Doctors can use these codes until expiry or revocation.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableCaption className="sr-only">
                Active consent codes for record access.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-6">Code</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="pe-6 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activeConsents.map((consent) => (
                  <TableRow className="h-12" key={consent.id}>
                    <TableCell className="ps-6 font-mono font-medium">{consent.code}</TableCell>
                    <TableCell>{minutesUntil(consent.expiresAt)} min remaining</TableCell>
                    <TableCell className="pe-6 text-right">
                      <Badge variant="success">{consent.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {data.activeConsents.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground ps-6" colSpan={3}>
                      No active shares.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </DashboardCard>

        <DashboardCard className="gap-0 xl:col-span-3">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Recent records</CardTitle>
              <Badge variant="secondary">{data.documents.length} total</Badge>
            </div>
            <CardDescription>Metadata and mock extraction status stored in Neon.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableCaption className="sr-only">Recent medical documents.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-6">Record</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>AI confidence</TableHead>
                  <TableHead className="pe-6 text-right">Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.documents.slice(0, 5).map(({ document, structured }) => (
                  <TableRow className="h-12" key={document.id}>
                    <TableCell className="max-w-72 truncate ps-6 font-medium">
                      {document.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{document.docType}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {structured?.aiConfidenceScore
                        ? `${structured.aiConfidenceScore}%`
                        : 'Pending'}
                    </TableCell>
                    <TableCell className="text-muted-foreground pe-6 text-right">
                      {formatDateTime(document.uploadedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </DashboardCard>

        <DashboardCard className="gap-0 xl:col-span-1">
          <CardHeader className="border-b">
            <CardTitle>Care snapshot</CardTitle>
            <CardDescription>Critical information ready for care decisions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PhoneIcon className="text-muted-foreground" aria-hidden />
                <span className="text-sm">Emergency contacts</span>
              </div>
              <strong className="text-2xl tabular-nums">{emergencyContacts.length}</strong>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <PillIcon className="text-muted-foreground" aria-hidden />
                <span className="text-sm">Current medications</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {medications.length > 0 ? (
                  medications.slice(0, 3).map((medication) => (
                    <Badge key={medication} variant="secondary">
                      {medication}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary">None listed</Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm">Known allergies</span>
              <div className="flex flex-wrap gap-2">
                {allergies.length > 0 ? (
                  allergies.map((allergy) => (
                    <Badge key={allergy} variant="warning">
                      {allergy}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary">None listed</Badge>
                )}
              </div>
            </div>
            {latestAudit && (
              <div className="border-t pt-4">
                <p className="text-muted-foreground text-xs">Latest vault activity</p>
                <p className="mt-1 font-medium">{latestAudit.action.replaceAll('_', ' ')}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(latestAudit.createdAt)}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-background rounded-none">
            <Link
              href="/emergency-card"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Open emergency card
            </Link>
          </CardFooter>
        </DashboardCard>
      </section>
    </div>
  );
}
