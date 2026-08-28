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
  ml1_histories?: Record<string, unknown>[];
  ml2_documents?: Record<string, unknown>[];
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "name" in item) {
        return String((item as { name?: unknown }).name ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

function medicationsFromHistory(history: Record<string, unknown>) {
  const medications = [...asStringArray(history.medications)];
  if (history.prior_medications) {
    medications.push(...asStringArray([history.prior_medications]));
  }
  return medications;
}

function medicationsFromOcr(extractions: Record<string, unknown>[]) {
  const medications: string[] = [];

  for (const extracted of extractions) {
    const clinicalData =
      extracted.clinical_data && typeof extracted.clinical_data === "object"
        ? (extracted.clinical_data as Record<string, unknown>)
        : null;

    medications.push(
      ...asStringArray(extracted.extracted_medications),
      ...asStringArray(extracted.medications),
      ...asStringArray(clinicalData?.medications),
    );
  }

  return medications;
}

/** Map ML2 extracted_json blobs into the lab_reports shape expected by ML3. */
export function labReportsFromExtractions(
  extractions: Record<string, unknown>[],
) {
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

    reports.push({
      panel: String(
        extracted.document_type ?? extracted.kind ?? "OCR_DOCUMENT",
      ),
      clinical_results: [],
      raw: extracted,
    });
  }

  return reports;
}

export type Ml3PayloadInput = {
  ml1Histories: Record<string, unknown>[];
  ml2Documents: Record<string, unknown>[];
  meta?: {
    patientId?: string;
    intakeSessionId?: string;
    chiefComplaint?: string | null;
    days?: number;
    profileAllergies?: string[];
    profileMedications?: string[];
    profileComorbidities?: string[];
    redFlags?: string[];
    sourceTranscriptRefs?: string[];
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

/** Fuse final ML1 patient-history blobs and ML2 extracted JSON into an ML3 payload. */
export function buildMl3Payload(input: Ml3PayloadInput): Ml3SynthesizePayload {
  const { ml1Histories, ml2Documents, meta = {} } = input;
  const allergies = new Set(meta.profileAllergies ?? []);
  const medications = new Set(meta.profileMedications ?? []);
  const comorbidities = new Set(meta.profileComorbidities ?? []);
  const redFlags = new Set(meta.redFlags ?? []);
  const transcriptRefs = [...(meta.sourceTranscriptRefs ?? [])];
  const complaints: string[] = [];
  let hpi: Record<string, unknown> | null = null;
  let reviewOfSystems: Record<string, unknown> | null = null;
  let ayush: Record<string, unknown> | null = null;

  for (const history of ml1Histories) {
    if (
      typeof history.chief_complaint === "string" &&
      history.chief_complaint.trim()
    ) {
      complaints.push(history.chief_complaint.trim());
    }
    for (const allergy of asStringArray(history.allergies))
      allergies.add(allergy);
    for (const medication of medicationsFromHistory(history))
      medications.add(medication);
    for (const condition of asStringArray(history.comorbidities))
      comorbidities.add(condition);
    for (const flag of asStringArray(history.red_flags)) redFlags.add(flag);
    transcriptRefs.push(...asStringArray(history.source_transcript_refs));

    if (history.hpi && typeof history.hpi === "object") {
      hpi = history.hpi as Record<string, unknown>;
    }
    if (
      history.review_of_systems &&
      typeof history.review_of_systems === "object"
    ) {
      reviewOfSystems = history.review_of_systems as Record<string, unknown>;
    }
    if (history.ayush && typeof history.ayush === "object") {
      ayush = history.ayush as Record<string, unknown>;
    }
  }

  for (const medication of medicationsFromOcr(ml2Documents))
    medications.add(medication);

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
    patient_id: meta.patientId,
    intake_session_id: meta.intakeSessionId,
    chief_complaint:
      meta.chiefComplaint ??
      (complaints.length > 0
        ? [...new Set(complaints)].join("; ")
        : meta.days
          ? `Clinical overview (past ${meta.days} days)`
          : null),
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
