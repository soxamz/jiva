import {
  AlarmClockIcon,
  FileTextIcon,
  PhoneIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { redirect } from "next/navigation";

import { ClinicalTimeline } from "@/components/clinical-timeline";
import { OpenUploadedFileLink } from "@/components/documents/open-uploaded-file-link";
import { CriticalInfoBar } from "@/components/critical-info-bar";
import { PatientProfileStrip } from "@/components/patient-profile-strip";
import { StatusPill } from "@/components/status-pill";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getEmergencyAccessData, isConsentAccessError } from "@/lib/dal";
import { formatDateTime, minutesUntil } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export default async function EmergencyAccessPage({
  params,
}: PageProps<"/emergency/access/[code]">) {
  const { code } = await params;
  let data: Awaited<ReturnType<typeof getEmergencyAccessData>>;

  try {
    data = await getEmergencyAccessData(code);
  } catch (error) {
    if (isConsentAccessError(error)) {
      redirect("/emergency");
    }

    throw error;
  }

  const { locale, t } = await getI18n();
  const profile = data.profile;
  const bloodType = profile?.bloodType ?? t("dashboard.notAdded");
  const allergies = profile?.allergies ?? [];
  const conditions = profile?.criticalConditions ?? [];
  const medicines = profile?.currentMedications ?? [];
  const timelineItems = data.recentIntakes.map((item) => ({
    id: item.id,
    title: item.chiefComplaint,
    body: item.summary,
    dateLabel: formatDateTime(item.createdAt, locale),
    status: item.redFlag ? t("dashboard.needsAttention") : t("dashboard.saved"),
    redFlag: item.redFlag,
    type: "intake" as const,
  }));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Alert
        className="flex flex-col gap-4 rounded-2xl sm:flex-row sm:items-center sm:justify-between"
        variant="destructive"
      >
        <div className="flex min-w-0 items-center gap-3">
          <ShieldAlertIcon className="size-8 shrink-0" aria-hidden />
          <div className="min-w-0">
            <AlertTitle className="text-base">
              {t("emergencyView.breakGlassActive")}
            </AlertTitle>
            <AlertDescription className="mt-1">
              {t("emergencyView.authorizedResponder", {
                name: data.viewer.name,
              })}
            </AlertDescription>
          </div>
        </div>
        <div className="border-destructive/30 flex shrink-0 items-center gap-3 rounded-xl border bg-destructive/5 px-4 py-2">
          <AlarmClockIcon className="size-5" aria-hidden />
          <span className="font-mono text-lg font-semibold tabular-nums">
            {t("emergencyView.remaining", {
              count: minutesUntil(data.consent.expiresAt),
            })}
          </span>
        </div>
      </Alert>

      <CriticalInfoBar
        items={[
          {
            label: t("emergencyCard.bloodType"),
            value: bloodType,
            tone: "critical",
          },
          {
            label: t("dashboard.allergies"),
            value: allergies.length
              ? allergies.join(", ")
              : t("emergencyCard.noAllergies"),
            tone: "critical",
          },
          {
            label: t("emergencyView.conditions"),
            value: conditions.length
              ? conditions.join(", ")
              : t("emergencyCard.noneListed"),
            detail: medicines.length > 0 ? medicines.join(", ") : undefined,
            tone: "warning",
          },
        ]}
      />

      <section className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(260px,0.55fr)_minmax(0,1.45fr)]">
        <aside className="flex min-w-0 flex-col gap-5">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="py-5">
              <PatientProfileStrip
                name={data.patient.name}
                subtitle={t("emergencyView.criticalInformationDescription")}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneIcon className="size-4" aria-hidden />
                {t("dashboard.emergencyContacts")}
              </CardTitle>
              <CardDescription>
                {t("emergencyView.contactsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profile?.emergencyContacts.length ? (
                <ul className="flex flex-col gap-3">
                  {profile.emergencyContacts.map((contact) => (
                    <li
                      className="rounded-xl border bg-muted/40 p-3"
                      key={contact.phone}
                    >
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {contact.relation}
                      </p>
                      <a
                        className="text-primary mt-2 inline-flex text-sm font-medium hover:underline"
                        href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
                      >
                        {contact.phone}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("dashboard.noEmergencyContacts")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileTextIcon className="size-4" aria-hidden />
                <CardTitle className="type-section-title">
                  Patient Documents
                </CardTitle>
              </div>
              <CardDescription>
                Recent records available for emergency care.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {data.documents.length ? (
                <ul className="divide-y border-y">
                  {data.documents.map(({ document }) => (
                    <li
                      className="flex min-w-0 items-center gap-3 px-6 py-3"
                      key={document.id}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <FileTextIcon className="size-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {document.title}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {document.docType} |{" "}
                          {formatDateTime(document.uploadedAt, locale)}
                        </p>
                      </div>
                      <OpenUploadedFileLink
                        href={document.storageUrl}
                        label={t("documents.openFile")}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground px-6 text-sm">
                  No documents are available.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>

        <Card className="min-w-0 rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{t("emergencyView.criticalInformation")}</CardTitle>
              <CardDescription className="mt-1">
                {t("emergencyView.recentAlertsDescription")}
              </CardDescription>
            </div>
            <StatusPill className="hidden sm:inline-flex" tone="success">
              <ShieldCheckIcon className="size-3.5" aria-hidden />
              {t("dashboard.ready", { percent: 100 })}
            </StatusPill>
          </CardHeader>
          <CardContent className="pt-2">
            <ClinicalTimeline
              emptyMessage={t("emergencyView.noRecentAlerts")}
              items={timelineItems}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
