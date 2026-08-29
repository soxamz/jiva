"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  MicIcon,
  SendIcon,
  ShieldAlertIcon,
  SquareIcon,
  ClipboardListIcon,
} from "lucide-react";
import { saveAiIntakeAction } from "@/lib/actions";
import {
  type ChatMessage,
  type FinalizeResponse,
  type TurnResponse,
  createIntakeSession,
  finalizeIntake,
  sendAudioTurn,
  sendTextTurn,
} from "@/lib/intake-api";
import { cn } from "@/lib/utils";
import { MobileHeader } from "./mobile-header";

interface MobileArohiProps {
  data: {
    intakeSessions: Array<{
      id: string;
      chiefComplaint: string;
      summary: string;
      createdAt: Date;
      redFlag: boolean;
      status: string;
    }>;
  };
}

function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={`${part}-${index}`} className="text-[#111827] font-bold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

function DraftSummary({ text }: { text: string }) {
  const blocks = text
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (
    <div className="space-y-2 text-xs leading-relaxed text-[#334155]">
      {blocks.map((block, index) => (
        <div key={`${index}-${block.slice(0, 20)}`} className="whitespace-pre-wrap">
          <BoldText text={block} />
        </div>
      ))}
    </div>
  );
}

export function MobileArohi({ data }: MobileArohiProps) {
  const router = useRouter();

  // State mapping
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [bypassQueue, setBypassQueue] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<FinalizeResponse | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [recording, setRecording] = useState(false);
  const [showProgressTab, setShowProgressTab] = useState(false);

  const [isPending, startTransition] = useTransition();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    transcript.scrollTo({ top: transcript.scrollHeight, behavior: "smooth" });
  }, [messages, finalResult, isPending]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    startTransition(async () => {
      try {
        const session = await createIntakeSession();
        setSessionId(session.session_id);
        setMessages([
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: session.assistant_message,
          },
        ]);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to start the symptom check.");
      }
    });
  }, []);

  function applyTurn(turn: TurnResponse, patientText: string) {
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "patient", content: patientText },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: turn.assistant_message,
      },
    ]);
    setProgress(turn.socrates_progress);
    setComplete(turn.complete);
    setBypassQueue(turn.bypass_queue || turn.red_flags.is_emergency);
  }

  async function persistFinalResult(result: FinalizeResponse) {
    setSaveState("saving");
    try {
      await saveAiIntakeAction({
        apiSessionId: result.session_id,
        patientHistory: result.patient_history,
        physicianSummary: result.physician_summary,
        bypassQueue: result.bypass_queue,
      });
      setSaveState("saved");
      router.refresh();
    } catch (cause) {
      setSaveState("failed");
      setError(cause instanceof Error ? cause.message : "Your symptom check could not be saved.");
    }
  }

  function handleSend() {
    if (!sessionId || !input.trim() || isPending || finalResult || bypassQueue) return;
    const patientText = input.trim();
    setInput("");
    startTransition(async () => {
      try {
        setError(null);
        applyTurn(await sendTextTurn(sessionId, patientText), patientText);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to send response.");
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
        const audio = new Blob(chunksRef.current, { type: "audio/webm" });
        if (!audio.size) return;
        startTransition(async () => {
          try {
            const turn = await sendAudioTurn(sessionId, audio, "intake.webm", "en");
            applyTurn(turn, turn.transcript_preview || "Voice report");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to process the recording.");
          }
        });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access is unavailable. Please type your response.");
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
        setError(cause instanceof Error ? cause.message : "Unable to finish symptom check.");
      }
    });
  }

  const inputDisabled = !sessionId || isPending || Boolean(finalResult) || bypassQueue;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#F8FAFC] pb-[calc(env(safe-area-inset-bottom,0px)+64px)] md:hidden">
      <MobileHeader
        title="Ask Arohi"
        rightElement={
          sessionId && Object.keys(progress).length > 0 ? (
            <button
              onClick={() => setShowProgressTab(!showProgressTab)}
              className={cn(
                "flex size-9 items-center justify-center rounded-full active:scale-95 transition-all shrink-0",
                showProgressTab ? "bg-[#0D5F5A] text-white" : "bg-[#E6F4F1] text-[#0D5F5A]"
              )}
              title="Progress items"
              aria-label="Progress items"
            >
              <ClipboardListIcon className="size-4.5" />
            </button>
          ) : undefined
        }
      />

      {/* Progress Checklist Overlay / Pane */}
      {showProgressTab && (
        <div className="bg-white border-b border-[#E2E8F0] p-4 transition-all">
          <h4 className="text-[10px] font-bold text-[#111827] uppercase tracking-wider mb-2">
            Intake checklist progress
          </h4>
          <ul className="grid grid-cols-2 gap-1.5 text-[11px]">
            {Object.entries(progress).map(([field, filled]) => (
              <li
                key={field}
                className="flex items-center justify-between p-1.5 rounded-lg bg-[#F8FAFC]"
              >
                <span className="text-[#64748B] capitalize truncate mr-2">
                  {field.replace(/^ayush_/, "").replaceAll("_", " ")}
                </span>
                {filled ? (
                  <CheckCircle2Icon className="size-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="text-[#E2E8F0] shrink-0">•</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings & Alerts */}
      <div className="px-4 pt-3 flex flex-col gap-2 shrink-0">
        {bypassQueue && (
          <div className="flex gap-2.5 items-start bg-red-50 border border-red-200 text-red-700 px-3.5 py-3 rounded-[12px] shadow-sm">
            <ShieldAlertIcon className="size-5 text-red-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h5 className="text-[12px] font-bold leading-none">Emergency Attention Needed</h5>
              <p className="text-[10px] text-red-600/90 mt-1 leading-relaxed">
                Please seek urgent medical help immediately. You can still finish to save this intake summary.
              </p>
            </div>
          </div>
        )}
        {error && (
          <div className="flex gap-2 items-center bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-[12px]">
            <AlertCircleIcon className="size-4 text-red-500 shrink-0" />
            <span className="text-[11px] font-semibold">{error}</span>
          </div>
        )}
      </div>

      {/* Chat Messages Log Area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0"
        ref={transcriptRef}
      >
        {messages.map((message) => {
          const isPatient = message.role === "patient";
          return (
            <div
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-[18px] px-4 py-2.5 text-xs leading-relaxed shadow-sm",
                isPatient
                  ? "bg-[#0D5F5A] text-white self-end rounded-br-[4px]"
                  : "bg-white text-[#111827] border border-[#E2E8F0] self-start rounded-bl-[4px]"
              )}
            >
              {message.content}
            </div>
          );
        })}

        {isPending && (
          <div className="flex items-center gap-1.5 text-xs text-[#0D5F5A] font-semibold">
            <LoaderCircleIcon className="size-3.5 animate-spin" />
            <span>Arohi is typing...</span>
          </div>
        )}

        {/* Doctor Summary Panel upon completion */}
        {finalResult && (
          <div className="bg-white border border-[#CBD5E1] rounded-[20px] p-4 shadow-sm mt-4">
            <div className="flex items-center gap-2 mb-2 border-b border-[#F1F5F9] pb-2">
              <div className="size-2 rounded-full bg-emerald-500" />
              <h4 className="text-[11px] font-extrabold text-[#111827] uppercase tracking-wider">
                Clinical Summary Draft
              </h4>
              <span className="ml-auto text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {saveState === "saved" ? "Saved" : "Saving"}
              </span>
            </div>
            <p className="text-[10px] text-[#64748B] mb-3 leading-relaxed italic">
              {finalResult.physician_summary.disclaimer}
            </p>
            <DraftSummary text={finalResult.physician_summary.en} />
            {saveState === "failed" && (
              <button
                onClick={() => void persistFinalResult(finalResult)}
                className="mt-3 bg-[#0D5F5A] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#0b504c]"
              >
                Retry saving report
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input Toolbar */}
      <div className="border-t border-[#E2E8F0] bg-white p-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Ask Arohi response"
            rows={1}
            value={input}
            disabled={inputDisabled}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              sessionId ? "Describe your symptoms..." : "Starting session..."
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] px-3.5 py-2.5 text-base text-[#111827] placeholder-[#64748B] focus:outline-none focus:border-[#0D5F5A] resize-none max-h-24 min-h-[40px] leading-tight"
          />

          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={inputDisabled}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full border active:scale-95 transition-all",
              recording
                ? "bg-red-50 border-red-200 text-red-600"
                : "bg-white border-[#E2E8F0] text-[#64748B]"
            )}
            title={recording ? "Stop recording" : "Record message"}
            aria-label={recording ? "Stop recording" : "Record message"}
          >
            {recording ? <SquareIcon className="size-4" /> : <MicIcon className="size-4" />}
          </button>

          <button
            onClick={handleSend}
            disabled={inputDisabled || !input.trim()}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full active:scale-95 transition-all text-white",
              input.trim() && !inputDisabled ? "bg-[#0D5F5A] hover:bg-[#0b504c]" : "bg-[#CBD5E1] text-[#94A3B8] cursor-not-allowed"
            )}
            title="Send message"
            aria-label="Send message"
          >
            <SendIcon className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <button
            type="button"
            onClick={handleFinalize}
            disabled={!sessionId || isPending || Boolean(finalResult)}
            className="bg-[#E6F4F1] text-[#0D5F5A] px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform disabled:opacity-50"
          >
            Finish & save
          </button>
          {recording && (
            <span className="text-[10px] text-red-500 font-bold animate-pulse">
              Recording audio...
            </span>
          )}
          {complete && !finalResult && (
            <span className="text-[10px] text-emerald-600 font-bold shrink-0">
              Check completed. Save when ready.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
