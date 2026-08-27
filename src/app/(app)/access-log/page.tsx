import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime } from '@/lib/format';
import { getI18n } from '@/lib/i18n';

export default async function AccessLogPage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader description={t('accessLog.description')} title={t('accessLog.title')} />
      <section className="grid grid-cols-1 gap-4">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t('accessLog.recent')}</CardTitle>
            <CardDescription>{t('accessLog.recentDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableCaption className="sr-only">Recent audit activity.</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="ps-6">{t('accessLog.what')}</TableHead>
                  <TableHead>{t('accessLog.related')}</TableHead>
                  <TableHead className="pe-6 text-right">{t('accessLog.time')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.auditLogs.map((log) => (
                  <TableRow className="h-14" key={log.id}>
                    <TableCell className="ps-6">
                      <StatusPill tone={log.action === 'BREAK_GLASS' ? 'critical' : 'neutral'}>
                        {log.action.replaceAll('_', ' ').toLowerCase()}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="font-medium">{log.targetResourceType ?? 'system'}</TableCell>
                    <TableCell className="text-muted-foreground pe-6 text-right tabular-nums">
                      {formatDateTime(log.createdAt, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
