'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  MicIcon,
  SendIcon,
  ShieldAlertIcon,
  SquareIcon,
} from 'lucide-react';

import { saveAiIntakeAction } from '@/lib/actions';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export function AiIntakeChat() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [bypassQueue, setBypassQueue] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<FinalizeResponse | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [recording, setRecording] = useState(false);
  const [isPending, startTransition] = useTransition();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;

    transcript.scrollTo({ top: transcript.scrollHeight, behavior: 'smooth' });
  }, [messages, finalResult]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    startTransition(async () => {
      try {
        const session = await createIntakeSession();
        setSessionId(session.session_id);
        setMessages([
          { id: crypto.randomUUID(), role: 'assistant', content: session.assistant_message },
        ]);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to start the symptom check.');
      }
    });
  }, []);

  function applyTurn(turn: TurnResponse, patientText: string) {
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'patient', content: patientText },
      { id: crypto.randomUUID(), role: 'assistant', content: turn.assistant_message },
    ]);
    setProgress(turn.socrates_progress);
    setComplete(turn.complete);
    setBypassQueue(turn.bypass_queue || turn.red_flags.is_emergency);
  }

  async function persistFinalResult(result: FinalizeResponse) {
    setSaveState('saving');
    try {
      await saveAiIntakeAction({
        apiSessionId: result.session_id,
        patientHistory: result.patient_history,
        physicianSummary: result.physician_summary,
        bypassQueue: result.bypass_queue,
      });
      setSaveState('saved');
      router.refresh();
    } catch (cause) {
      setSaveState('failed');
      setError(cause instanceof Error ? cause.message : 'Your symptom check could not be saved.');
    }
  }

  function handleSend() {
    if (!sessionId || !input.trim() || isPending || finalResult || bypassQueue) return;
    const patientText = input.trim();
    setInput('');
    startTransition(async () => {
      try {
        setError(null);
        applyTurn(await sendTextTurn(sessionId, patientText), patientText);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to send your response.');
      }
    });
  }

  async function startRecording() {
    if (!sessionId || finalResult || bypassQueue) return;
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audio = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (!audio.size) return;
        startTransition(async () => {
          try {
            const turn = await sendAudioTurn(sessionId, audio);
            applyTurn(turn, turn.transcript_preview || 'Voice message');
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to process the recording.');
          }
        });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError('Microphone access is unavailable. You can type your response instead.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function handleFinalize() {
    if (!sessionId || isPending || finalResult) return;
    startTransition(async () => {
      try {
        setError(null);
        const result = await finalizeIntake(sessionId);
        setFinalResult(result);
        setComplete(true);
        await persistFinalResult(result);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to finish the symptom check.');
      }
    });
  }

  const inputDisabled = !sessionId || isPending || Boolean(finalResult) || bypassQueue;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="min-h-[560px] gap-0 overflow-hidden rounded-2xl">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Chat with Jiva</CardTitle>
          <CardDescription>
            Answer in your own words. Your completed check is saved to your health record.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {bypassQueue && (
            <div
              className="m-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"
              role="alert"
            >
              <ShieldAlertIcon className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-medium">Urgent symptoms need attention</p>
                <p className="mt-1 text-sm">
                  Please seek urgent medical help. You can still finish to save this symptom check.
                </p>
              </div>
            </div>
          )}
          {error && (
            <div
              className="mx-4 mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="alert"
            >
              <AlertCircleIcon className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div
            aria-live="polite"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
            ref={transcriptRef}
          >
            {messages.map((message) => (
              <div
                className={cn(
                  'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6',
                  message.role === 'patient'
                    ? 'ml-auto bg-sky-600 text-white'
                    : 'bg-muted text-foreground'
                )}
                key={message.id}
              >
                {message.content}
              </div>
            ))}
            {isPending && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <LoaderCircleIcon className="size-3 animate-spin" /> Thinking...
              </div>
            )}
          </div>
          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                aria-label="Your response"
                className="max-h-28 min-h-11 rounded-xl"
                disabled={inputDisabled}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={sessionId ? 'Type your response...' : 'Starting your symptom check...'}
                value={input}
              />
              <Button
                aria-label="Send response"
                disabled={inputDisabled || !input.trim()}
                onClick={handleSend}
                size="icon"
                type="button"
              >
                <SendIcon className="size-4" />
              </Button>
              <Button
                aria-label={recording ? 'Stop recording' : 'Record response'}
                disabled={inputDisabled}
                onClick={recording ? stopRecording : startRecording}
                size="icon"
                type="button"
                variant={recording ? 'secondary' : 'outline'}
              >
                {recording ? <SquareIcon className="size-4" /> : <MicIcon className="size-4" />}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                disabled={!sessionId || isPending || Boolean(finalResult)}
                onClick={handleFinalize}
                type="button"
                variant="secondary"
              >
                Finish and save
              </Button>
              {recording && (
                <span className="text-muted-foreground text-xs">Recording response...</span>
              )}
              {complete && !finalResult && (
                <span className="text-muted-foreground text-xs">
                  You can finish when you are ready.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Check progress</CardTitle>
            <CardDescription>Jiva asks only what is useful for a doctor visit.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {Object.entries(progress).length === 0 ? (
                <li className="text-muted-foreground">
                  Your answers will appear here as they are recorded.
                </li>
              ) : (
                Object.entries(progress).map(([field, filled]) => (
                  <li className="flex items-center justify-between gap-3" key={field}>
                    <span className="text-muted-foreground capitalize">
                      {field.replace(/^ayush_/, '').replaceAll('_', ' ')}
                    </span>
                    {filled ? (
                      <CheckCircle2Icon className="size-4 text-emerald-600" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        {finalResult && (
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Doctor review draft</CardTitle>
              <CardDescription>
                {saveState === 'saved'
                  ? 'Saved to your health record.'
                  : 'Preparing your health record.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-xs">
                {finalResult.physician_summary.disclaimer}
              </p>
              <p className="text-sm leading-6">{finalResult.physician_summary.en}</p>
              {saveState === 'failed' && (
                <Button
                  onClick={() => void persistFinalResult(finalResult)}
                  size="sm"
                  type="button"
                >
                  Save again
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
