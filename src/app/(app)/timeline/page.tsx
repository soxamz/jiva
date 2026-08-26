import { ActivityIcon, FileTextIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime } from '@/lib/format';
import { getI18n } from '@/lib/i18n';

export default async function TimelinePage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('timeline.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('timeline.description')}</p>
      </div>
      <section className="grid grid-cols-1 gap-4">
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>{t('timeline.allUpdates')}</CardTitle>
            <CardDescription>{t('timeline.allUpdatesDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border flex flex-col divide-y">
              {data.timeline.map((item) => (
                <li className="flex min-h-18 items-start gap-3 px-6 py-4" key={item.id}>
                  <span className="flex size-10 shrink-0 items-center justify-center" aria-hidden>
                    {item.type === 'intake' ? <ActivityIcon /> : <FileTextIcon />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate font-medium">{item.title}</p>
                      <Badge variant={item.redFlag ? 'destructive' : 'secondary'}>
                        {item.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-sm">{item.body}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatDateTime(item.date, locale)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
