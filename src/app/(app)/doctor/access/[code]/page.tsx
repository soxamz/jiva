import { DoctorNoteForm } from "@/components/forms/doctor-note-form";
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">
            {t("doctor.activeConsent", { code: data.consent.code })}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">
            {data.patient.name}
          </h1>
        </div>
        <Badge variant="secondary">
          {t("doctor.remaining", {
            count: minutesUntil(data.consent.expiresAt),
          })}
        </Badge>
      </div>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t("doctor.criticalProfile")}</CardTitle>
            <CardDescription>
              {t("doctor.criticalProfileDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-end justify-between">
              <span className="text-muted-foreground text-sm">
                {t("emergencyCard.bloodType")}
              </span>
              <strong className="text-3xl tabular-nums">
                {data.profile?.bloodType ?? "NA"}
              </strong>
            </div>
            <div className="flex flex-wrap gap-2">
              {(data.profile?.allergies ?? []).map((allergy) => (
                <Badge key={allergy} variant="destructive">
                  {allergy}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(data.profile?.currentMedications ?? []).map((medication) => (
                <Badge key={medication} variant="secondary">
                  {medication}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
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
                      <Badge
                        variant={
                          intake.redFlag || clinical?.triage_alert
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {intake.redFlag || clinical?.triage_alert
                          ? t("doctor.redFlag")
                          : t("doctor.routine")}
                      </Badge>
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
        <Card className="xl:col-span-3">
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
                <TableRow>
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
        <Card className="xl:col-span-3">
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
