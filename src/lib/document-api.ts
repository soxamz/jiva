import "server-only";

import { headers } from "next/headers";

async function documentApiPath(path: string) {
  const configuredBase = process.env.DOCUMENT_AI_API_BASE_URL?.trim().replace(
    /\/$/,
    "",
  );

  if (configuredBase) {
    return `${configuredBase}${path}`;
  }

  if (process.env.NODE_ENV === "development") {
    return `http://127.0.0.1:5328/api${path}`;
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    throw new Error(
      "Document AI request origin is unavailable. Set DOCUMENT_AI_API_BASE_URL.",
    );
  }

  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}/api${path}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    return JSON.stringify(data);
  } catch {
    return res.statusText || "Document AI request failed";
  }
}

export type DocumentAiProcessResult = {
  document_id: string;
  status: string;
  document_type?: string | null;
  confidence?: {
    ocr?: number | null;
    extraction?: number | null;
    final?: number | null;
    manual_review_required?: boolean;
  };
  [key: string]: unknown;
};

export async function uploadAndProcessDocument(file: File, patientId?: string) {
  const form = new FormData();
  form.append("file", file, file.name);
  if (patientId) {
    form.append("patient_id", patientId);
  }

  const uploadRes = await fetch(await documentApiPath("/documents/upload"), {
    method: "POST",
    headers: {
      "x-consent-token": "demo-consent",
    },
    body: form,
  });

  if (!uploadRes.ok) {
    throw new Error(await parseError(uploadRes));
  }

  const uploaded = (await uploadRes.json()) as {
    document_id: string;
    status: string;
  };

  const processRes = await fetch(
    await documentApiPath(`/documents/${uploaded.document_id}/process`),
    {
      method: "POST",
      headers: {
        "x-consent-token": "demo-consent",
      },
    },
  );

  if (!processRes.ok) {
    throw new Error(await parseError(processRes));
  }

  return (await processRes.json()) as DocumentAiProcessResult;
}

export function extractAbnormalValuesFromOcr(result: DocumentAiProcessResult) {
  const clinicalData =
    result.clinical_data && typeof result.clinical_data === "object"
      ? (result.clinical_data as Record<string, unknown>)
      : null;
  const rows = Array.isArray(clinicalData?.clinical_results)
    ? clinicalData.clinical_results
    : Array.isArray(result.clinical_results)
      ? result.clinical_results
      : [];

  const abnormal: Array<{
    label: string;
    value: string;
    severity: "low" | "medium" | "high";
  }> = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const flag =
      typeof item.flag === "string"
        ? item.flag
        : typeof item.abnormal_flag === "string"
          ? item.abnormal_flag
          : null;
    if (!flag || /normal|n\/a|none/i.test(flag)) continue;

    const label =
      (typeof item.test_name === "string" && item.test_name) ||
      (typeof item.name === "string" && item.name) ||
      (typeof item.test === "string" && item.test) ||
      "Lab value";
    const value =
      [item.value, item.unit].filter(Boolean).join(" ").trim() || flag;
    const severity = /h|high|critical/i.test(flag)
      ? "high"
      : /l|low/i.test(flag)
        ? "medium"
        : "low";

    abnormal.push({ label, value, severity });
  }

  return abnormal.slice(0, 12);
}
