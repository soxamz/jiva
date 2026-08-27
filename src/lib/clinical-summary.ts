export type ClinicalContradiction = {
  issue: string;
  severity: string;
  source_reference?: string;
};

export type ClinicalAbnormalLab = {
  test_name: string;
  flagged_value: string;
  clinical_significance: string;
};

export type ClinicalSummary = {
  doctor_english_summary?: string;
  extracted_medications?: string[];
  detected_contradictions?: ClinicalContradiction[];
  abnormal_lab_flags?: ClinicalAbnormalLab[];
  triage_alert?: boolean;
  triage_action?: string | null;
  triage_reasons?: string[];
  chief_complaint?: string;
  patient_audio_confirmation?: string;
};

export function asClinicalSummary(value: unknown): ClinicalSummary | null {
  if (!value || typeof value !== 'object') return null;
  return value as ClinicalSummary;
}

export function normalizeSeverity(value: string | undefined) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
  }
  return 'medium';
}

export function hasHighSeverityContradiction(clinical: ClinicalSummary | null) {
  if (!clinical?.detected_contradictions?.length) return false;
  return clinical.detected_contradictions.some(
    (item) => normalizeSeverity(item.severity) === 'high'
  );
}

export function parseActionItems(markdown: string | undefined, triageAction?: string | null) {
  const actions: string[] = [];

  if (markdown) {
    const match = markdown.match(
      /\*\*Action Required:\*\*([\s\S]*?)(?=\n\s*\*\*[A-Za-z][^*]*:\*\*|$)/i
    );
    const block = match?.[1]?.trim() ?? '';
    if (block) {
      const lines = block
        .split('\n')
        .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter(Boolean);
      actions.push(...lines);
    }
  }

  if (triageAction && triageAction !== 'PROCEED_TO_SYNTHESIS' && triageAction !== 'continue') {
    actions.unshift(
      triageAction === 'IMMEDIATE_BYPASS' || triageAction === 'bypass_queue'
        ? 'Prioritize urgent clinical review (triage bypass suggested).'
        : `Triage action: ${triageAction}`
    );
  }

  return [...new Set(actions)].slice(0, 8);
}

export function mergeMedications(
  clinicalMeds: string[] | undefined,
  profileMeds: string[] | undefined
) {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const med of [...(clinicalMeds ?? []), ...(profileMeds ?? [])]) {
    const label = med.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(label);
  }
  return merged;
}

/** Lightweight markdown for physician narrative: paragraphs + **bold**. */
export function renderSummaryParagraphs(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}
