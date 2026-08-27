export type VitalKind = 'bp' | 'hr' | 'weight' | 'spo2';

export type VitalStatus = 'elevated' | 'normal' | 'stable' | 'not_recorded';

export type VitalMetric = {
  kind: VitalKind;
  value: string;
  status: VitalStatus;
};

type OcrDoc = {
  structured: {
    extractedJson: Record<string, unknown> | null;
    abnormalValues: Array<{ label: string; value: string; severity: 'low' | 'medium' | 'high' }>;
  } | null;
};

function flattenText(value: unknown, depth = 0): string {
  if (depth > 4 || value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenText(item, depth + 1)).join(' ');
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => flattenText(item, depth + 1))
      .join(' ');
  }
  return '';
}

function findNamedValue(
  blob: string,
  patterns: RegExp[]
): { value: string; elevatedHint: boolean } | null {
  for (const pattern of patterns) {
    const match = blob.match(pattern);
    if (!match?.[1]) continue;
    const value = match[1].trim();
    const elevatedHint = /high|elevat|abnormal|critical/i.test(match[0]);
    return { value, elevatedHint };
  }
  return null;
}

function fromAbnormalValues(
  docs: OcrDoc[],
  namePattern: RegExp
): { value: string; elevatedHint: boolean } | null {
  for (const doc of docs) {
    for (const item of doc.structured?.abnormalValues ?? []) {
      if (!namePattern.test(item.label)) continue;
      return {
        value: item.value,
        elevatedHint: item.severity === 'high' || item.severity === 'medium',
      };
    }
  }
  return null;
}

/** Derive vital display metrics from window OCR; missing values → Not recorded. */
export function extractOverviewVitals(docs: OcrDoc[]): VitalMetric[] {
  const blob = docs
    .map((doc) => {
      const extracted = doc.structured?.extractedJson;
      const abnormals = (doc.structured?.abnormalValues ?? [])
        .map((item) => `${item.label} ${item.value} ${item.severity}`)
        .join(' ');
      return `${flattenText(extracted)} ${abnormals}`;
    })
    .join('\n');

  const bp =
    fromAbnormalValues(docs, /blood\s*pressure|\bbp\b|systolic|diastolic/i) ??
    findNamedValue(blob, [
      /(?:blood\s*pressure|\bbp\b)[^\d]{0,24}(\d{2,3}\s*\/\s*\d{2,3})/i,
      /(\d{2,3}\s*\/\s*\d{2,3})\s*mm\s*hg/i,
    ]);

  const hr =
    fromAbnormalValues(docs, /heart\s*rate|\bpulse\b|\bhr\b/i) ??
    findNamedValue(blob, [
      /(?:heart\s*rate|\bpulse\b|\bhr\b)[^\d]{0,20}(\d{2,3})\s*(?:bpm)?/i,
      /(\d{2,3})\s*bpm/i,
    ]);

  const weight =
    fromAbnormalValues(docs, /weight|\bwt\b|bmi/i) ??
    findNamedValue(blob, [
      /(?:weight|\bwt\b)[^\d]{0,20}(\d{2,3}(?:\.\d+)?)\s*(?:kg|lbs?|lb)?/i,
      /(\d{2,3}(?:\.\d+)?)\s*(?:kg|lbs?)\b/i,
    ]);

  const spo2 =
    fromAbnormalValues(docs, /spo2|oxygen|o2\s*sat/i) ??
    findNamedValue(blob, [
      /(?:spo2|o2\s*sat(?:uration)?|oxygen)[^\d]{0,20}(\d{2,3})\s*%?/i,
      /(\d{2,3})\s*%\s*(?:spo2|on\s*room\s*air)?/i,
    ]);

  const toMetric = (
    kind: VitalKind,
    found: { value: string; elevatedHint: boolean } | null,
    format: (raw: string) => string
  ): VitalMetric => {
    if (!found) {
      return { kind, value: '—', status: 'not_recorded' };
    }
    return {
      kind,
      value: format(found.value),
      status: found.elevatedHint ? 'elevated' : kind === 'weight' ? 'stable' : 'normal',
    };
  };

  return [
    toMetric('bp', bp, (v) => v.replace(/\s+/g, '')),
    toMetric('hr', hr, (v) => (/bpm/i.test(v) ? v : `${v} bpm`)),
    toMetric('weight', weight, (v) => v),
    toMetric('spo2', spo2, (v) => (/%/.test(v) ? v : `${v}%`)),
  ];
}
