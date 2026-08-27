import { DocumentUploadForm } from '@/components/forms/document-upload-form';
import { Badge } from '@/components/ui/badge';
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
import { formatBytes, formatDateTime } from '@/lib/format';
import { getI18n } from '@/lib/i18n';

export default async function DocumentsPage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('documents.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('documents.description')}</p>
      </div>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>{t('documents.upload')}</CardTitle>
            <CardDescription>{t('documents.uploadDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentUploadForm />
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>{t('documents.saved')}</CardTitle>
            <CardDescription>{t('documents.savedDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableCaption className="sr-only">Uploaded medical document metadata.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-6">{t('documents.document')}</TableHead>
                  <TableHead>{t('documents.type')}</TableHead>
                  <TableHead>{t('documents.size')}</TableHead>
                  <TableHead>{t('documents.status')}</TableHead>
                  <TableHead className="pe-6 text-right">{t('documents.uploaded')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.documents.map(({ document }) => (
                  <TableRow className="h-12" key={document.id}>
                    <TableCell className="max-w-48 ps-6">
                      <p className="truncate font-medium">{document.title}</p>
                      <p className="text-muted-foreground truncate text-xs">{document.fileName}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{document.docType}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatBytes(document.fileSizeBytes)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={document.status === 'processed' ? 'success' : 'secondary'}>
                        {document.status === 'processed'
                          ? t('documents.ready')
                          : t('documents.processing')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground pe-6 text-right">
                      {formatDateTime(document.uploadedAt, locale)}
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
