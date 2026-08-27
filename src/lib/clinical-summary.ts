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
  const summary = value as ClinicalSummary;
  const narrative = summary.doctor_english_summary?.trim();
  if (!narrative) return null;
  return summary;
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
  const byDrug = new Map<string, string>();

  const drugKey = (label: string) => {
    const withoutDose = label
      .toLowerCase()
      .replace(/\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|iu|units?)\b/gi, ' ')
      .replace(
        /\b(once|twice|thrice|three times|daily|nightly|bid|tid|qid|od|hs|prn|oral|po|iv|im|every\s+\d+\s+hours?)\b/gi,
        ' '
      )
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return withoutDose || label.toLowerCase().trim();
  };

  const richness = (label: string) =>
    label.length + (/(\d+\s?(?:mg|mcg|g|ml))/i.test(label) ? 20 : 0) + (/\b(daily|bid|tid)/i.test(label) ? 10 : 0);

  for (const med of [...(clinicalMeds ?? []), ...(profileMeds ?? [])]) {
    const label = med.trim();
    if (!label) continue;
    const key = drugKey(label);
    const existing = byDrug.get(key);
    if (!existing || richness(label) > richness(existing)) {
      byDrug.set(key, label);
    }
  }

  return [...byDrug.values()];
}

export type SummarySection = {
  title: string;
  lines: string[];
};

/** Parse `**Heading:**` markdown blocks into titled sections with bullet/body lines. */
export function parseSummarySections(markdown: string): SummarySection[] {
  const text = markdown.trim();
  if (!text) return [];

  const headingRe = /^\*\*([^*]+):\*\*\s*(.*)$/;
  const lines = text.split('\n');
  const sections: SummarySection[] = [];
  let current: SummarySection | null = null;

  const pushCurrent = () => {
    if (!current) return;
    current.lines = current.lines.map((line) => line.trim()).filter(Boolean);
    sections.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(headingRe);
    if (heading) {
      pushCurrent();
      current = {
        title: heading[1].trim(),
        lines: heading[2]?.trim() ? [heading[2].trim()] : [],
      };
      continue;
    }
    if (!current) {
      current = { title: 'Summary', lines: [] };
    }
    current.lines.push(line.replace(/^[-*•]\s+/, '').trim());
  }
  pushCurrent();
  return sections;
}

/** Lightweight markdown for physician narrative: paragraphs + **bold**. */
export function renderSummaryParagraphs(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

/** True when Overview should prefer a local digest narrative over a long/unstructured source. */
export function shouldPreferLocalDigestNarrative(narrative: string | undefined) {
  const text = narrative?.trim() ?? '';
  if (!text) return true;
  if (text.length > 1200) return true;
  const hasAction = /\*\*Action(?:\s+Required)?:\*\*/i.test(text);
  const hasWarnings = /\*\*System Warnings:\*\*/i.test(text);
  const hasStatus = /\*\*Current status:\*\*/i.test(text);
  return !(hasAction || hasWarnings || hasStatus);
}
