"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SparklesIcon, PrinterIcon, AlertCircleIcon, ShieldAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileHeader } from "./mobile-header";

interface MobileClinicalOverviewProps {
  days: 7 | 30 | 90;
  recordCount: number;
  generatedAt: Date | null;
  clinical: {
    chief_complaint?: string;
    presentation_summary?: string;
    system_warnings_and_red_flags?: Array<{ title: string; detail: string; severity?: string }>;
    clinical_recommendations_and_actions?: string[];
  } | null;
  medications: Array<{
    name: string;
    status: string;
    compliance?: string;
  }>;
  stats: {
    symptomChecks: number;
    documents: number;
    urgentChecks: number;
    flaggedLabs: number;
  };
  showEmpty: boolean;
}

export function MobileClinicalOverview({
  days,
  recordCount,
  generatedAt,
  clinical,
  medications,
  stats,
  showEmpty,
}: MobileClinicalOverviewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleRangeChange = (r: 7 | 30 | 90) => {
    router.push(`/clinical-overview?range=${r}`);
  };

  const getDayChipActive = (r: number) => {
    return days === r;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 md:hidden">
      <MobileHeader
        title="Clinical Overview"
        showBack
        backHref="/profile"
        rightElement={
          <button
            onClick={() => window.print()}
            className="flex size-9 items-center justify-center rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#111827] active:scale-95 transition-transform"
            aria-label="Print clinical overview"
          >
            <PrinterIcon className="size-4" />
          </button>
        }
      />

      <div className="p-4 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#111827]">
            Clinical Overview
          </h2>
          <p className="text-[#64748B] text-[11px] mt-1 leading-relaxed">
            Overall summary generated from intake sessions and AI OCR data.
          </p>
        </div>

        {/* Days chip selector row */}
        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map((r) => {
            const active = getDayChipActive(r);
            return (
              <button
                key={r}
                onClick={() => handleRangeChange(r)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors shrink-0",
                  active
                    ? "bg-[#0D5F5A] border-[#0D5F5A] text-white"
                    : "bg-white border-[#E2E8F0] text-[#64748B]"
                )}
              >
                Past {r} days
              </button>
            );
          })}
        </div>

        {showEmpty ? (
          <div className="bg-white rounded-[20px] p-6 border border-[#E2E8F0] text-center text-xs text-[#64748B] shadow-sm">
            No health records matching the selected duration. Start symptom inputs or upload lab results.
          </div>
        ) : (
          <>
            {/* Physician Summary Engine Card */}
            {clinical && (
              <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-4.5 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-[#E6F4F1] text-[#0D5F5A]">
                    <SparklesIcon className="size-4" />
                  </div>
                  <span className="text-[11px] font-extrabold text-[#111827] uppercase tracking-wider">
                    Physician Summary Engine
                  </span>
                  <span className="ml-auto text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-200/50">
                    Needs review
                  </span>
                </div>

                <div className="text-[10px] text-[#64748B] tracking-wide font-medium">
                  Generated{" "}
                  {generatedAt
                    ? new Date(generatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "n/a"}{" "}
                  · based on {recordCount} records
                </div>

                {clinical.chief_complaint && (
                  <div>
                    <h4 className="text-[11px] font-extrabold text-[#111827] uppercase tracking-wider">
                      Chief Complaint
                    </h4>
                    <p className="text-xs text-[#334155] leading-relaxed mt-1">
                      {clinical.chief_complaint}
                    </p>
                  </div>
                )}

                {clinical.presentation_summary && (
                  <div>
                    <h4 className="text-[11px] font-extrabold text-[#111827] uppercase tracking-wider">
                      Presentation Summary
                    </h4>
                    <p className="text-xs text-[#334155] leading-relaxed mt-1">
                      {clinical.presentation_summary}
                    </p>
                  </div>
                )}

                {/* System Warnings */}
                {clinical.system_warnings_and_red_flags &&
                  clinical.system_warnings_and_red_flags.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-extrabold text-[#111827] uppercase tracking-wider">
                        System Warnings
                      </h4>
                      <div className="flex flex-col gap-2 mt-2">
                        {clinical.system_warnings_and_red_flags.map((w, index) => (
                          <div key={index} className="flex gap-2 items-start text-xs text-[#334155]">
                            <div className="size-1.5 rounded-full bg-red-500 mt-2 shrink-0 animate-pulse" />
                            <p className="leading-relaxed">
                              <span className="font-bold text-[#111827]">{w.title}: </span>
                              {w.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Action Required */}
                {clinical.clinical_recommendations_and_actions &&
                  clinical.clinical_recommendations_and_actions.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-extrabold text-[#111827] uppercase tracking-wider">
                        Action Required
                      </h4>
                      <div className="flex flex-col gap-2 mt-2">
                        {clinical.clinical_recommendations_and_actions.map((a, index) => (
                          <div key={index} className="flex gap-2 items-start text-xs text-[#334155]">
                            <div className="size-1.5 rounded-full bg-[#0D5F5A] mt-2 shrink-0" />
                            <p className="leading-relaxed">{a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Active Medications List Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-4.5 shadow-sm">
              <h3 className="text-[11px] font-extrabold text-[#111827] uppercase tracking-wider mr-2">
                Active medications
              </h3>
              <span className="text-[10px] text-[#64748B] font-semibold mt-1 block">
                {medications.length} items
              </span>

              <div className="flex flex-col gap-2.5 mt-4">
                {medications.length === 0 ? (
                  <p className="text-xs text-[#64748B] italic">No active medications logged.</p>
                ) : (
                  medications.map((m, index) => {
                    const needsReview = m.status === "review" || m.status === "Review recommended" || m.status?.toLowerCase().includes("review");
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0]/65 p-3 rounded-[12px]"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-[#111827] truncate">
                            {m.name}
                          </h4>
                          <span className="text-[10px] text-[#64748B] block mt-0.5">
                            {m.compliance ?? "Compliant"}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 border",
                            needsReview
                              ? "bg-amber-50 text-amber-700 border-amber-200/50"
                              : "bg-teal-50 text-teal-700 border-teal-200/50"
                          )}
                        >
                          {needsReview ? "Review Recommended" : "Compliant"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Care Record Summary Grid */}
            <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-4.5 shadow-sm">
              <h3 className="text-[11px] font-extrabold text-[#111827] uppercase tracking-wider mb-4">
                Care record summary
              </h3>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-[12px]">
                  <div className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">
                    Symptom checks
                  </div>
                  <div className="text-lg font-extrabold text-[#111827] mt-1.5 leading-none">
                    {stats.symptomChecks}
                  </div>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-[12px]">
                  <div className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">
                    Documents
                  </div>
                  <div className="text-lg font-extrabold text-[#111827] mt-1.5 leading-none">
                    {stats.documents}
                  </div>
                </div>

                <div className="bg-[#F8FAFC] border border-amber-200/60 p-3 rounded-[12px]">
                  <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                    Urgent checks
                  </div>
                  <div className="text-lg font-extrabold text-amber-750 mt-1.5 leading-none">
                    {stats.urgentChecks}
                  </div>
                </div>

                <div className="bg-[#F8FAFC] border border-red-200/60 p-3 rounded-[12px]">
                  <div className="text-[10px] text-red-700 font-bold uppercase tracking-wider">
                    Flagged labs
                  </div>
                  <div className="text-lg font-extrabold text-red-750 mt-1.5 leading-none">
                    {stats.flaggedLabs}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
