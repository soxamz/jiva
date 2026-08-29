"use client";

import { PrinterIcon } from "lucide-react";

export function PrintCardButton() {
  return (
    <button
      onClick={() => window.print()}
      className="w-full flex items-center justify-center gap-2 border border-slate-200 bg-white text-[#0D5F5A] hover:bg-slate-50 py-3 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
    >
      <PrinterIcon className="size-4" />
      <span>Print Emergency Card</span>
    </button>
  );
}
