import {
  AlarmClockIcon,
  AlertTriangleIcon,
  HeartPulseIcon,
  PhoneIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  StethoscopeIcon,
  UserRoundIcon,
} from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getEmergencyAccessData, isConsentAccessError } from "@/lib/dal";
import { formatDateTime, minutesUntil } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <Alert
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
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
        <div className="border-destructive/30 flex shrink-0 items-center gap-3 rounded-md border px-3 py-2">
          <AlarmClockIcon className="size-5" aria-hidden />
          <span className="font-mono text-lg font-semibold tabular-nums">
            {t("emergencyView.remaining", {
              count: minutesUntil(data.consent.expiresAt),
            })}
          </span>
        </div>
      </Alert>

      <section className="grid gap-4 lg:grid-cols-3">
        <EmergencySummary
          icon={HeartPulseIcon}
          label={t("emergencyCard.bloodType")}
        >
          <p className="text-destructive text-4xl font-semibold tracking-normal">
            {bloodType}
          </p>
        </EmergencySummary>
        <EmergencySummary
          icon={AlertTriangleIcon}
          label={t("dashboard.allergies")}
          urgent
        >
          <EmergencyValueList
            empty={t("emergencyCard.noAllergies")}
            values={allergies}
          />
        </EmergencySummary>
        <EmergencySummary
          icon={ShieldCheckIcon}
          label={t("emergencyView.conditions")}
        >
          <EmergencyValueList
            empty={t("emergencyCard.noneListed")}
            values={conditions}
          />
          {medicines.length > 0 && (
            <p className="text-muted-foreground mt-2 text-xs leading-5">
              {medicines.join(", ")}
            </p>
          )}
        </EmergencySummary>
      </section>

      <section className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(260px,0.55fr)_minmax(0,1.45fr)]">
        <aside className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardContent className="flex items-center gap-3">
              <span className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-md">
                <UserRoundIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">
                  {data.patient.name}
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {t("emergencyView.criticalInformationDescription")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
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
                    <li className="bg-muted rounded-lg p-3" key={contact.phone}>
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
        </aside>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{t("emergencyView.criticalInformation")}</CardTitle>
              <CardDescription className="mt-1">
                {t("emergencyView.recentAlertsDescription")}
              </CardDescription>
            </div>
            <Badge className="hidden sm:inline-flex" variant="secondary">
              <ShieldCheckIcon data-icon="inline-start" aria-hidden />
              {t("dashboard.ready", { percent: 100 })}
            </Badge>
          </CardHeader>
          <Separator />
          <CardContent className="pt-5">
            {data.recentIntakes.length ? (
              <ol className="before:bg-border relative flex flex-col gap-4 before:absolute before:top-6 before:bottom-6 before:left-5 before:w-px">
                {data.recentIntakes.map((item) => {
                  const isUrgent = item.redFlag;
                  const Icon = StethoscopeIcon;

                  return (
                    <li
                      className="relative flex min-w-0 items-start gap-3"
                      key={item.id}
                    >
                      <span
                        className={cn(
                          "bg-muted relative z-10 flex size-10 shrink-0 items-center justify-center rounded-md",
                          isUrgent && "bg-destructive/10 text-destructive",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div
                        className={cn(
                          "border-border min-w-0 flex-1 rounded-lg border p-4",
                          isUrgent && "border-destructive/30",
                        )}
                      >
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <p className="min-w-0 flex-1 font-medium">
                            {item.chiefComplaint}
                          </p>
                          <Badge
                            variant={isUrgent ? "destructive" : "secondary"}
                          >
                            {isUrgent
                              ? t("dashboard.needsAttention")
                              : t("dashboard.saved")}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-5">
                          {item.summary
                            .replaceAll("**", "")
                            .replaceAll("\n", " ")}
                        </p>
                        <p className="text-muted-foreground mt-2 text-xs font-medium">
                          {formatDateTime(item.createdAt, locale)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("emergencyView.noRecentAlerts")}
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function EmergencySummary({
  icon: Icon,
  label,
  urgent = false,
  children,
}: Readonly<{
  icon: typeof HeartPulseIcon;
  label: string;
  urgent?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <div
      className={cn(
        "bg-muted rounded-lg border p-4",
        urgent && "border-destructive/30",
      )}
    >
      <p
        className={cn(
          "text-muted-foreground flex items-center gap-2 text-xs font-medium",
          urgent && "text-destructive",
        )}
      >
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmergencyValueList({
  values,
  empty,
}: {
  values: string[];
  empty: string;
}) {
  return values.length ? (
    <p className="text-lg leading-6 font-semibold">{values.join(", ")}</p>
  ) : (
    <p className="text-muted-foreground text-sm">{empty}</p>
  );
}
