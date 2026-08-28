import { labReportsFromExtractions, type Ml3SynthesizePayload } from '@/lib/ml3-api';

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

function medicationsFromHistory(history: Record<string, unknown>): string[] {
  const meds = [...asStringArray(history.medications)];
  if (history.prior_medications) {
    meds.push(...asStringArray([history.prior_medications]));
  }
  return meds;
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
      ...asStringArray(clinicalData?.medications),
    );
  }
  return meds;
}

export type Ml3PayloadInput = {
  ml1Histories: Record<string, unknown>[];
  ml2Documents: Record<string, unknown>[];
  meta?: {
    patient_id?: string;
    intake_session_id?: string;
    red_flags?: string[];
    chief_complaint?: string | null;
    days?: number;
    profileAllergies?: string[];
    profileMedications?: string[];
    profileComorbidities?: string[];
    intakeRedFlags?: string[];
    intakeColumns?: {
      symptomDuration?: string | null;
      location?: string | null;
      character?: string | null;
      severity?: number | null;
      aggravatingFactors?: string | null;
      relievingFactors?: string | null;
      associatedSymptoms?: string | null;
    };
  };
};

/** Fuse final ML1 PatientHistory blob(s) + ML2 extracted_json into an ML3 synthesize payload. */
export function buildMl3Payload(input: Ml3PayloadInput): Ml3SynthesizePayload {
  const { ml1Histories, ml2Documents, meta = {} } = input;

  const allergies = new Set<string>(meta.profileAllergies ?? []);
  const medications = new Set<string>(meta.profileMedications ?? []);
  const comorbidities = new Set<string>(meta.profileComorbidities ?? []);
  const redFlags = new Set<string>(meta.red_flags ?? []);
  const transcriptRefs: string[] = [];
  const complaints: string[] = [];

  let hpi: Record<string, unknown> | null = null;
  let reviewOfSystems: Record<string, unknown> | null = null;
  let ayush: Record<string, unknown> | null = null;

  for (const history of ml1Histories) {
    if (typeof history.chief_complaint === 'string' && history.chief_complaint.trim()) {
      complaints.push(history.chief_complaint.trim());
    }
    for (const allergy of asStringArray(history.allergies)) allergies.add(allergy);
    for (const med of medicationsFromHistory(history)) medications.add(med);
    for (const condition of asStringArray(history.comorbidities)) comorbidities.add(condition);
    if (Array.isArray(history.red_flags)) {
      for (const flag of history.red_flags) {
        if (typeof flag === 'string' && flag.trim()) redFlags.add(flag.trim());
      }
    }
    if (Array.isArray(history.source_transcript_refs)) {
      transcriptRefs.push(
        ...history.source_transcript_refs.filter((item): item is string => typeof item === 'string'),
      );
    }
    if (history.hpi && typeof history.hpi === 'object') {
      hpi = history.hpi as Record<string, unknown>;
    }
    if (history.review_of_systems && typeof history.review_of_systems === 'object') {
      reviewOfSystems = history.review_of_systems as Record<string, unknown>;
    }
    if (history.ayush && typeof history.ayush === 'object') {
      ayush = history.ayush as Record<string, unknown>;
    }
  }

  for (const flag of meta.intakeRedFlags ?? []) {
    if (flag?.trim()) redFlags.add(flag.trim());
  }

  for (const med of medicationsFromOcr(ml2Documents)) {
    medications.add(med);
  }

  const chiefComplaint =
    meta.chief_complaint ??
    (complaints.length > 0
      ? [...new Set(complaints)].join('; ')
      : meta.days
        ? `Clinical overview (past ${meta.days} days)`
        : null);

  const columns = meta.intakeColumns;
  const fallbackHpi = columns
    ? {
        duration: columns.symptomDuration,
        location: columns.location,
        character: columns.character,
        severity: columns.severity,
        aggravating: columns.aggravatingFactors,
        relieving: columns.relievingFactors,
        associated: columns.associatedSymptoms,
      }
    : null;

  return {
    patient_id: meta.patient_id,
    intake_session_id: meta.intake_session_id,
    chief_complaint: chiefComplaint,
    hpi: hpi ?? fallbackHpi,
    allergies: [...allergies],
    medications: [...medications],
    comorbidities: [...comorbidities],
    review_of_systems: reviewOfSystems,
    ayush,
    source_transcript_refs: [...new Set(transcriptRefs)],
    red_flags: [...redFlags],
    lab_reports: labReportsFromExtractions(ml2Documents),
    ocr_documents: ml2Documents,
    ml1_histories: ml1Histories,
    ml2_documents: ml2Documents,
  };
}
