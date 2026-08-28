"use client";

import Link from "next/link";
import {
  Heart,
  QrCode,
  FileText,
  Pill,
  ChevronRight,
  Activity,
  Plus,
  ShieldCheck,
  Bell,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileDashboardProps {
  data: {
    user: {
      name: string;
    };
    activeConsents: Array<{
      consent: { id: string };
    }>;
    documents: Array<unknown>;
    profile: {
      currentMedications: string[];
    } | null;
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

export function MobileDashboard({ data }: MobileDashboardProps) {
  const activeConsentsCount = data.activeConsents?.length ?? 0;
  const docsCount = data.documents?.length ?? 0;
  const medications = data.profile?.currentMedications ?? [];
  const timelinePreview = data.timeline?.slice(0, 3) ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 md:hidden">
      {/* Top Brand Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-[12px] bg-[#E6F4F1] text-[#0D5F5A]">
            {/* Box icon with a plus */}
            <div className="size-6 bg-[#0D5F5A] rounded-[6px] flex items-center justify-center text-white">
              <Plus className="size-4 stroke-[3]" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-extrabold text-[#111827] leading-none font-sans">JivaHQ</h1>
            <span className="text-[#64748B] text-[11px] font-bold mt-0.5 block">Patient dashboard</span>
          </div>
        </div>
        <button className="flex size-10 items-center justify-center rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#111827] active:scale-95 transition-transform">
          <Bell className="size-4.5" />
        </button>
      </div>

      {/* Welcome Banner */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#F1F5F9] mb-4">
        <div>
          <p className="text-[#64748B] text-[13px] font-semibold">Welcome back,</p>
          <h2 className="text-[24px] font-extrabold text-[#111827] tracking-tight mt-0.5 leading-tight">
            {data.user.name}
          </h2>
          <p className="text-[#64748B] text-[13px] font-semibold mt-0.5">Here&apos;s your health summary.</p>
        </div>
        <div className="size-16 rounded-full overflow-hidden border border-[#E2E8F0] shrink-0">
          <img
            src="/avatar-placeholder.jpg"
            alt={data.user.name}
            className="size-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.name)}&background=0D5F5A&color=fff&bold=true`;
            }}
          />
        </div>
      </div>

      {/* Main Content Scrollable Container */}
      <div className="px-4 flex flex-col gap-4">
        
        {/* Ask Arohi Hero Card */}
        <Link href="/intake" className="block active:scale-[0.99] transition-transform">
          <div className="rounded-[24px] bg-[#0D5F5A] p-6 text-white shadow-md relative overflow-hidden">
            <div className="flex size-10 items-center justify-center rounded-[12px] bg-white/10 text-white mb-4">
              <Heart className="size-5 fill-white stroke-none" />
            </div>
            <h3 className="text-[20px] font-extrabold text-white leading-tight">
              Ask Arohi
            </h3>
            <p className="text-white/85 text-[13px] mt-1.5 max-w-[85%] leading-relaxed">
              Tell us what you are feeling before a doctor visit.
            </p>
            <div className="inline-flex items-center gap-1.5 bg-white text-[#0D5F5A] text-xs font-bold px-5 py-2.5 rounded-full mt-5">
              <span>Chat now</span>
              <ArrowRight className="size-3.5" />
            </div>
          </div>
        </Link>

        {/* Metrics Grid Layout */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Doctor Access Card */}
            <Link href="/share" className="block active:scale-[0.98] transition-transform">
              <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-4.5 shadow-sm flex flex-col items-start min-h-[142px]">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#E6F4F1] text-[#0D5F5A]">
                  <QrCode className="size-5" />
                </div>
                <span className="text-[#64748B] text-[11px] font-bold tracking-wider uppercase mt-4">
                  Doctor access
                </span>
                <span className="text-lg font-black text-[#111827] mt-1 leading-none">
                  {activeConsentsCount > 0 ? `${activeConsentsCount} active` : "No access"}
                </span>
                <div className="flex items-center gap-0.5 text-[11px] font-bold text-[#0D5F5A] mt-auto pt-3">
                  <span>Manage access</span>
                  <ArrowRight className="size-3" />
                </div>
              </div>
            </Link>

            {/* Medical Records Card */}
            <Link href="/documents" className="block active:scale-[0.98] transition-transform">
              <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-4.5 shadow-sm flex flex-col items-start min-h-[142px]">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#E6F4F1] text-[#0D5F5A]">
                  <FileText className="size-5" />
                </div>
                <span className="text-[#64748B] text-[11px] font-bold tracking-wider uppercase mt-4">
                  Medical records
                </span>
                <span className="text-[28px] font-black text-[#111827] mt-1 leading-none">
                  {docsCount}
                </span>
                <div className="flex items-center gap-0.5 text-[11px] font-bold text-[#0D5F5A] mt-auto pt-3">
                  <span>Add or view</span>
                  <ArrowRight className="size-3" />
                </div>
              </div>
            </Link>
          </div>

          {/* Medicines Card (Full Width) */}
          <Link href="/health-information" className="block active:scale-[0.99] transition-transform">
            <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-5 shadow-sm flex flex-col items-start w-full">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#E6F4F1] text-[#0D5F5A]">
                <Pill className="size-5" />
              </div>
              <span className="text-[#64748B] text-[11px] font-bold tracking-wider uppercase mt-4">
                Medicines
              </span>
              <div className="mt-2 flex flex-col gap-1.5 w-full">
                {medications.length > 0 ? (
                  medications.slice(0, 3).map((med, index) => (
                    <span key={index} className="text-sm font-extrabold text-[#111827] block truncate">
                      {med}
                    </span>
                  ))
                ) : (
                  <span className="text-sm font-bold text-[#64748B]">None listed</span>
                )}
              </div>
              <div className="flex items-center gap-0.5 text-[11px] font-bold text-[#0D5F5A] mt-4">
                <span>Edit health info</span>
                <ArrowRight className="size-3" />
              </div>
            </div>
          </Link>
        </div>

        {/* Your Health Timeline Section */}
        <div className="flex flex-col gap-3 mt-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-[#111827]">Your health timeline</h3>
              <p className="text-[#64748B] text-[11px]">Your latest records and symptom checks.</p>
            </div>
            <Link href="/timeline" className="text-[#0D5F5A] text-[11px] font-bold flex items-center gap-0.5">
              <span>See all</span>
              <ChevronRight className="size-3" />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {timelinePreview.length === 0 ? (
              <div className="text-center py-6 bg-white border border-[#E2E8F0] rounded-[20px] p-4 text-[#64748B] text-xs">
                No recent medical events
              </div>
            ) : (
              timelinePreview.map((item) => (
                <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-[20px] p-4 shadow-sm flex items-start gap-3.5">
                  <div className="size-9 rounded-[10px] bg-[#E6F4F1] text-[#0D5F5A] flex items-center justify-center shrink-0">
                    <Activity className="size-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-extrabold text-[#111827] truncate">
                        {item.title}
                      </h4>
                      {item.status && (
                        <span className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 tracking-wider",
                          item.status.toUpperCase() === "SUBMITTED"
                            ? "bg-[#E6F4F1] text-[#0D5F5A]"
                            : "bg-[#F1F5F9] text-[#64748B]"
                        )}>
                          {item.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[#64748B] text-[11px] mt-1 line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>
                    {item.dateLabel && (
                      <span className="text-[10px] font-bold text-[#64748B] block mt-2">
                        {item.dateLabel}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions List Layout */}
        <div className="flex flex-col gap-3 mt-1 mb-8">
          <div>
            <h3 className="text-sm font-extrabold text-[#111827]">Quick actions</h3>
            <p className="text-[#64748B] text-xs">Common tasks for your health record.</p>
          </div>
          
          <div className="flex flex-col gap-2.5">
            <Link href="/documents" className="flex items-center justify-between bg-white border border-[#E2E8F0] p-4 rounded-[20px] active:scale-[0.99] transition-transform shadow-sm">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="size-9 rounded-xl bg-[#E6F4F1] text-[#0D5F5A] flex items-center justify-center shrink-0">
                  <FileText className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-extrabold text-[#111827] leading-none mb-1">Add a medical record</h4>
                  <p className="text-[#64748B] text-[11px] font-medium leading-none">Add a report, prescription or scan.</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-[#64748B]/60" />
            </Link>

            <Link href="/share" className="flex items-center justify-between bg-white border border-[#E2E8F0] p-4 rounded-[20px] active:scale-[0.99] transition-transform shadow-sm">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="size-9 rounded-xl bg-[#E6F4F1] text-[#0D5F5A] flex items-center justify-center shrink-0">
                  <QrCode className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-extrabold text-[#111827] leading-none mb-1">Share records</h4>
                  <p className="text-[#64748B] text-[11px] font-medium leading-none">Give a doctor time-limited access.</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-[#64748B]/60" />
            </Link>

            <Link href="/clinical-overview" className="flex items-center justify-between bg-white border border-[#E2E8F0] p-4 rounded-[20px] active:scale-[0.99] transition-transform shadow-sm">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="size-9 rounded-xl bg-[#E6F4F1] text-[#0D5F5A] flex items-center justify-center shrink-0">
                  <Activity className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-extrabold text-[#111827] leading-none mb-1">Clinical overview</h4>
                  <p className="text-[#64748B] text-[11px] font-medium leading-none">AI summary of the past 7 days.</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-[#64748B]/60" />
            </Link>

            <Link href="/emergency-card" className="flex items-center justify-between bg-[#0D5F5A] border border-[#0D5F5A] p-4 rounded-[20px] active:scale-[0.99] transition-transform shadow-md text-white">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="size-9 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-extrabold leading-none mb-1">Emergency card</h4>
                  <p className="text-white/80 text-[11px] font-medium leading-none">Blood group, allergies & contacts at a glance.</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-white/60" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
