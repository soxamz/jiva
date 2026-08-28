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

function mergeOverviewClinical(
  localDigest: ClinicalSummary,
  stored: { clinical: ClinicalSummary; generatedAt: Date } | null
): { clinical: ClinicalSummary; generatedAt: Date; source: 'stored' | 'local' } {
  if (!stored) {
    return { clinical: localDigest, generatedAt: new Date(), source: 'local' };
  }

  const merged = applyLocalDigestIfNeeded(stored.clinical, localDigest);
  return {
    clinical: {
      ...merged,
      doctor_english_summary: localDigest.doctor_english_summary,
      chief_complaint: localDigest.chief_complaint || merged.chief_complaint,
    },
    generatedAt: stored.generatedAt,
    source: 'stored',
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

  const { clinical, generatedAt, source } = mergeOverviewClinical(
    localDigest,
    latestStoredWeekSummary(context.weekIntakes)
  );

  const medications = mergeMedications(
    clinical?.extracted_medications,
    [...(context.profile?.currentMedications ?? []), ...ocrMeds]
  );

  return {
    clinical,
    generatedAt,
    source,
    error: null,
    days: context.days,
    since: context.since,
    user: context.user,
    profile: context.profile,
    weekIntakes: context.weekIntakes,
    weekDocuments: context.weekDocuments,
    medications,
  };
}
