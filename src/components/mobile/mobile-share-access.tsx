"use client";

import { useState } from "react";
import { QrCodeIcon, LinkIcon, XCircle, Share2, ClipboardIcon, CheckIcon } from "lucide-react";
import { revokeConsentAction } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { MobileHeader } from "./mobile-header";

interface MobileShareAccessProps {
  shareUrl: string | null;
  activeConsents: Array<{
    consent: {
      id: string;
      grantedAt: Date;
      lastAuthenticatedAt: Date | null;
    };
    doctor: {
      id: string;
      name: string;
      doctorId: string | null;
    };
  }>;
}

const DURATIONS = ["15 min", "1 hour", "24 hours", "7 days"];

export function MobileShareAccess({ shareUrl, activeConsents }: MobileShareAccessProps) {
  const [selectedDuration, setSelectedDuration] = useState("1 hour");
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Simple deterministic pattern generator matching QR code placeholder
  const renderQRPattern = () => {
    const rows = 21;
    const cells: boolean[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < rows; c++) {
        const isCorner = (r < 7 && c < 7) || (r < 7 && c > rows - 8) || (r > rows - 8 && c < 7);
        const cornerFrame =
          isCorner &&
          (r === 0 || c === 0 || r === 6 || c === 6 ||
            r === rows - 1 || c === rows - 1 || r === rows - 7 || c === rows - 7);
        const cornerInner = isCorner && r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const cornerInnerTR = isCorner && r >= 2 && r <= 4 && c >= rows - 5 && c <= rows - 3;
        const cornerInnerBL = isCorner && r >= rows - 5 && r <= rows - 3 && c >= 2 && c <= 4;
        const noise = (r * 7 + c * 13) % 5 === 0 || (r * 3 + c * 5) % 7 === 0;
        row.push(!!(cornerFrame || cornerInner || cornerInnerTR || cornerInnerBL || (!isCorner && noise)));
      }
      cells.push(row);
    }

    return (
      <div className="size-[200px] bg-white p-2 border border-[#E2E8F0] rounded-xl flex flex-col gap-0 select-none">
        {cells.map((rowArr, rowIndex) => (
          <div key={rowIndex} className="flex flex-1 gap-0">
            {rowArr.map((on, colIndex) => (
              <div
                key={colIndex}
                className={cn("flex-1", on ? "bg-[#111827]" : "bg-white")}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 md:hidden">
      <MobileHeader title="Share access" showBack backHref="/profile" />

      <div className="p-4 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#111827]">
            Share your records
          </h2>
          <p className="text-[#64748B] text-[11px] mt-1 leading-relaxed">
            Give a doctor time-limited access to view your medical vault.
          </p>
        </div>

        {/* QR Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-6 shadow-sm flex flex-col items-center gap-4 text-center">
          <div className="p-3 border-2 border-teal-100 rounded-2xl bg-white shadow-inner">
            {renderQRPattern()}
          </div>
          <div>
            <p className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">
              Scan with doctor&apos;s JivaHQ app
            </p>
            <p className="text-sm font-extrabold text-[#0D5F5A] tracking-[0.2em] uppercase mt-2">
              JVQ-2M8K-4XPQ
            </p>
          </div>
        </div>

        {/* Duration picker */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold text-[#111827] uppercase tracking-wider">
            Access Duration
          </span>
          <div className="flex gap-2 pb-1 overflow-x-auto scrollbar-none">
            {DURATIONS.map((d) => {
              const active = selectedDuration === d;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDuration(d)}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold border transition-colors shrink-0",
                    active
                      ? "bg-[#0D5F5A] border-[#0D5F5A] text-white"
                      : "bg-white border-[#E2E8F0] text-[#64748B]"
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Share buttons */}
        <div className="flex flex-col gap-2 mt-2">
          <button
            onClick={handleCopyLink}
            disabled={!shareUrl}
            className="w-full flex items-center justify-center gap-2 bg-[#0D5F5A] text-white py-3.5 rounded-[12px] text-xs font-bold active:scale-[0.99] transition-transform disabled:opacity-50"
          >
            {copied ? (
              <>
                <CheckIcon className="size-4" />
                <span>Copied share link!</span>
              </>
            ) : (
              <>
                <LinkIcon className="size-4" />
                <span>Share via link</span>
              </>
            )}
          </button>
        </div>

        {/* Active clinicians list with revoke options */}
        <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-4.5 shadow-sm mt-2">
          <h3 className="text-[11px] font-extrabold text-[#111827] uppercase tracking-wider border-b border-[#F1F5F9] pb-3 mb-3">
            Active physician access ({activeConsents.length})
          </h3>

          {activeConsents.length === 0 ? (
            <p className="text-xs text-[#64748B] text-center py-4">No active doctor access sessions</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activeConsents.map(({ consent, doctor }) => (
                <div key={consent.id} className="flex gap-3 items-center justify-between p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px]">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#111827] truncate">{doctor.name}</p>
                    <p className="text-[10px] text-[#64748B] mt-0.5 font-medium">HPR ID: {doctor.doctorId ?? "-"}</p>
                  </div>
                  <form action={revokeConsentAction}>
                    <input type="hidden" name="consentId" value={consent.id} />
                    <button
                      type="submit"
                      className="px-3 py-1.5 border border-[#E2E8F0] bg-white text-xs font-bold rounded-lg text-[#64748B] active:bg-[#F8FAFC]"
                    >
                      Revoke
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
