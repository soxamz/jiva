const documentApiBase =
  process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:5328/api' : '/api';

function documentApiPath(path: string) {
  return `${documentApiBase}${path}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string') return data.detail;
    return JSON.stringify(data);
  } catch {
    return res.statusText || 'Document AI request failed';
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
  form.append('file', file, file.name);
  if (patientId) {
    form.append('patient_id', patientId);
  }

  const uploadRes = await fetch(documentApiPath('/documents/upload'), {
    method: 'POST',
    headers: {
      'x-consent-token': 'demo-consent',
    },
    body: form,
  });

  if (!uploadRes.ok) {
    throw new Error(await parseError(uploadRes));
  }

  const uploaded = (await uploadRes.json()) as { document_id: string; status: string };

  const processRes = await fetch(documentApiPath(`/documents/${uploaded.document_id}/process`), {
    method: 'POST',
    headers: {
      'x-consent-token': 'demo-consent',
    },
  });

  if (!processRes.ok) {
    throw new Error(await parseError(processRes));
  }

  return (await processRes.json()) as DocumentAiProcessResult;
}
