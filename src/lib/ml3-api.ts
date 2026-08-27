const ml3ApiBase =
  process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:5328/api' : '/api';

function ml3ApiPath(path: string) {
  return `${ml3ApiBase}${path}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string') return data.detail;
    return JSON.stringify(data);
  } catch {
    return res.statusText || 'ML3 request failed';
  }
}

export type ClinicalSummaryResult = {
  chief_complaint?: string;
  doctor_english_summary?: string;
  patient_audio_confirmation?: string;
  extracted_medications?: string[];
  detected_contradictions?: Array<{
    issue: string;
    severity: string;
    source_reference: string;
  }>;
  abnormal_lab_flags?: Array<{
    test_name: string;
    flagged_value: string;
    clinical_significance: string;
  }>;
  triage_alert?: boolean;
  triage_reasons?: string[];
  triage_action?: string;
  [key: string]: unknown;
};

export type Ml3SynthesizePayload = {
  patient_id?: string;
  intake_session_id?: string;
  chief_complaint?: string | null;
  hpi?: Record<string, unknown> | null;
  allergies?: unknown[];
  medications?: unknown[];
  comorbidities?: unknown[];
  review_of_systems?: Record<string, unknown> | null;
  ayush?: Record<string, unknown> | null;
  source_transcript_refs?: string[];
  red_flags?: string[];
  lab_reports?: unknown[];
  ocr_documents?: Record<string, unknown>[];
};

/** Map ML2 extracted_json blobs into the lab_reports shape expected by ML3. */
export function labReportsFromExtractions(extractions: Record<string, unknown>[]) {
  const reports: unknown[] = [];

  for (const extracted of extractions) {
    const nestedLabs = extracted.lab_reports;
    if (Array.isArray(nestedLabs)) {
      reports.push(...nestedLabs);
      continue;
    }

    const clinical =
      (extracted.clinical_data as Record<string, unknown> | undefined) ??
      (extracted.clinical as Record<string, unknown> | undefined);

    const panels =
      (clinical?.lab_reports as unknown[] | undefined) ??
      (extracted.labs as unknown[] | undefined) ??
      (extracted.laboratory as unknown[] | undefined);

    if (Array.isArray(panels) && panels.length > 0) {
      reports.push(...panels);
      continue;
    }

    // Fall back: attach whole extraction as an opaque OCR document panel.
    reports.push({
      panel: String(extracted.document_type ?? extracted.kind ?? 'OCR_DOCUMENT'),
      clinical_results: [],
      raw: extracted,
    });
  }

  return reports;
}

export async function synthesizeClinicalSummary(payload: Ml3SynthesizePayload) {
  const res = await fetch(ml3ApiPath('/ml3/synthesize'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as ClinicalSummaryResult;
}
