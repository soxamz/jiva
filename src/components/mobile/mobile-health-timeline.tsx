"use client";

import { CalendarIcon, FileHeartIcon, HeartPulseIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileHeader } from "./mobile-header";

interface MobileHealthTimelineProps {
  data: {
    timeline: Array<{
      id: string;
      title: string;
      body: string;
      dateLabel?: string;
      status?: string;
      redFlag?: boolean;
      type?: string;
    }>;
  };
}

export function MobileHealthTimeline({ data }: MobileHealthTimelineProps) {
  const listItems = data.timeline ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 md:hidden">
      <MobileHeader title="Health timeline" showBack backHref="/profile" />

      <div className="p-4 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#111827]">
            Your health timeline
          </h2>
          <p className="text-[#64748B] text-[11px] mt-1 leading-relaxed">
            Every symptom check and recorded document in chronological order.
          </p>
        </div>

        {listItems.length === 0 ? (
          <div className="bg-white rounded-[20px] p-6 border border-[#E2E8F0] text-center text-xs text-[#64748B] shadow-sm">
            No events logged in your health timeline yet.
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-2">
            {listItems.map((item, index) => {
              const isUrgent = item.redFlag || item.status === "urgent" || item.status === "needs_attention" || item.status === "needs review";
              const isIntake = item.type === "intake";

              return (
                <div key={item.id} className="flex gap-4">
                  {/* Timeline branch rail */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={cn(
                        "size-4 rounded-full border-4 flex items-center justify-center mt-1.5 shrink-0",
                        isUrgent
                          ? "bg-rose-500 border-rose-100"
                          : isIntake
                          ? "bg-[#0D5F5A] border-teal-100"
                          : "bg-sky-500 border-sky-100"
                      )}
                    />
                    {index < listItems.length - 1 && (
                      <div className="w-[2px] flex-grow bg-[#E2E8F0] min-h-[50px] mt-2" />
                    )}
                  </div>

                  {/* Card item info */}
                  <div className="flex-1 bg-white border border-[#E2E8F0] rounded-[16px] p-4 shadow-sm">
                    <div className="flex items-start gap-2 justify-between">
                      <h3 className="text-xs font-bold text-[#111827] leading-snug">
                        {item.title}
                      </h3>
                      {item.status && (
                        <div
                          className={cn(
                            "text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 border",
                            isUrgent
                              ? "bg-rose-50 text-rose-700 border-rose-100"
                              : "bg-teal-50 text-teal-850 border-teal-100"
                          )}
                        >
                          {item.status}
                        </div>
                      )}
                    </div>

                    <p className="text-[#334155] text-xs mt-2 leading-relaxed">
                      {item.body}
                    </p>

                    <div className="flex items-center gap-1 text-[#64748B] text-[10px] mt-3 font-semibold uppercase tracking-wider">
                      <span className="text-[#0D5F5A] font-bold">
                        {item.dateLabel}
                      </span>
                      {item.type && (
                        <>
                          <div className="size-1 rounded-full bg-[#CBD5E1]" />
                          <span>{item.type === "rx" ? "Prescription" : item.type}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
