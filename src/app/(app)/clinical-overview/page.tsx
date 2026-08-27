import Link from "next/link";
import { FileTextIcon, StethoscopeIcon } from "lucide-react";

import { HistoryTimeline } from "@/components/clinical-overview/history-timeline";
import { MedicationsPanel } from "@/components/clinical-overview/medications-panel";
import { OverviewActions } from "@/components/clinical-overview/overview-actions";
import { OverviewRangeSelector } from "@/components/clinical-overview/range-selector";
import { SummaryEnginePanel } from "@/components/clinical-overview/summary-engine-panel";
import { VitalsRow } from "@/components/clinical-overview/vitals-row";
import { Badge } from "@/components/ui/badge";
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
import { extractOverviewVitals } from "@/lib/overview-vitals";
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
  const allergies = overview.profile?.allergies ?? [];
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
    })),
    ...overview.weekDocuments.map(({ document }) => ({
      id: `doc-${document.id}`,
      date: document.uploadedAt,
      dateLabel: formatDateTime(document.uploadedAt, locale),
      type: `${t("overview.historyDocument")} · ${document.docType}`,
      title: document.title,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(({ id, dateLabel, type, title }) => ({ id, dateLabel, type, title }));

  const vitals = extractOverviewVitals(overview.weekDocuments);
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("overview.pageTitle")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("overview.windowDescription", { count: overview.days })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {allergies.length > 0 ? (
            allergies.slice(0, 3).map((allergy) => (
              <Badge
                key={allergy}
                variant="destructive"
                className="rounded-full"
              >
                {allergy}
              </Badge>
            ))
          ) : (
            <Badge variant="outline" className="rounded-full">
              {t("overview.noAllergies")}
            </Badge>
          )}
          <OverviewActions
            noteLabel={t("overview.addNote")}
            printLabel={t("overview.print")}
          />
        </div>
      </div>

      <OverviewRangeSelector days={days} labels={rangeLabels} />

      {showEmpty ? (
        <Card>
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
            <VitalsRow
              labels={{
                bp: t("overview.vitalBp"),
                hr: t("overview.vitalHr"),
                weight: t("overview.vitalWeight"),
                spo2: t("overview.vitalSpo2"),
              }}
              metrics={vitals}
              statusLabels={{
                elevated: t("overview.vitalElevated"),
                normal: t("overview.vitalNormal"),
                stable: t("overview.vitalStable"),
                not_recorded: t("overview.vitalNotRecorded"),
              }}
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
