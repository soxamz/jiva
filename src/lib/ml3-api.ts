import type { Ml3SynthesizePayload } from "@/lib/ml3-payload";

const ml3ApiBase =
  process.env.NODE_ENV === "development" ? "http://127.0.0.1:5328/api" : "/api";

function ml3ApiPath(path: string) {
  return `${ml3ApiBase}${path}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    return JSON.stringify(data);
  } catch {
    return res.statusText || "ML3 request failed";
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

export { buildMl3Payload, labReportsFromExtractions } from "@/lib/ml3-payload";
export type { Ml3PayloadInput, Ml3SynthesizePayload } from "@/lib/ml3-payload";

export async function synthesizeClinicalSummary(payload: Ml3SynthesizePayload) {
  const res = await fetch(ml3ApiPath("/ml3/synthesize"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as ClinicalSummaryResult;
}
