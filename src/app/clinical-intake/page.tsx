'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Mic, MicOff, Send, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  type ChatMessage,
  type FinalizeResponse,
  type TurnResponse,
  createIntakeSession,
  finalizeIntake,
  sendAudioTurn,
  sendTextTurn,
} from '@/lib/intake-api';
import { cn } from '@/lib/utils';

export default function IntakePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [bypassQueue, setBypassQueue] = useState(false);
  const [complete, setComplete] = useState(false);
  const [redFlagReason, setRedFlagReason] = useState<string | null>(null);
  const [matchedRules, setMatchedRules] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<FinalizeResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sessionBootstrapped = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, finalResult]);

  useEffect(() => {
    // React Strict Mode mounts twice in dev; create only one session.
    if (sessionBootstrapped.current) return;
    sessionBootstrapped.current = true;
    startTransition(async () => {
      try {
        setError(null);
        const session = await createIntakeSession();
        setSessionId(session.session_id);
        setMessages([
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: session.assistant_message,
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start session');
      }
    });
  }, []);

  function applyTurn(turn: TurnResponse, patientText?: string) {
    setMessages((prev) => {
      const next = [...prev];
      if (patientText) {
        next.push({
          id: crypto.randomUUID(),
          role: 'patient',
          content: patientText,
        });
      }
      next.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: turn.assistant_message,
      });
      return next;
    });
    setProgress(turn.socrates_progress);
    setComplete(turn.complete);
    setBypassQueue(turn.bypass_queue);
    setMatchedRules(turn.matched_rules);
    if (turn.bypass_queue || turn.red_flags.is_emergency) {
      setRedFlagReason(turn.red_flags.reason || 'Emergency triage triggered');
    }
  }

  function handleSend() {
    if (!sessionId || !input.trim() || isPending || !!finalResult) return;
    const text = input.trim();
    setInput('');
    startTransition(async () => {
      try {
        setError(null);
        const turn = await sendTextTurn(sessionId, text);
        applyTurn(turn, text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Turn failed');
      }
    });
  }

  async function startRecording() {
    if (!!finalResult) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (!sessionId || blob.size === 0) return;
        startTransition(async () => {
          try {
            const turn = await sendAudioTurn(sessionId, blob);
            const preview = turn.transcript_preview || '[voice message]';
            applyTurn(turn, preview);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Audio turn failed');
          }
        });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError('Microphone access denied or unavailable');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function handleFinalize() {
    if (!sessionId || isPending) return;
    startTransition(async () => {
      try {
        setError(null);
        const result = await finalizeIntake(sessionId);
        setFinalResult(result);
        setComplete(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Finalize failed');
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-sm text-muted-foreground">JivaHQ Clinical Intake</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Conversational History
          </h1>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {sessionId ? `session ${sessionId.slice(0, 8)}…` : 'starting…'}
        </p>
      </header>

      {bypassQueue && (
        <div
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900"
          role="alert"
        >
          <p className="font-semibold">Triage bypass — urgent attention needed</p>
          <p className="mt-1 text-sm">{redFlagReason}</p>
          {matchedRules.length > 0 && (
            <p className="mt-2 text-xs">
              Matched rules: {matchedRules.join(', ')}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
        </div>
      )}

      <section className="grid flex-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex min-h-[420px] flex-col rounded-xl border border-border bg-card">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  message.role === 'patient'
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                )}
              >
                {message.content}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Describe your symptoms…"
                value={input}
                disabled={!sessionId || isPending || bypassQueue || !!finalResult}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                disabled={!sessionId || isPending || !input.trim() || bypassQueue || !!finalResult}
                onClick={handleSend}
                aria-label="Send message"
              >
                <Send className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={recording ? 'destructive' : 'outline'}
                disabled={!sessionId || isPending || bypassQueue || !!finalResult}
                onClick={recording ? stopRecording : startRecording}
                aria-label={recording ? 'Stop recording' : 'Start recording'}
              >
                {recording ? (
                  <Square className="size-4" />
                ) : (
                  <Mic className="size-4" />
                )}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!sessionId || isPending || !!finalResult}
                onClick={handleFinalize}
              >
                Finish intake
              </Button>
              {recording && (
                <span className="inline-flex items-center gap-1 text-xs text-red-600">
                  <MicOff className="size-3" /> Recording…
                </span>
              )}
              {isPending && (
                <span className="text-xs text-muted-foreground">Working…</span>
              )}
              {complete && !bypassQueue && (
                <span className="text-xs text-muted-foreground">
                  Intake marked complete
                </span>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border p-4">
            <h2 className="text-sm font-semibold">Intake progress</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {Object.entries(progress).length === 0 && (
                <li className="text-muted-foreground">No slots filled yet</li>
              )}
              {Object.entries(progress).map(([key, filled]) => (
                <li key={key} className="flex items-center justify-between gap-2">
                  <span className="capitalize text-muted-foreground">
                    {key
                      .replace(/^ayush_/, 'AYUSH ')
                      .replaceAll('_', ' ')}
                  </span>
                  <span className={filled ? 'text-emerald-700' : 'text-foreground/40'}>
                    {filled ? 'done' : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {finalResult && (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <h2 className="text-sm font-semibold">Physician draft summary</h2>
              <p className="text-xs text-amber-800">
                {finalResult.physician_summary.disclaimer}
              </p>
              <div>
                <p className="text-xs font-medium text-muted-foreground">English</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">
                  {finalResult.physician_summary.en}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Hindi</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">
                  {finalResult.physician_summary.hi}
                </p>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">
                  Structured history JSON
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2">
                  {JSON.stringify(finalResult.patient_history, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
