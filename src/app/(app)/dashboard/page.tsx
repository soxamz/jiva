import Link from "next/link";
import {
  ActivityIcon,
  ArrowRightIcon,
  FileTextIcon,
  HeartPulseIcon,
  PillIcon,
  QrCodeIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { ClinicalTimeline } from "@/components/clinical-timeline";
import { PageHeader } from "@/components/page-header";
import { QuickActionCard } from "@/components/quick-action-card";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPatientWorkspace } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { MobileDashboard } from "@/components/mobile/mobile-dashboard";

export default async function DashboardPage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();
  const medications = data.profile?.currentMedications ?? [];
  const timelinePreview = data.timeline.slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    dateLabel: formatDateTime(item.date, locale),
    status: item.status,
    redFlag: item.redFlag,
    type: item.type,
    fileUrl: item.fileUrl,
    fileLabel: t("documents.openFile"),
  }));

  return (
    <>
      <MobileDashboard
        data={{
          user: data.user,
          activeConsents: data.activeConsents,
          documents: data.documents,
          profile: data.profile,
          timeline: timelinePreview,
        }}
      />

      <div className="hidden md:flex mx-auto w-full max-w-[1240px] min-w-0 flex-col gap-6">
        <PageHeader
          actions={
            <Link
              href="/health-information"
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "w-full sm:w-auto",
              )}
            >
              {t("dashboard.editHealthInformation")}
            </Link>
          }
          description={t("dashboard.readyForVisit")}
          title={t("dashboard.hello", { name: data.user.name })}
        />

        <section className="grid min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            actionLabel={t("dashboard.check")}
            highlight
            href="/intake"
            icon={HeartPulseIcon}
            label={t("dashboard.checkSymptoms")}
          >
            <p className="mt-1 text-xs leading-5 text-primary-foreground/80">
              {t("dashboard.checkSymptomsDescription")}
            </p>
          </StatCard>
          <StatCard
            actionLabel={t("dashboard.manageAccess")}
            href="/share"
            icon={QrCodeIcon}
            label={t("dashboard.doctorAccess")}
            value={
              data.activeConsents.length === 0
                ? t("dashboard.noAccess")
                : t("dashboard.activeAccess", {
                    count: data.activeConsents.length,
                  })
            }
          />
          <StatCard
            actionLabel={t("dashboard.addOrViewRecords")}
            href="/documents"
            icon={FileTextIcon}
            label={t("dashboard.medicalRecords")}
            value={data.documents.length}
          />
          <StatCard
            actionLabel={t("dashboard.editHealthInformation")}
            href="/health-information"
            icon={PillIcon}
            label={t("dashboard.medicines")}
          >
            <div className="mt-2 flex min-h-10 flex-wrap content-start gap-1.5">
              {medications.length ? (
                medications.slice(0, 2).map((medication) => (
                  <Badge
                    className="max-w-full truncate"
                    key={medication}
                    variant="secondary"
                  >
                    {medication}
                  </Badge>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("dashboard.noMedicines")}
                </p>
              )}
            </div>
          </StatCard>
        </section>

        <section className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.75fr)]">
          <Card className="min-w-0 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>{t("dashboard.recentUpdates")}</CardTitle>
              <CardDescription>
                {t("dashboard.recentUpdatesDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClinicalTimeline
                compact
                emptyMessage={t("dashboard.noUpdates")}
                items={timelinePreview}
              />
            </CardContent>
            <CardFooter className="pb-5">
              <Link
                href="/timeline"
                className={cn(
                  buttonVariants({ size: "sm", variant: "secondary" }),
                  "w-full",
                )}
              >
                {t("dashboard.viewUpdates")}
                <ArrowRightIcon data-icon="inline-end" aria-hidden />
              </Link>
            </CardFooter>
          </Card>

          <aside
            className="flex min-w-0 flex-col gap-4"
            aria-label={t("dashboard.quickActions")}
          >
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>{t("dashboard.quickActions")}</CardTitle>
                <CardDescription>
                  {t("dashboard.quickActionsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-1 flex flex-col gap-2">
                <QuickActionCard
                  actionLabel={t("dashboard.add")}
                  description={t("dashboard.addMedicalRecordDescription")}
                  href="/documents"
                  icon={FileTextIcon}
                  title={t("dashboard.addMedicalRecord")}
                />
                <QuickActionCard
                  actionLabel={t("dashboard.shareRecords")}
                  description={t("dashboard.shareWithDoctorDescription")}
                  href="/share"
                  icon={QrCodeIcon}
                  title={t("dashboard.shareWithDoctor")}
                />
                <QuickActionCard
                  actionLabel={t("nav.accessLog")}
                  description={t("dashboard.recordAccessDescription")}
                  href="/access-log"
                  icon={ActivityIcon}
                  title={t("dashboard.recordAccess")}
                />
                <QuickActionCard
                  actionLabel={t("dashboard.checkDetails")}
                  description={t("dashboard.emergencyInformation")}
                  href="/emergency-card"
                  icon={ShieldCheckIcon}
                  title={t("dashboard.emergencyCard")}
                />
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </>
  );
}

