"use client";

import { PrinterIcon, PhoneCallIcon, ShieldAlertIcon, ShieldCheck } from "lucide-react";
import { MobileHeader } from "./mobile-header";
import { cn } from "@/lib/utils";

interface MobileEmergencyCardProps {
  data: {
    user: {
      name: string;
    };
    profile: {
      bloodType: string;
      allergies: string[];
      criticalConditions: string[];
      currentMedications: string[];
      emergencyContacts: Array<{
        name: string;
        relation: string;
        phone: string;
      }>;
    } | null;
  };
}

export function MobileEmergencyCard({ data }: MobileEmergencyCardProps) {
  const profile = data.profile;
  const userInitials = data.user.name
    ? data.user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "HQ";

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 md:hidden">
      <MobileHeader title="Emergency card" showBack backHref="/profile" />

      <div className="p-4 flex flex-col gap-4">
        {/* Verification Status Warning Card */}
        <div className="flex items-center justify-between border border-teal-150 bg-teal-50 px-4 py-3 rounded-2xl shadow-sm text-teal-850">
          <div className="min-w-0">
            <h3 className="text-xs font-bold leading-none">Emergency medical card</h3>
            <p className="text-[10px] text-teal-700 mt-1 leading-normal">
              Always kept up-to-date and instantly printable.
            </p>
          </div>
          <div className="bg-[#E6F4F1] text-[#0D5F5A] text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-0.5 border border-teal-200">
            <ShieldCheck className="size-3" />
            <span>Verified</span>
          </div>
        </div>

        {/* Printable Emergency ID Card Container */}
        <div className="bg-gradient-to-br from-[#0D5F5A] to-[#083F3C] text-white rounded-[24px] p-6 shadow-lg flex flex-col gap-5 print:shadow-none print:border-2 print:border-black print:text-black">
          {/* Card Top Brand Row */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[9px] font-extrabold tracking-[0.2em] text-teal-300 uppercase block">
                JivaHQ • Emergency ID
              </span>
              <h2 className="text-lg font-black text-white truncate mt-1">
                {data.user.name}
              </h2>
            </div>
            <div className="size-11 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center font-bold text-sm shrink-0">
              {userInitials}
            </div>
          </div>

          {/* Blood group grid */}
          <div className="bg-white/10 border border-white/20 rounded-[16px] p-4 flex flex-col gap-1">
            <span className="text-[9px] font-extrabold tracking-wider text-teal-200 uppercase leading-none">
              Blood group
            </span>
            <span className="text-3xl font-black text-white leading-none">
              {profile?.bloodType ?? "O+"}
            </span>
          </div>

          {/* Allergies list */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-extrabold tracking-wider text-teal-200 uppercase">
              Allergies
            </span>
            {profile?.allergies && profile.allergies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.allergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="bg-white/15 border border-white/10 rounded-full px-3 py-1 text-[11px] font-semibold"
                  >
                    {allergy}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-white/70 italic">None listed</span>
            )}
          </div>

          {/* Critical conditions list */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-extrabold tracking-wider text-teal-200 uppercase">
              Critical conditions
            </span>
            {profile?.criticalConditions && profile.criticalConditions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.criticalConditions.map((condition) => (
                  <span
                    key={condition}
                    className="bg-white/15 border border-white/10 rounded-full px-3 py-1 text-[11px] font-semibold"
                  >
                    {condition}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-white/70 italic">None listed</span>
            )}
          </div>

          {/* Current medicines list */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-extrabold tracking-wider text-teal-200 uppercase">
              Current medicines
            </span>
            {profile?.currentMedications && profile.currentMedications.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.currentMedications.map((med) => (
                  <span
                    key={med}
                    className="bg-white/15 border border-white/10 rounded-full px-3 py-1 text-[11px] font-semibold"
                  >
                    {med}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-white/70 italic">None listed</span>
            )}
          </div>

          {/* Emergency Contacts list */}
          <div className="flex flex-col gap-2">
            <span className="text-[9px] font-extrabold tracking-wider text-teal-200 uppercase">
              Emergency contacts
            </span>
            {profile?.emergencyContacts && profile.emergencyContacts.length > 0 ? (
              <div className="flex flex-col gap-2 mt-1">
                {profile.emergencyContacts.map((c) => (
                  <div
                    key={c.phone}
                    className="flex justify-between items-center bg-white/10 p-3 rounded-[12px] border border-white/15"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-teal-200 mt-0.5">{c.relation}</p>
                    </div>
                    <a
                      href={`tel:${c.phone}`}
                      className="flex items-center gap-1.5 bg-white/20 border border-white/15 hover:bg-white/25 active:bg-white/30 text-white font-bold text-[11px] px-3.5 py-2 rounded-full shrink-0 shadow-sm transition-colors"
                    >
                      <PhoneCallIcon className="size-3" />
                      <span>{c.phone}</span>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-white/70 italic">None listed</span>
            )}
          </div>
        </div>

        {/* Print card button action */}
        <button
          onClick={() => window.print()}
          className="w-full flex items-center justify-center gap-2 border border-[#E2E8F0] bg-white text-[#0D5F5A] hover:bg-[#F8FAFC] py-3.5 rounded-[12px] text-xs font-bold active:scale-[0.99] transition-transform shadow-sm"
        >
          <PrinterIcon className="size-4" />
          <span>Save or print card</span>
        </button>
      </div>
    </div>
  );
}
