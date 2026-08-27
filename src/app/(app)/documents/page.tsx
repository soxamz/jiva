import { DocumentUploadForm } from '@/components/forms/document-upload-form';
import { DocumentsTable } from '@/components/documents/ocr-result-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';
import { formatBytes, formatDateTime } from '@/lib/format';
import { getI18n } from '@/lib/i18n';
import { buildOcrHighlights, type DocumentListItem } from '@/lib/ocr-highlights';

export default async function DocumentsPage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();

  const items: DocumentListItem[] = data.documents.map(({ document, structured }) => {
    const extracted =
      structured?.extractedJson && typeof structured.extractedJson === 'object'
        ? (structured.extractedJson as Record<string, unknown>)
        : null;

    return {
      id: document.id,
      title: document.title,
      fileName: document.fileName,
      docType: document.docType,
      fileSizeLabel: formatBytes(document.fileSizeBytes),
      status: document.status,
      uploadedLabel: formatDateTime(document.uploadedAt, locale),
      confidence: structured?.aiConfidenceScore ?? null,
      abnormalValues: structured?.abnormalValues ?? [],
      highlights: buildOcrHighlights(extracted),
      rawJson: extracted ? JSON.stringify(extracted, null, 2) : null,
    };
  });

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
            <DocumentsTable items={items} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
