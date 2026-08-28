import {
  mergeMedications,
  type ClinicalAbnormalLab,
  type ClinicalContradiction,
  type ClinicalSummary,
} from '@/lib/clinical-summary';

type IntakeLike = {
  chiefComplaint: string;
  summary: string;
  redFlag: boolean;
  redFlagReason: string | null;
  redFlagDetails?: string[] | null;
  symptomDuration?: string | null;
  location?: string | null;
  character?: string | null;
  severity?: number | null;
  createdAt: Date;
};

type DocumentLike = {
  document: {
    title: string;
    docType: string;
    uploadedAt: Date;
  };
  structured: {
    extractedJson: Record<string, unknown> | null;
    abnormalValues: Array<{ label: string; value: string; severity: 'low' | 'medium' | 'high' }>;
    aiConfidenceScore?: number | null;
  } | null;
};

type ProfileLike = {
  allergies?: string[] | null;
  currentMedications?: string[] | null;
  criticalConditions?: string[] | null;
} | null;

const NOISE_COMPLAINTS = new Set([
  'hi',
  'hello',
  'hola',
  'hey',
  'test',
  'ok',
  'okay',
  'none',
  'n/a',
  'na',
]);

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'name' in item) {
        return String((item as { name?: unknown }).name ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function medicationsFromExtraction(extracted: Record<string, unknown>) {
  const clinicalData =
    extracted.clinical_data && typeof extracted.clinical_data === 'object'
      ? (extracted.clinical_data as Record<string, unknown>)
      : null;
  return [
    ...asStringArray(extracted.extracted_medications),
    ...asStringArray(extracted.medications),
    ...asStringArray(clinicalData?.medications),
  ];
}

function normalizeComplaintKey(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(acute|severe|ongoing|lasting|for|days?|day|the|a|an|with|and)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoiseComplaint(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;
  if (NOISE_COMPLAINTS.has(trimmed.toLowerCase())) return true;
  if (/^(hi|hey|hello|hola)[\s!.]*$/i.test(trimmed)) return true;
  return false;
}

function shortAssociations(summary: string | undefined) {
  if (!summary?.trim()) return null;
  const assoc =
    summary.match(/Associations?:\s*([^\n.]+)/i)?.[1] ??
    summary.match(/Associated [Ss]ymptoms?:\s*([^\n.]+)/i)?.[1];
  if (!assoc) return null;
  const cleaned = assoc.replace(/\s+/g, ' ').trim();
  if (!cleaned || /^(none|no|n\/a|denied)/i.test(cleaned)) return null;
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}…` : cleaned;
}

function parseRedFlagPayload(raw: string): {
  contradictions: ClinicalContradiction[];
  labs: ClinicalAbnormalLab[];
  plain?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) {
    return { contradictions: [], labs: [], plain: trimmed };
  }
  try {
    const parsed = JSON.parse(trimmed) as {
      contradictions?: Array<{
        issue?: string;
        severity?: string;
        source_reference?: string;
      }>;
      abnormal_labs?: Array<{
        test_name?: string;
        flagged_value?: string;
        clinical_significance?: string;
      }>;
    };
    const contradictions = (parsed.contradictions ?? [])
      .filter((item) => item.issue?.trim())
      .map((item) => ({
        issue: item.issue!.trim(),
        severity: item.severity?.trim() || 'medium',
        source_reference: item.source_reference?.trim(),
      }));
    const labs = (parsed.abnormal_labs ?? [])
      .filter((item) => item.test_name?.trim() && item.flagged_value?.trim())
      .map((item) => ({
        test_name: item.test_name!.trim(),
        flagged_value: item.flagged_value!.trim(),
        clinical_significance:
          item.clinical_significance?.trim() || 'Abnormal lab flagged in intake triage',
      }));
    return { contradictions, labs };
  } catch {
    return { contradictions: [], labs: [], plain: trimmed };
  }
}

function pickCanonicalComplaints(intakes: IntakeLike[]) {
  const ranked = intakes
    .map((intake) => ({
      text: intake.chiefComplaint.trim(),
      severity: typeof intake.severity === 'number' ? intake.severity : 0,
      at: intake.createdAt.getTime(),
      redFlag: intake.redFlag,
    }))
    .filter((item) => item.text && !isNoiseComplaint(item.text))
    .sort((a, b) => {
      if (b.redFlag !== a.redFlag) return Number(b.redFlag) - Number(a.redFlag);
      if (b.severity !== a.severity) return b.severity - a.severity;
      return b.at - a.at;
    });

  const picked: Array<{ text: string; severity: number }> = [];
  for (const item of ranked) {
    const key = normalizeComplaintKey(item.text);
    const duplicate = picked.some((existing) => {
      const existingKey = normalizeComplaintKey(existing.text);
      return (
        existingKey === key ||
        existingKey.includes(key) ||
        key.includes(existingKey) ||
        (existingKey.length > 8 &&
          key.length > 8 &&
          (existingKey.includes(key.slice(0, 12)) || key.includes(existingKey.slice(0, 12))))
      );
    });
    if (duplicate) continue;
    picked.push({ text: item.text.replace(/\.$/, ''), severity: item.severity });
    if (picked.length >= 4) break;
  }
  return picked;
}

function formatComplaintLine(item: { text: string; severity: number }) {
  const title = item.text.length > 72 ? `${item.text.slice(0, 69)}…` : item.text;
  return item.severity > 0 ? `${title} (**${item.severity}/10**)` : title;
}

function addLab(
  labs: ClinicalAbnormalLab[],
  lab: ClinicalAbnormalLab,
  seen: Set<string>
) {
  const key = `${lab.test_name.toLowerCase()}|${lab.flagged_value.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  labs.push(lab);
}

function addContradiction(
  items: ClinicalContradiction[],
  item: ClinicalContradiction,
  seen: Set<string>
) {
  const key = item.issue.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  items.push(item);
}

/** Deterministic physician-style digest from window intakes + OCR (no ML3). */
export function buildLocalClinicalSummary(input: {
  intakes: IntakeLike[];
  documents: DocumentLike[];
  profile?: ProfileLike;
  days: number;
}): ClinicalSummary {
  const triageAlert = input.intakes.some((intake) => intake.redFlag);
  const canonicalComplaints = pickCanonicalComplaints(input.intakes);

  const contradictions: ClinicalContradiction[] = [];
  const contradictionSeen = new Set<string>();
  const abnormalLabs: ClinicalAbnormalLab[] = [];
  const labSeen = new Set<string>();
  const plainRedFlags: string[] = [];

  for (const intake of input.intakes) {
    if (intake.redFlag && intake.redFlagReason?.trim()) {
      const reason = intake.redFlagReason.trim();
      if (!reason.startsWith('{')) {
        plainRedFlags.push(reason);
      }
    }
    for (const detail of intake.redFlagDetails ?? []) {
      if (typeof detail !== 'string' || !detail.trim()) continue;
      const parsed = parseRedFlagPayload(detail);
      for (const item of parsed.contradictions) {
        addContradiction(contradictions, item, contradictionSeen);
      }
      for (const lab of parsed.labs) {
        addLab(abnormalLabs, lab, labSeen);
      }
      if (parsed.plain) plainRedFlags.push(parsed.plain);
    }
  }

  const ocrMeds: string[] = [];
  const docTypeCounts = new Map<string, number>();

  for (const { document, structured } of input.documents) {
    const extracted =
      structured?.extractedJson && typeof structured.extractedJson === 'object'
        ? structured.extractedJson
        : null;
    ocrMeds.push(...(extracted ? medicationsFromExtraction(extracted) : []));

    const typeKey = (document.docType || 'document').toLowerCase();
    docTypeCounts.set(typeKey, (docTypeCounts.get(typeKey) ?? 0) + 1);

    for (const abnormal of structured?.abnormalValues ?? []) {
      addLab(
        abnormalLabs,
        {
          test_name: abnormal.label,
          flagged_value: abnormal.value,
          clinical_significance: `${abnormal.severity} severity flag from OCR`,
        },
        labSeen
      );
    }
  }

  const medications = mergeMedications(ocrMeds, input.profile?.currentMedications ?? []);
  const allergies = input.profile?.allergies ?? [];
  const conditions = input.profile?.criticalConditions ?? [];

  const presentationCandidates = [...input.intakes]
    .filter((intake) => intake.chiefComplaint.trim() && !isNoiseComplaint(intake.chiefComplaint))
    .sort((a, b) => {
      const sevA = typeof a.severity === 'number' ? a.severity : 0;
      const sevB = typeof b.severity === 'number' ? b.severity : 0;
      if (b.redFlag !== a.redFlag) return Number(b.redFlag) - Number(a.redFlag);
      if (sevB !== sevA) return sevB - sevA;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const presentationLines: string[] = [];
  const presentationSeen = new Set<string>();
  for (const intake of presentationCandidates) {
    const key = normalizeComplaintKey(intake.chiefComplaint);
    if (presentationSeen.has(key)) continue;
    presentationSeen.add(key);

    const date = intake.createdAt.toISOString().slice(0, 10);
    const sev =
      typeof intake.severity === 'number' ? `**${intake.severity}/10**` : null;
    const assoc = shortAssociations(intake.summary);
    const bits = [
      intake.chiefComplaint.replace(/\.$/, ''),
      sev,
      intake.symptomDuration ? `duration ${intake.symptomDuration}` : null,
      assoc ? `assoc: ${assoc}` : null,
    ].filter(Boolean);
    presentationLines.push(`${date} — ${bits.join(' · ')}`);
    if (presentationLines.length >= 5) break;
  }

  if (input.documents.length > 0) {
    const typeSummary = [...docTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([type, count]) => `${type}${count > 1 ? `×${count}` : ''}`)
      .join(', ');
    presentationLines.push(
      `**${input.documents.length}** vault documents in window (${typeSummary || 'records'})`
    );
  }

  const warningLines: string[] = [];
  for (const flag of [...new Set(plainRedFlags)].slice(0, 3)) {
    warningLines.push(flag.length > 140 ? `${flag.slice(0, 137)}…` : flag);
  }
  for (const item of contradictions.slice(0, 4)) {
    const sev = item.severity ? `**${item.severity}**` : null;
    warningLines.push([sev, item.issue].filter(Boolean).join(': '));
  }
  for (const lab of abnormalLabs.slice(0, 4)) {
    warningLines.push(
      `**${lab.test_name}** ${lab.flagged_value} (${lab.clinical_significance})`
    );
  }
  if (allergies.length) {
    warningLines.push(`Known allergies: **${allergies.slice(0, 5).join(', ')}**`);
  }
  if (conditions.length) {
    warningLines.push(`Critical conditions: **${conditions.slice(0, 4).join(', ')}**`);
  }
  const uniqueWarnings = [...new Set(warningLines)].slice(0, 6);
  if (uniqueWarnings.length === 0) {
    uniqueWarnings.push('No critical system warnings flagged in this window.');
  }

  const actions: string[] = [];
  if (triageAlert || contradictions.some((c) => /high/i.test(c.severity))) {
    actions.push('Prioritize **urgent clinical review** based on red-flag symptom check(s).');
  }
  if (abnormalLabs.length) {
    actions.push('Review **abnormal lab values** with the care team.');
  }
  if (medications.length) {
    actions.push(
      `Reconcile active medications: **${medications.slice(0, 4).join(', ')}**.`
    );
  }
  actions.push('Correlate recent intakes with uploaded reports for the selected window.');
  const uniqueActions = [...new Set(actions)].slice(0, 4);

  const chief =
    canonicalComplaints.length > 0
      ? canonicalComplaints
          .map((item) =>
            item.severity > 0
              ? `${item.text.replace(/\.$/, '')} (sev ${item.severity}/10)`
              : item.text.replace(/\.$/, '')
          )
          .join('; ')
      : input.documents.length > 0
        ? 'Document review / records update'
        : 'No chief complaint recorded';

  const topSeverity = Math.max(0, ...canonicalComplaints.map((c) => c.severity));
  const statusBits = [
    canonicalComplaints.length
      ? `Window focuses on **${canonicalComplaints[0].text.replace(/\.$/, '')}**`
      : `Past **${input.days}** days of vault activity`,
    topSeverity >= 8 ? `peak severity **${topSeverity}/10**` : null,
    triageAlert ? '**triage alert** present' : null,
    abnormalLabs.length ? `**${abnormalLabs.length}** abnormal lab flag(s)` : null,
    `${input.intakes.length} intake(s), ${input.documents.length} document(s)`,
  ].filter(Boolean);

  const doctor_english_summary = [
    `**Current status:** ${statusBits.join(' · ')}.`,
    '',
    '**Chief complaints:**',
    canonicalComplaints.length > 0
      ? canonicalComplaints.map((item) => `- ${formatComplaintLine(item)}`).join('\n')
      : '- No clinically meaningful chief complaint in this window.',
    '',
    '**Key findings:**',
    presentationLines.length > 0
      ? presentationLines.map((line) => `- ${line}`).join('\n')
      : '- No detailed presentation notes in this window.',
    medications.length
      ? `- Active medications considered: **${medications.slice(0, 6).join(', ')}**.`
      : '',
    '',
    '**System warnings:**',
    uniqueWarnings.map((line) => `- ${line}`).join('\n'),
    '',
    '**Action required:**',
    uniqueActions.map((line) => `- ${line}`).join('\n'),
  ]
    .filter((line) => line !== '')
    .join('\n');

  return {
    chief_complaint: chief,
    doctor_english_summary,
    extracted_medications: medications,
    abnormal_lab_flags: abnormalLabs.slice(0, 12),
    detected_contradictions: contradictions.slice(0, 12),
    triage_alert: triageAlert,
    triage_action: triageAlert ? 'IMMEDIATE_BYPASS' : 'PROCEED_TO_SYNTHESIS',
    triage_reasons: plainRedFlags.slice(0, 8),
    patient_audio_confirmation: `Past ${input.days} days: ${chief}.`,
  };
}
