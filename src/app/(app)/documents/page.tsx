import { DocumentUploadForm } from "@/components/forms/document-upload-form";
import { DocumentsTable } from "@/components/documents/ocr-result-panel";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPatientWorkspace } from "@/lib/dal";
import { formatBytes, formatDateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import {
  buildOcrHighlights,
  type DocumentListItem,
} from "@/lib/ocr-highlights";

import { MobileRecords } from "@/components/mobile/mobile-records";

export default async function DocumentsPage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();

  const items: DocumentListItem[] = data.documents.map(
    ({ document, structured }) => {
      const extracted =
        structured?.extractedJson &&
        typeof structured.extractedJson === "object"
          ? (structured.extractedJson as Record<string, unknown>)
          : null;

      return {
        id: document.id,
        title: document.title,
        fileName: document.fileName,
        fileUrl: document.storageUrl,
        shareWithDoctor: document.shareWithDoctor,
        docType: document.docType,
        fileSizeLabel: formatBytes(document.fileSizeBytes),
        status: document.status,
        uploadedLabel: formatDateTime(document.uploadedAt, locale),
        confidence: structured?.aiConfidenceScore ?? null,
        abnormalValues: structured?.abnormalValues ?? [],
        highlights: buildOcrHighlights(extracted),
      };
    },
  );

  return (
    <>
      <MobileRecords data={data} />

      <div className="hidden md:flex flex-col gap-6">
        <PageHeader
          description={t("documents.description")}
          title={t("documents.title")}
        />
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.75fr_1.25fr]">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>{t("documents.upload")}</CardTitle>
              <CardDescription>
                {t("documents.uploadDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-dashed bg-muted/30 p-4">
                <DocumentUploadForm />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>{t("documents.saved")}</CardTitle>
              <CardDescription>
                {t("documents.savedDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ScrollArea className="h-[34rem]">
                <DocumentsTable items={items} />
              </ScrollArea>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
