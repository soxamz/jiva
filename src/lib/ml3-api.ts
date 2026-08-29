import "server-only";

import { headers } from "next/headers";

import type { Ml3SynthesizePayload } from "@/lib/ml3-payload";

async function getMl3ApiBase() {
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:5328/api";
  }

  // Server-side fetch needs an absolute URL. Browsers accept "/api", but the
  // Vercel RSC and Server Action runtimes do not have a browser origin.
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  if (host) {
    return `${protocol}://${host}/api`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api`;
  }

  throw new Error("Unable to determine the ML3 API origin.");
}

async function ml3ApiPath(path: string) {
  return `${await getMl3ApiBase()}${path}`;
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
  const res = await fetch(await ml3ApiPath("/ml3/synthesize"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return (await res.json()) as ClinicalSummaryResult;
}
