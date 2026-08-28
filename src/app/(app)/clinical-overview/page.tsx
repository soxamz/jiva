import Link from "next/link";
import { FileTextIcon, StethoscopeIcon } from "lucide-react";

import { HistoryTimeline } from "@/components/clinical-overview/history-timeline";
import { ClinicalRecordSummary } from "@/components/clinical-overview/clinical-record-summary";
import { MedicationsPanel } from "@/components/clinical-overview/medications-panel";
import { OverviewActions } from "@/components/clinical-overview/overview-actions";
import { OverviewRangeSelector } from "@/components/clinical-overview/range-selector";
import { SummaryEnginePanel } from "@/components/clinical-overview/summary-engine-panel";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import {
  getWeekClinicalOverview,
  parseOverviewRange,
  type OverviewRangeDays,
} from "@/lib/week-clinical-overview";
import { cn } from "@/lib/utils";

export default async function ClinicalOverviewPage({
  searchParams,
}: PageProps<"/clinical-overview">) {
  const params = await searchParams;
  const days = parseOverviewRange(params.range);
  const overview = await getWeekClinicalOverview(days);
  const { locale, t } = await getI18n();

  const showEmpty = overview.source === "none";
  const clinical = overview.clinical;
  const recordCount =
    overview.weekIntakes.length + overview.weekDocuments.length;

  const rangeLabels: Record<OverviewRangeDays, string> = {
    7: t("overview.range7"),
    30: t("overview.range30"),
    90: t("overview.range90"),
  };

  const history = [
    ...overview.weekIntakes.map((intake) => ({
      id: `intake-${intake.id}`,
      date: intake.createdAt,
      dateLabel: formatDateTime(intake.createdAt, locale),
      type: t("overview.historyIntake"),
      title: intake.chiefComplaint,
      fileUrl: null,
      fileLabel: undefined,
    })),
    ...overview.weekDocuments.map(({ document }) => ({
      id: `doc-${document.id}`,
      date: document.uploadedAt,
      dateLabel: formatDateTime(document.uploadedAt, locale),
      type: `${t("overview.historyDocument")} · ${document.docType}`,
      title: document.title,
      fileUrl: document.storageUrl,
      fileLabel: t("documents.openFile"),
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(({ id, dateLabel, type, title, fileUrl, fileLabel }) => ({
      id,
      dateLabel,
      type,
      title,
      fileUrl,
      fileLabel,
    }));

  const latestIntake = overview.weekIntakes[0] ?? null;
  const urgentCheckCount = overview.weekIntakes.filter(
    (intake) => intake.redFlag,
  ).length;
  const labFlagCount = clinical?.abnormal_lab_flags?.length ?? 0;
  const sourceNote =
    overview.source === "ml3"
      ? t("overview.sourceMl3")
      : overview.source === "stored"
        ? t("overview.sourceStored")
        : overview.source === "local"
          ? overview.error
            ? `${t("overview.sourceLocal")} · ${t("overview.ml3FallbackNote")}`
            : t("overview.sourceLocal")
          : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <OverviewActions
            noteLabel={t("overview.addNote")}
            printLabel={t("overview.print")}
          />
        }
        description={t("overview.windowDescription", { count: overview.days })}
        title={t("overview.pageTitle")}
      />

      <OverviewRangeSelector days={days} labels={rangeLabels} />

      {showEmpty ? (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t("overview.weekEmptyTitle")}</CardTitle>
            <CardDescription>
              {t("overview.windowEmptyDescription", { count: overview.days })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link
              href="/intake"
              className={cn(buttonVariants(), "inline-flex items-center gap-2")}
            >
              <StethoscopeIcon className="size-4" aria-hidden />
              {t("overview.startIntake")}
            </Link>
            <Link
              href="/documents"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "inline-flex items-center gap-2",
              )}
            >
              <FileTextIcon className="size-4" aria-hidden />
              {t("overview.uploadLabs")}
            </Link>
          </CardContent>
        </Card>
      ) : clinical ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <SummaryEnginePanel
              clinical={clinical}
              extractsEmpty={t("overview.extractsEmpty")}
              extractsTitle={t("overview.extractsTitle")}
              footerLabel={t("overview.engineFooter")}
              generatedLabel={t("overview.generated", {
                date: formatDateTime(
                  overview.generatedAt ?? new Date(),
                  locale,
                ),
              })}
              highConfidenceLabel={
                overview.source === "ml3"
                  ? t("overview.highConfidence")
                  : t("overview.sourceLocal")
              }
              recordsLabel={t("overview.basedOnRecords", {
                count: recordCount,
              })}
              reportLabel={t("overview.reportInaccuracy")}
              reviewLabel={t("overview.needsReview")}
              sourceNote={sourceNote}
              title={t("overview.summaryTitle")}
            />
            <ClinicalRecordSummary
              description={t("overview.recordSummaryDescription")}
              items={[
                {
                  kind: "checks",
                  label: t("overview.symptomChecks"),
                  value: overview.weekIntakes.length,
                },
                {
                  kind: "documents",
                  label: t("overview.documentsReviewed"),
                  value: overview.weekDocuments.length,
                },
                {
                  kind: "urgent",
                  label: t("overview.urgentChecks"),
                  value: urgentCheckCount,
                },
                {
                  kind: "labs",
                  label: t("overview.flaggedLabs"),
                  value: labFlagCount,
                },
              ]}
              latestCheck={latestIntake?.chiefComplaint ?? null}
              latestCheckLabel={t("overview.latestCheck")}
              title={t("overview.recordSummaryTitle")}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <MedicationsPanel
              compliantLabel={t("overview.medCompliant")}
              emptyLabel={t("overview.medsEmpty")}
              footerLabel={t("overview.medsViewAll")}
              itemsLabel={t("overview.medsItems", {
                count: overview.medications.length,
              })}
              medications={overview.medications}
              reviewLabel={t("overview.medReview")}
              title={t("overview.medsTitle")}
            />
            <HistoryTimeline
              emptyLabel={t("overview.historyEmpty")}
              items={history}
              title={t("overview.historyTitle")}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
