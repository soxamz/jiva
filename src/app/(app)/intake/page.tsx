import { ClinicalTimeline } from '@/components/clinical-timeline';
import { PageHeader } from '@/components/page-header';
import { AiIntakeChat } from '@/components/intake/ai-intake-chat';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime } from '@/lib/format';
import { getI18n } from '@/lib/i18n';

export default async function IntakePage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();
  const previousItems = data.intakeSessions.map((intake) => ({
    id: intake.id,
    title: intake.chiefComplaint,
    body: intake.summary,
    dateLabel: formatDateTime(intake.createdAt, locale),
    status: intake.redFlag ? t('dashboard.needsAttention') : t('dashboard.saved'),
    redFlag: intake.redFlag,
    type: 'intake' as const,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader description={t('intake.description')} title={t('intake.title')} />
      <section className="space-y-4">
        <AiIntakeChat />
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t('intake.previous')}</CardTitle>
            <CardDescription>{t('intake.previousDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {previousItems.length ? (
              <ClinicalTimeline items={previousItems} />
            ) : (
              <p className="text-muted-foreground text-sm">{t('dashboard.noUpdates')}</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
