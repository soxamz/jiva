export type DocumentListItem = {
  id: string;
  title: string;
  fileName: string;
  docType: string;
  fileSizeLabel: string;
  status: string;
  uploadedLabel: string;
  confidence: number | null;
  abnormalValues: Array<{ label: string; value: string; severity: 'low' | 'medium' | 'high' }>;
  highlights: string[];
  rawJson: string | null;
};

export function buildOcrHighlights(extracted: Record<string, unknown> | null | undefined) {
  if (!extracted) return [] as string[];

  const lines: string[] = [];
  const docType = extracted.document_type ?? extracted.kind;
  if (typeof docType === 'string' && docType.trim()) {
    lines.push(`Type: ${docType}`);
  }

  const meds =
    (extracted.extracted_medications as unknown) ??
    (extracted.medications as unknown) ??
    ((extracted.clinical_data as Record<string, unknown> | undefined)?.medications as unknown);

  if (Array.isArray(meds) && meds.length > 0) {
    const labels = meds
      .map((med) => {
        if (typeof med === 'string') return med;
        if (med && typeof med === 'object' && 'name' in med) {
          return String((med as { name?: unknown }).name ?? '');
        }
        return '';
      })
      .filter(Boolean)
      .slice(0, 6);
    if (labels.length) lines.push(`Medications: ${labels.join(', ')}`);
  }

  const clinicalData =
    extracted.clinical_data && typeof extracted.clinical_data === 'object'
      ? (extracted.clinical_data as Record<string, unknown>)
      : null;
  const results = Array.isArray(clinicalData?.clinical_results)
    ? clinicalData.clinical_results
    : Array.isArray(extracted.clinical_results)
      ? extracted.clinical_results
      : [];
  if (results.length > 0) {
    const sample = results
      .slice(0, 4)
      .map((row) => {
        if (!row || typeof row !== 'object') return '';
        const item = row as Record<string, unknown>;
        const name = item.test_name ?? item.name ?? item.test;
        const value = item.value;
        if (!name || value == null) return '';
        return `${String(name)} ${String(value)}${item.unit ? ` ${item.unit}` : ''}`;
      })
      .filter(Boolean);
    if (sample.length) lines.push(`Labs: ${sample.join('; ')}`);
  }

  const status = extracted.status;
  if (typeof status === 'string' && status.trim()) {
    lines.push(`OCR status: ${status}`);
  }

  const confidence = extracted.confidence;
  if (confidence && typeof confidence === 'object') {
    const final = (confidence as { final?: unknown }).final;
    if (typeof final === 'number') {
      const pct = final <= 1 ? Math.round(final * 100) : Math.round(final);
      lines.push(`Model confidence: ${pct}%`);
    }
  }

  return lines.slice(0, 8);
}
