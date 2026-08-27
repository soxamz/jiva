'use client';

import { Fragment, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useI18n } from '@/components/i18n-provider';
import { type DocumentListItem } from '@/lib/ocr-highlights';
import { cn } from '@/lib/utils';

export type { DocumentListItem };

function OcrResultPanel({
  highlights,
  abnormalValues,
  rawJson,
}: {
  highlights: string[];
  abnormalValues: DocumentListItem['abnormalValues'];
  rawJson: string | null;
}) {
  const { t } = useI18n();

  return (
    <div className="bg-muted/30 flex flex-col gap-3 rounded-xl border p-4">
      {highlights.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">{t('documents.ocrHighlights')}</p>
          <ul className="text-muted-foreground list-disc space-y-1 ps-5 text-sm">
            {highlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t('documents.ocrNoHighlights')}</p>
      )}

      {abnormalValues.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {abnormalValues.map((item) => (
            <Badge
              key={`${item.label}-${item.value}`}
              variant={item.severity === 'high' ? 'destructive' : 'secondary'}
            >
              {item.label}: {item.value}
            </Badge>
          ))}
        </div>
      ) : null}

      {rawJson ? (
        <details className="group">
          <summary className="text-primary cursor-pointer text-sm font-medium">
            {t('documents.ocrFullResult')}
          </summary>
          <pre className="bg-background mt-2 max-h-64 overflow-auto rounded-lg border p-3 text-xs leading-5">
            {rawJson}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function DocumentsTable({ items }: { items: DocumentListItem[] }) {
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="text-muted-foreground px-6 py-8 text-sm">{t('documents.empty')}</p>;
  }

  return (
    <Table>
      <TableCaption className="sr-only">Uploaded medical documents with OCR results.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10 ps-4" />
          <TableHead>{t('documents.document')}</TableHead>
          <TableHead>{t('documents.type')}</TableHead>
          <TableHead>{t('documents.confidence')}</TableHead>
          <TableHead>{t('documents.status')}</TableHead>
          <TableHead className="pe-6 text-right">{t('documents.uploaded')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const open = openId === item.id;
          return (
            <Fragment key={item.id}>
              <TableRow
                className={cn('h-12 cursor-pointer', open && 'bg-muted/40')}
                onClick={() => setOpenId(open ? null : item.id)}
              >
                <TableCell className="ps-4">
                  {open ? (
                    <ChevronDownIcon className="text-muted-foreground size-4" />
                  ) : (
                    <ChevronRightIcon className="text-muted-foreground size-4" />
                  )}
                </TableCell>
                <TableCell className="max-w-56">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{item.fileName}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{item.docType}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {item.confidence != null ? `${item.confidence}%` : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={item.status === 'processed' ? 'secondary' : 'outline'}>
                    {item.status === 'processed'
                      ? t('documents.ready')
                      : item.status === 'failed'
                        ? t('documents.failed')
                        : t('documents.processing')}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground pe-6 text-right text-sm">
                  {item.uploadedLabel}
                </TableCell>
              </TableRow>
              {open ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell className="bg-muted/20 p-4" colSpan={6}>
                    <OcrResultPanel
                      abnormalValues={item.abnormalValues}
                      highlights={item.highlights}
                      rawJson={item.rawJson}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
