import Link from 'next/link';
import { FileTextIcon, StethoscopeIcon } from 'lucide-react';

import {
  ClinicalHistoryCard,
  CriticalExtractsCard,
  MedicationsCard,
  SummaryEngineCard,
  SuggestedActionsCard,
} from '@/components/clinical-overview/overview-cards';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  asClinicalSummary,
  mergeMedications,
  parseActionItems,
} from '@/lib/clinical-summary';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime } from '@/lib/format';
import { getI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default async function ClinicalOverviewPage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();

  const latestWithSummary =
    data.intakeSessions.find((intake) => asClinicalSummary(intake.clinicalSummary)) ?? null;
  const clinical = asClinicalSummary(latestWithSummary?.clinicalSummary ?? null);

  const allergies = data.profile?.allergies ?? [];
  const medications = mergeMedications(
    clinical?.extracted_medications,
    data.profile?.currentMedications
  );
  const actions = parseActionItems(clinical?.doctor_english_summary, clinical?.triage_action);

  const history = [
    ...data.intakeSessions.slice(0, 8).map((intake) => ({
      id: `intake-${intake.id}`,
      date: intake.createdAt,
      dateLabel: formatDateTime(intake.createdAt, locale),
      type: t('overview.historyIntake'),
      title: intake.chiefComplaint,
    })),
    ...data.documents.slice(0, 8).map(({ document }) => ({
      id: `doc-${document.id}`,
      date: document.uploadedAt,
      dateLabel: formatDateTime(document.uploadedAt, locale),
      type: `${t('overview.historyDocument')} · ${document.docType}`,
      title: document.title,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10)
    .map(({ id, dateLabel, type, title }) => ({ id, dateLabel, type, title }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">{t('overview.eyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-normal">{data.user.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('overview.description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {allergies.length > 0 ? (
            allergies.slice(0, 4).map((allergy) => (
              <Badge key={allergy} variant="destructive">
                {allergy}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">{t('overview.noAllergies')}</Badge>
          )}
        </div>
      </div>

      {!clinical ? (
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>{t('overview.emptyTitle')}</CardTitle>
            <CardDescription>{t('overview.emptyDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link
              href="/intake"
              className={cn(buttonVariants(), 'inline-flex items-center gap-2')}
            >
              <StethoscopeIcon className="size-4" aria-hidden />
              {t('overview.startIntake')}
            </Link>
            <Link
              href="/documents"
              className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex items-center gap-2')}
            >
              <FileTextIcon className="size-4" aria-hidden />
              {t('overview.uploadLabs')}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="flex flex-col gap-4 xl:col-span-2">
            <SummaryEngineCard
              clinical={clinical}
              description={t('overview.summaryDescription')}
              generatedLabel={t('overview.generated', {
                date: formatDateTime(latestWithSummary!.createdAt, locale),
              })}
              highConfidenceLabel={t('overview.highConfidence')}
              reviewLabel={t('overview.needsReview')}
              title={t('overview.summaryTitle')}
            />
            <CriticalExtractsCard
              clinical={clinical}
              description={t('overview.extractsDescription')}
              emptyLabel={t('overview.extractsEmpty')}
              title={t('overview.extractsTitle')}
            />
          </div>
          <div className="flex flex-col gap-4">
            <SuggestedActionsCard
              actions={actions}
              description={t('overview.actionsDescription')}
              emptyLabel={t('overview.actionsEmpty')}
              title={t('overview.actionsTitle')}
            />
            <MedicationsCard
              description={t('overview.medsDescription')}
              emptyLabel={t('overview.medsEmpty')}
              medications={medications}
              title={t('overview.medsTitle')}
            />
            <ClinicalHistoryCard
              description={t('overview.historyDescription')}
              emptyLabel={t('overview.historyEmpty')}
              items={history}
              title={t('overview.historyTitle')}
            />
          </div>
        </section>
      )}
    </div>
  );
}
