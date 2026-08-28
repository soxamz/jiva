import { DoctorNoteForm } from "@/components/forms/doctor-note-form";
import { OpenUploadedFileLink } from "@/components/documents/open-uploaded-file-link";
import { CriticalInfoBar } from "@/components/critical-info-bar";
import { PatientProfileStrip } from "@/components/patient-profile-strip";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDoctorAccessData, isConsentAccessError } from "@/lib/dal";
import { formatDateTime, minutesUntil } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { redirect } from "next/navigation";

function BoldSummary({ text }: { text: string }) {
  const blocks = text
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (
    <div className="text-muted-foreground space-y-3 text-sm leading-6">
      {blocks.map((block, blockIndex) => (
        <div
          key={`${blockIndex}-${block.slice(0, 24)}`}
          className="whitespace-pre-wrap"
        >
          {block.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong
                key={`${blockIndex}-${index}`}
                className="text-foreground font-semibold"
              >
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={`${blockIndex}-${index}`}>{part}</span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

export default async function DoctorAccessPage({
  params,
}: PageProps<"/doctor/access/[code]">) {
  const { code } = await params;
  let data: Awaited<ReturnType<typeof getDoctorAccessData>>;

  try {
    data = await getDoctorAccessData(code);
  } catch (error) {
    const access = isConsentAccessError(error)
      ? error.code
      : "access_unavailable";
    redirect(`/doctor?access=${access}`);
  }

  const { locale, t } = await getI18n();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <PatientProfileStrip
          name={data.patient.name}
          subtitle={t("doctor.activeConsent")}
        />
        <StatusPill tone="info">
          {data.consent.expiresAt
            ? t("doctor.remaining", {
                count: minutesUntil(data.consent.expiresAt),
              })
            : t("share.activeUntilRevoked")}
        </StatusPill>
      </div>

      <CriticalInfoBar
        items={[
          {
            label: t("emergencyCard.bloodType"),
            value: data.profile?.bloodType ?? "NA",
            tone: "warning",
          },
          {
            label: t("dashboard.allergies"),
            value:
              (data.profile?.allergies ?? []).length > 0
                ? (data.profile?.allergies ?? []).join(", ")
                : t("emergencyCard.noAllergies"),
            tone: "critical",
          },
          {
            label: t("health.currentMedicines"),
            value:
              (data.profile?.currentMedications ?? []).length > 0
                ? (data.profile?.currentMedications ?? []).join(", ")
                : t("emergencyCard.noneListed"),
            tone: "neutral",
          },
        ]}
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl shadow-sm xl:col-span-3">
          <CardHeader className="border-b">
            <CardTitle>{t("doctor.physicianSummary")}</CardTitle>
            <CardDescription>
              {t("doctor.physicianSummaryDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border flex flex-col divide-y">
              {data.intakeSessions.map((intake) => {
                const clinical = (intake.clinicalSummary ?? null) as {
                  doctor_english_summary?: string;
                  detected_contradictions?: Array<{
                    issue: string;
                    severity: string;
                  }>;
                  abnormal_lab_flags?: Array<{
                    test_name: string;
                    flagged_value: string;
                    clinical_significance: string;
                  }>;
                  triage_alert?: boolean;
                } | null;
                const summaryText =
                  clinical?.doctor_english_summary?.trim() || intake.summary;

                return (
                  <li className="flex flex-col gap-2 px-6 py-4" key={intake.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{intake.chiefComplaint}</p>
                      <StatusPill
                        tone={
                          intake.redFlag || clinical?.triage_alert
                            ? "critical"
                            : "success"
                        }
                      >
                        {intake.redFlag || clinical?.triage_alert
                          ? t("doctor.redFlag")
                          : t("doctor.routine")}
                      </StatusPill>
                    </div>
                    <BoldSummary text={summaryText} />
                    {clinical?.detected_contradictions &&
                    clinical.detected_contradictions.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">Contradictions</p>
                        <ul className="text-muted-foreground list-disc ps-5 text-sm">
                          {clinical.detected_contradictions.map((item) => (
                            <li key={`${item.severity}-${item.issue}`}>
                              [{item.severity}] {item.issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {clinical?.abnormal_lab_flags &&
                    clinical.abnormal_lab_flags.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">Abnormal labs</p>
                        <ul className="text-muted-foreground list-disc ps-5 text-sm">
                          {clinical.abnormal_lab_flags.map((lab) => (
                            <li key={`${lab.test_name}-${lab.flagged_value}`}>
                              {lab.test_name}: {lab.flagged_value} —{" "}
                              {lab.clinical_significance}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm xl:col-span-3">
          <CardHeader className="border-b">
            <CardTitle>{t("doctor.patientRecords")}</CardTitle>
            <CardDescription>
              {t("doctor.patientRecordsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableCaption className="sr-only">
                Patient records accessible under the current consent.
              </TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="ps-6">
                    {t("documents.document")}
                  </TableHead>
                  <TableHead>{t("documents.type")}</TableHead>
                  <TableHead>{t("doctor.confidence")}</TableHead>
                  <TableHead className="pe-6 text-right">
                    {t("documents.uploaded")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.documents.map(({ document, structured }) => (
                  <TableRow className="h-12" key={document.id}>
                    <TableCell className="max-w-80 ps-6">
                      <p className="truncate font-medium">{document.title}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {document.notes}
                      </p>
                      <OpenUploadedFileLink
                        className="mt-1.5"
                        href={document.storageUrl}
                        label={t("documents.openFile")}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{document.docType}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {structured?.aiConfidenceScore ?? 0}%
                    </TableCell>
                    <TableCell className="text-muted-foreground pe-6 text-right">
                      {formatDateTime(document.uploadedAt, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm xl:col-span-3">
          <CardHeader className="border-b">
            <CardTitle>{t("doctor.addNote")}</CardTitle>
            <CardDescription>{t("doctor.addNoteDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DoctorNoteForm code={data.consent.code} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
