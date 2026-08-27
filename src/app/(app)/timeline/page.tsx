import { ClinicalTimeline } from '@/components/clinical-timeline';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime } from '@/lib/format';
import { getI18n } from '@/lib/i18n';

export default async function TimelinePage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();
  const items = data.timeline.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    dateLabel: formatDateTime(item.date, locale),
    status: item.status,
    redFlag: item.redFlag,
    type: item.type,
  }));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader description={t('timeline.description')} title={t('timeline.title')} />
      <section className="grid grid-cols-1 gap-4">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t('timeline.allUpdates')}</CardTitle>
            <CardDescription>{t('timeline.allUpdatesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ClinicalTimeline emptyMessage={t('dashboard.noUpdates')} items={items} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
