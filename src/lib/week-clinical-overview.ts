import 'server-only';

import {
  asClinicalSummary,
  mergeMedications,
  shouldPreferLocalDigestNarrative,
  type ClinicalAbnormalLab,
  type ClinicalContradiction,
  type ClinicalSummary,
} from '@/lib/clinical-summary';
import { getOcrExtractionsSince, getPatientWeekClinicalContext } from '@/lib/dal';
import { buildLocalClinicalSummary } from '@/lib/local-clinical-summary';
import { labReportsFromExtractions, synthesizeClinicalSummary } from '@/lib/ml3-api';

export const OVERVIEW_RANGES = [7, 30, 90] as const;
export type OverviewRangeDays = (typeof OVERVIEW_RANGES)[number];

export type WeekClinicalOverview = {
  clinical: ClinicalSummary | null;
  generatedAt: Date | null;
  source: 'ml3' | 'stored' | 'local' | 'none';
  error: string | null;
  days: number;
  since: Date;
  user: Awaited<ReturnType<typeof getPatientWeekClinicalContext>>['user'];
  profile: Awaited<ReturnType<typeof getPatientWeekClinicalContext>>['profile'];
  weekIntakes: Awaited<ReturnType<typeof getPatientWeekClinicalContext>>['weekIntakes'];
  weekDocuments: Awaited<ReturnType<typeof getPatientWeekClinicalContext>>['weekDocuments'];
  medications: string[];
};

export function parseOverviewRange(value: string | string[] | undefined): OverviewRangeDays {
  const raw = Array.isArray(value) ? value[0] : value;
  const days = Number(raw);
  if (days === 30 || days === 90 || days === 7) return days;
  return 7;
}

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

function medicationsFromOcr(extractions: Record<string, unknown>[]) {
  const meds: string[] = [];
  for (const extracted of extractions) {
    const clinicalData =
      extracted.clinical_data && typeof extracted.clinical_data === 'object'
        ? (extracted.clinical_data as Record<string, unknown>)
        : null;
    meds.push(
      ...asStringArray(extracted.extracted_medications),
      ...asStringArray(extracted.medications),
      ...asStringArray(clinicalData?.medications)
    );
  }
  return meds;
}

function buildWeekPayload(context: Awaited<ReturnType<typeof getPatientWeekClinicalContext>>) {
  const extractions = context.weekDocuments
    .map(({ structured }) => structured?.extractedJson)
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object');

  const complaints = [
    ...new Set(context.weekIntakes.map((intake) => intake.chiefComplaint.trim()).filter(Boolean)),
  ];

  const allergies = new Set<string>(context.profile?.allergies ?? []);
  const medications = new Set<string>(context.profile?.currentMedications ?? []);
  const comorbidities = new Set<string>(context.profile?.criticalConditions ?? []);
  const redFlags: string[] = [];
  const transcriptRefs: string[] = [];
  let hpi: Record<string, unknown> | null = null;
  let reviewOfSystems: Record<string, unknown> | null = null;
  let ayush: Record<string, unknown> | null = null;

  for (const intake of context.weekIntakes) {
    if (intake.redFlag && intake.redFlagReason) {
      redFlags.push(intake.redFlagReason);
    }
    if (Array.isArray(intake.redFlagDetails)) {
      redFlags.push(...intake.redFlagDetails.filter((item): item is string => typeof item === 'string'));
    }

    transcriptRefs.push(
      `Intake ${intake.createdAt.toISOString()}: ${intake.chiefComplaint}. ${intake.summary}`
    );

    const history = (intake.patientHistory ?? null) as Record<string, unknown> | null;
    if (!history) continue;

    for (const allergy of asStringArray(history.allergies)) allergies.add(allergy);
    for (const med of asStringArray(history.medications)) medications.add(med);
    for (const med of asStringArray(history.prior_medications ? [history.prior_medications] : [])) {
      medications.add(med);
    }
    for (const condition of asStringArray(history.comorbidities)) comorbidities.add(condition);

    if (Array.isArray(history.source_transcript_refs)) {
      transcriptRefs.push(
        ...history.source_transcript_refs.filter((item): item is string => typeof item === 'string')
      );
    }

    if (!hpi && history.hpi && typeof history.hpi === 'object') {
      hpi = history.hpi as Record<string, unknown>;
    }
    if (!reviewOfSystems && history.review_of_systems && typeof history.review_of_systems === 'object') {
      reviewOfSystems = history.review_of_systems as Record<string, unknown>;
    }
    if (!ayush && history.ayush && typeof history.ayush === 'object') {
      ayush = history.ayush as Record<string, unknown>;
    }
  }

  for (const med of medicationsFromOcr(extractions)) {
    medications.add(med);
  }

  return {
    patient_id: context.user.id,
    intake_session_id: context.weekIntakes[0]?.id,
    chief_complaint:
      complaints.length > 0
        ? complaints.join('; ')
        : `Clinical overview (past ${context.days} days)`,
    hpi:
      hpi ??
      (context.weekIntakes[0]
        ? {
            duration: context.weekIntakes[0].symptomDuration,
            location: context.weekIntakes[0].location,
            character: context.weekIntakes[0].character,
            severity: context.weekIntakes[0].severity,
            aggravating: context.weekIntakes[0].aggravatingFactors,
            relieving: context.weekIntakes[0].relievingFactors,
            associated: context.weekIntakes[0].associatedSymptoms,
          }
        : null),
    allergies: [...allergies],
    medications: [...medications],
    comorbidities: [...comorbidities],
    review_of_systems: reviewOfSystems,
    ayush,
    source_transcript_refs: transcriptRefs,
    red_flags: [...new Set(redFlags)],
    lab_reports: labReportsFromExtractions(extractions),
    ocr_documents: extractions,
  };
}

