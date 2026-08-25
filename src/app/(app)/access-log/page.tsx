import { DashboardCard } from '@/components/dashboard-card';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

export default async function AccessLogPage() {
  const data = await getPatientWorkspace();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Audit log</h1>
        <p className="text-muted-foreground text-sm">
          Database-backed audit trail with mock blockchain hashes.
        </p>
      </div>
      <section className="bg-border grid grid-cols-1 gap-px p-px">
        <DashboardCard className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Every demo mutation writes a persistent log row.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableCaption className="sr-only">Recent audit activity.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-6">Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead className="pe-6 text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.auditLogs.map((log) => (
                  <TableRow className="h-12" key={log.id}>
                    <TableCell className="ps-6">
                      <Badge variant={log.action === 'BREAK_GLASS' ? 'destructive' : 'secondary'}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.targetResourceType ?? 'system'}</TableCell>
                    <TableCell className="max-w-72 truncate font-mono text-xs">
                      {log.blockchainTxHash}
                    </TableCell>
                    <TableCell className="text-muted-foreground pe-6 text-right">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </DashboardCard>
      </section>
    </div>
  );
}
