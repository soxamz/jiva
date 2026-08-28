"use client";

import Link from "next/link";
import { signOutAction } from "@/lib/actions";
import {
  HeartPulseIcon,
  SparklesIcon,
  ActivityIcon,
  QrCodeIcon,
  HistoryIcon,
  ShieldCheckIcon,
  ChevronRight,
  LogOutIcon,
  UserCheck,
} from "lucide-react";
import { MobileHeader } from "./mobile-header";

interface MobileProfileProps {
  user: {
    name: string;
    role: string;
    phoneMasked: string;
    doctorId: string | null;
  };
}

export function MobileProfile({ user }: MobileProfileProps) {
  const userInitials = user.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "HQ";

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 md:hidden">
      <MobileHeader title="Profile" />

      <div className="p-4 flex flex-col gap-4">
        {/* User Card */}
        <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm flex items-center gap-4">
          <div className="size-14 rounded-full bg-[#E6F4F1] border border-teal-200/50 flex items-center justify-center text-[#0D5F5A] font-bold text-lg">
            {userInitials}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-[#111827] truncate">
              {user.name}
            </h2>
            <p className="text-[#64748B] text-xs mt-0.5">
              {user.doctorId ?? user.phoneMasked}
            </p>
            <div className="inline-flex items-center gap-1 bg-[#E6F4F1] text-[#0D5F5A] text-[9px] font-extrabold px-2 py-0.5 rounded-full mt-2 uppercase tracking-wider">
              <UserCheck className="size-2.5" />
              <span>{user.role}</span>
            </div>
          </div>
        </div>

        {/* Navigation Groups */}
        <div className="flex flex-col gap-4">
          {/* Health Record Section */}
          <div className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden shadow-sm">
            <div className="bg-[#F8FAFC] px-4 py-2 border-b border-[#F1F5F9]">
              <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                Health Record
              </h3>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <Link href="/health-information" className="flex items-center justify-between p-4 active:bg-[#F8FAFC] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-[8px] bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <HeartPulseIcon className="size-4.5" />
                  </div>
                  <span className="text-xs font-bold text-[#111827]">Health information</span>
                </div>
                <ChevronRight className="size-4 text-[#94A3B8]" />
              </Link>

              <Link href="/clinical-overview" className="flex items-center justify-between p-4 active:bg-[#F8FAFC] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-[8px] bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                    <SparklesIcon className="size-4.5" />
                  </div>
                  <span className="text-xs font-bold text-[#111827]">Clinical overview</span>
                </div>
                <ChevronRight className="size-4 text-[#94A3B8]" />
              </Link>

              <Link href="/timeline" className="flex items-center justify-between p-4 active:bg-[#F8FAFC] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-[8px] bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    <ActivityIcon className="size-4.5" />
                  </div>
                  <span className="text-xs font-bold text-[#111827]">Health timeline</span>
                </div>
                <ChevronRight className="size-4 text-[#94A3B8]" />
              </Link>
            </div>
          </div>

          {/* Care & Safety Section */}
          <div className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden shadow-sm">
            <div className="bg-[#F8FAFC] px-4 py-2 border-b border-[#F1F5F9]">
              <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                Care & Safety
              </h3>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <Link href="/share" className="flex items-center justify-between p-4 active:bg-[#F8FAFC] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-[8px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <QrCodeIcon className="size-4.5" />
                  </div>
                  <span className="text-xs font-bold text-[#111827]">Share access</span>
                </div>
                <ChevronRight className="size-4 text-[#94A3B8]" />
              </Link>

              <Link href="/access-log" className="flex items-center justify-between p-4 active:bg-[#F8FAFC] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-[8px] bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
                    <HistoryIcon className="size-4.5" />
                  </div>
                  <span className="text-xs font-bold text-[#111827]">Access log</span>
                </div>
                <ChevronRight className="size-4 text-[#94A3B8]" />
              </Link>

              <Link href="/emergency-card" className="flex items-center justify-between p-4 active:bg-[#F8FAFC] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-[8px] bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <ShieldCheckIcon className="size-4.5" />
                  </div>
                  <span className="text-xs font-bold text-[#111827]">Emergency card</span>
                </div>
                <ChevronRight className="size-4 text-[#94A3B8]" />
              </Link>
            </div>
          </div>
        </div>

        {/* Sign Out Action Button */}
        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-200/50 text-red-600 py-3.5 rounded-[12px] text-xs font-bold active:scale-[0.99] transition-transform"
          >
            <LogOutIcon className="size-4" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </div>
  );
}
