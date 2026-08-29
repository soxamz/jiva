"use client";

import { PrinterIcon, PhoneCallIcon, ShieldCheck, AlertTriangleIcon, HeartPulseIcon } from "lucide-react";
import { MobileHeader } from "./mobile-header";

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
        <div className="flex items-center justify-between border border-teal-200/70 bg-[#E6F4F1] px-4 py-3 rounded-2xl shadow-sm">
          <div className="min-w-0">
            <h3 className="text-xs font-extrabold text-[#0D5F5A] leading-none">Emergency medical card</h3>
            <p className="text-[10px] text-teal-800 mt-1 leading-normal font-medium">
              Live patient data. Always kept up-to-date and printable.
            </p>
          </div>
          <div className="bg-[#0D5F5A] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1">
            <ShieldCheck className="size-3" />
            <span>Verified</span>
          </div>
        </div>

        {/* Digital Emergency ID Card */}
        <div className="bg-gradient-to-br from-[#0D5F5A] via-[#0b524e] to-[#083F3C] text-white rounded-[24px] p-6 shadow-xl flex flex-col gap-5 border border-teal-700/50 print:shadow-none print:border-2 print:border-black print:text-black">
          {/* Card Header */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[9px] font-extrabold tracking-[0.2em] text-teal-300 uppercase block">
                JivaHQ • Emergency Pass
              </span>
              <h2 className="text-xl font-black text-white truncate mt-1">
                {data.user.name}
              </h2>
            </div>
            <div className="size-12 rounded-2xl bg-white/15 border-2 border-white/20 flex items-center justify-center font-black text-base text-white shrink-0 shadow-inner">
              {userInitials}
            </div>
          </div>

          {/* Blood group display */}
          <div className="bg-white/10 border border-white/20 rounded-[18px] p-4 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-extrabold tracking-wider text-teal-200 uppercase block leading-none">
                Blood Group
              </span>
              <span className="text-3xl font-black text-white leading-none mt-1 block">
                {profile?.bloodType ?? "Not listed"}
              </span>
            </div>
            <div className="size-10 rounded-full bg-red-500/20 border border-red-300/30 flex items-center justify-center text-red-300 font-bold text-xs">
              <HeartPulseIcon className="size-5 text-red-300 animate-pulse" />
            </div>
          </div>

          {/* Allergies list */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-extrabold tracking-wider text-teal-200 uppercase flex items-center gap-1">
              <AlertTriangleIcon className="size-3 text-amber-300" />
              Known Allergies
            </span>
            {profile?.allergies && profile.allergies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.allergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="bg-red-500/20 border border-red-300/40 text-red-100 rounded-full px-3 py-1 text-[11px] font-bold"
                  >
                    {allergy}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-white/70 font-medium italic">No allergies recorded</span>
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
                    className="bg-white/15 border border-white/20 text-white rounded-full px-3 py-1 text-[11px] font-semibold"
                  >
                    {condition}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-white/70 font-medium italic">No conditions listed</span>
            )}
          </div>

          {/* Current medicines list */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-extrabold tracking-wider text-teal-200 uppercase">
              Active Medications
            </span>
            {profile?.currentMedications && profile.currentMedications.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.currentMedications.map((med) => (
                  <span
                    key={med}
                    className="bg-white/15 border border-white/20 text-white rounded-full px-3 py-1 text-[11px] font-semibold"
                  >
                    {med}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-white/70 font-medium italic">No active medicines</span>
            )}
          </div>

          {/* Emergency Contacts */}
          <div className="flex flex-col gap-2 pt-2 border-t border-white/15">
            <span className="text-[9px] font-extrabold tracking-wider text-teal-200 uppercase">
              Emergency contacts
            </span>
            {profile?.emergencyContacts && profile.emergencyContacts.length > 0 ? (
              <div className="flex flex-col gap-2 mt-1">
                {profile.emergencyContacts.map((c) => (
                  <div
                    key={c.phone}
                    className="flex justify-between items-center bg-white/10 p-3 rounded-[14px] border border-white/15"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-teal-200 mt-0.5 font-medium">{c.relation}</p>
                    </div>
                    <a
                      href={`tel:${c.phone}`}
                      className="flex items-center gap-1.5 bg-white text-[#0D5F5A] font-extrabold text-[11px] px-3.5 py-2 rounded-full shrink-0 shadow-sm active:scale-95 transition-transform"
                    >
                      <PhoneCallIcon className="size-3 text-[#0D5F5A]" />
                      <span>{c.phone}</span>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-white/70 font-medium italic">No emergency contacts registered</span>
            )}
          </div>
        </div>

        {/* Print Card Action */}
        <button
          onClick={() => window.print()}
          className="w-full flex items-center justify-center gap-2 border border-[#E2E8F0] bg-white text-[#0D5F5A] hover:bg-[#F8FAFC] py-3.5 rounded-[14px] text-xs font-bold active:scale-[0.99] transition-transform shadow-sm"
        >
          <PrinterIcon className="size-4" />
          <span>Save or print emergency card</span>
        </button>
      </div>
    </div>
  );
}