function latestStoredWeekSummary(
  intakes: Awaited<ReturnType<typeof getPatientWeekClinicalContext>>['weekIntakes']
) {
  for (const intake of intakes) {
    const clinical = asClinicalSummary(intake.clinicalSummary);
    if (clinical) {
      return { clinical, generatedAt: intake.createdAt };
    }
  }
  return null;
}

function mergeLabFlags(primary: ClinicalAbnormalLab[] = [], secondary: ClinicalAbnormalLab[] = []) {
  const seen = new Set<string>();
  const merged: ClinicalAbnormalLab[] = [];
  for (const lab of [...primary, ...secondary]) {
    const key = `${lab.test_name.toLowerCase()}|${lab.flagged_value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(lab);
  }
  return merged.slice(0, 12);
}

function mergeContradictions(
  primary: ClinicalContradiction[] = [],
  secondary: ClinicalContradiction[] = []
) {
  const seen = new Set<string>();
  const merged: ClinicalContradiction[] = [];
  for (const item of [...primary, ...secondary]) {
    const key = item.issue.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, 12);
}

function applyLocalDigestIfNeeded(
  clinical: ClinicalSummary,
  localDigest: ClinicalSummary
): ClinicalSummary {
  if (!shouldPreferLocalDigestNarrative(clinical.doctor_english_summary)) {
    return {
      ...clinical,
      extracted_medications: mergeMedications(
        clinical.extracted_medications,
        localDigest.extracted_medications
      ),
      abnormal_lab_flags: mergeLabFlags(
        clinical.abnormal_lab_flags,
        localDigest.abnormal_lab_flags
      ),
      detected_contradictions: mergeContradictions(
        clinical.detected_contradictions,
        localDigest.detected_contradictions
      ),
    };
  }

  return {
    ...clinical,
    doctor_english_summary: localDigest.doctor_english_summary,
    chief_complaint: localDigest.chief_complaint || clinical.chief_complaint,
    extracted_medications: mergeMedications(
      clinical.extracted_medications,
      localDigest.extracted_medications
    ),
    abnormal_lab_flags: mergeLabFlags(
      clinical.abnormal_lab_flags,
      localDigest.abnormal_lab_flags
    ),
    detected_contradictions: mergeContradictions(
      clinical.detected_contradictions,
      localDigest.detected_contradictions
    ),
    triage_alert: clinical.triage_alert || localDigest.triage_alert,
    triage_reasons: [
      ...new Set([...(clinical.triage_reasons ?? []), ...(localDigest.triage_reasons ?? [])]),
    ].slice(0, 8),
  };
}

export async function getWeekClinicalOverview(days: number = 7): Promise<WeekClinicalOverview> {
  const context = await getPatientWeekClinicalContext(days);
  const hasWeekActivity = context.weekIntakes.length > 0 || context.weekDocuments.length > 0;

  if (!hasWeekActivity) {
    return {
      clinical: null,
      generatedAt: null,
      source: 'none',
      error: null,
      days: context.days,
      since: context.since,
      user: context.user,
      profile: context.profile,
      weekIntakes: context.weekIntakes,
      weekDocuments: context.weekDocuments,
      medications: context.profile?.currentMedications ?? [],
    };
  }

  const ocrRows = await getOcrExtractionsSince(context.since);
  const ocrMeds = medicationsFromOcr(
    ocrRows.map((row) => row.extractedJson as Record<string, unknown>)
  );

  const localDigest = buildLocalClinicalSummary({
    intakes: context.weekIntakes,
    documents: context.weekDocuments,
    profile: context.profile,
    days: context.days,
  });

  let clinical: ClinicalSummary | null = null;
  let generatedAt: Date | null = null;
  let source: WeekClinicalOverview['source'] = 'local';
  let error: string | null = null;

  try {
    const synthesized = await synthesizeClinicalSummary(buildWeekPayload(context));
    clinical = asClinicalSummary(synthesized);
    if (clinical) {
      generatedAt = new Date();
      source = 'ml3';
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'ML3 synthesis failed';
  }

  if (!clinical) {
    const stored = latestStoredWeekSummary(context.weekIntakes);
    if (stored) {
      clinical = stored.clinical;
      generatedAt = stored.generatedAt;
      source = 'stored';
    }
  }

  if (!clinical) {
    clinical = localDigest;
    generatedAt = new Date();
    source = 'local';
  } else if (source === 'ml3' || source === 'stored') {
    clinical = applyLocalDigestIfNeeded(clinical, localDigest);
  }

  const medications = mergeMedications(
    clinical?.extracted_medications,
    [...(context.profile?.currentMedications ?? []), ...ocrMeds]
  );

  return {
    clinical,
    generatedAt,
    source,
    error,
    days: context.days,
    since: context.since,
    user: context.user,
    profile: context.profile,
    weekIntakes: context.weekIntakes,
    weekDocuments: context.weekDocuments,
    medications,
  };
}
