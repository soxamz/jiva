export type RedFlagResult = {
  is_emergency: boolean;
  flags: string[];
  matched_rules: string[];
  triage_action: 'continue' | 'bypass_queue' | 'escalate';
  reason: string;
  source: 'rules' | 'llm' | 'merged';
};

export type TurnResponse = {
  session_id: string;
  assistant_message: string;
  red_flags: RedFlagResult;
  matched_rules: string[];
  socrates_progress: Record<string, boolean>;
  complete: boolean;
  severity: number | null;
  bypass_queue: boolean;
  turn_count: number;
  transcript_preview?: string | null;
};

export type AyushBlock = {
  prakriti?: string | null;
  vikriti?: string | null;
  sara?: string | null;
  samhanana?: string | null;
  pramana?: string | null;
  satmya?: string | null;
  sattva?: string | null;
  ahara_shakti?: string | null;
  vyayama_shakti?: string | null;
  vaya?: string | null;
  provisional_notes?: string | null;
  prakriti_notes?: string | null;
  agni_notes?: string | null;
  ahara_vihara?: string | null;
};

export type PatientHistory = {
  chief_complaint: string | null;
  hpi: Record<string, unknown>;
  allergies: string[];
  medications: string[];
  comorbidities: string[];
  review_of_systems: Record<string, string>;
  prior_medications?: string | null;
  prior_consult?: string | null;
  pain_now?: string | null;
  mechanism?: string | null;
  bleeding_now?: string | null;
  consciousness?: string | null;
  blood_thinners?: string | null;
  ayush?: AyushBlock | null;
  source_transcript_refs: string[];
  red_flags: string[];
};

export type PhysicianSummary = {
  en: string;
  hi: string;
  is_draft: boolean;
  disclaimer: string;
  highlights: string[];
  red_flags: string[];
};

export type FinalizeResponse = {
  session_id: string;
  patient_history: PatientHistory;
  physician_summary: PhysicianSummary;
  bypass_queue: boolean;
};

export type ChatMessage = {
  id: string;
  role: 'patient' | 'assistant' | 'system';
  content: string;
};

// Local Windows development can reserve the former proxy port. Production is
// always same-origin through Vercel's /api Python function.
const intakeApiBase = process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:5329/api' : '/api';

function intakeApiPath(path: string) {
  return `${intakeApiBase}${path}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string') return data.detail;
    return JSON.stringify(data);
  } catch {
    return res.statusText;
  }
}

export async function createIntakeSession(): Promise<{
  session_id: string;
  assistant_message: string;
}> {
  const res = await fetch(intakeApiPath('/intake/sessions'), { method: 'POST' });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function sendTextTurn(sessionId: string, text: string): Promise<TurnResponse> {
  const res = await fetch(intakeApiPath(`/intake/sessions/${sessionId}/turn`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function sendAudioTurn(
  sessionId: string,
  blob: Blob,
  filename = 'intake.webm'
): Promise<TurnResponse> {
  const form = new FormData();
  form.append('audio', blob, filename);
  const res = await fetch(intakeApiPath(`/intake/sessions/${sessionId}/turn`), {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function finalizeIntake(sessionId: string): Promise<FinalizeResponse> {
  const res = await fetch(intakeApiPath(`/intake/sessions/${sessionId}/finalize`), {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
