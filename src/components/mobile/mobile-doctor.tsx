"use client";

import { useI18n } from "@/components/i18n-provider";
import { signOutAction } from "@/lib/actions";
import { QrCode, LogOut, ShieldAlert } from "lucide-react";

interface MobileDoctorProps {
  user: {
    name: string;
    doctorId: string | null;
  };
  accessError: string | null;
}

export function MobileDoctor({ user, accessError }: MobileDoctorProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-12 md:hidden">
      {/* Page Header */}
      <header className="flex items-center justify-between px-6 pt-5 pb-3 bg-white border-b border-[#F1F5F9] mb-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#111827] leading-none mb-1">
            {t("doctor.title")}
          </h1>
          <p className="text-[#64748B] text-xs font-semibold">
            {t("doctor.signedIn", { name: user.name })}
          </p>
        </div>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {/* Error Alert */}
        {accessError && (
          <div className="bg-red-50 border border-red-200 rounded-[16px] p-4 flex gap-3 text-red-700">
            <ShieldAlert className="size-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-extrabold">{t("doctor.accessDeniedTitle")}</h4>
              <p className="text-[11px] font-semibold mt-0.5 leading-relaxed">{accessError}</p>
            </div>
          </div>
        )}

        {/* Card 1: Open Patient Record */}
        <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#E6F4F1] text-[#0D5F5A] shrink-0">
              <QrCode className="size-5.5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#111827] leading-tight">
                {t("doctor.openRecord")}
              </h3>
              <p className="text-[#64748B] text-xs mt-1.5 leading-relaxed font-semibold">
                {t("doctor.openRecordDescription")}
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Your Doctor ID */}
        <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-5 shadow-sm flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#111827] leading-tight">
              {t("doctor.doctorId")}
            </h3>
            <p className="text-[#64748B] text-[11px] mt-1 leading-relaxed font-medium">
              {t("doctor.doctorIdDescription")}
            </p>
          </div>

          <div className="bg-[#F8FAFC] border border-[#F1F5F9] rounded-[16px] py-4 px-5 text-center my-1.5">
            <span className="font-mono text-xl font-bold tracking-wider text-[#111827]">
              {user.doctorId ?? t("doctor.notAssigned")}
            </span>
          </div>

          <p className="text-[#64748B] text-[10px] leading-relaxed font-semibold">
            {t("doctor.revokeNotice")}
          </p>
        </div>

        {/* Card 3: Consultation Hours */}
        <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-extrabold text-[#111827] leading-tight">
              {t("doctor.consultationHours")}
            </h3>
            <p className="text-[#64748B] text-[11px] mt-1 font-semibold">
              {t("doctor.consultationHoursDescription")}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 mt-2">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2 text-xs font-semibold">
              <span className="text-[#64748B]">{t("doctor.morningConsultation")}</span>
              <span className="text-[#111827] font-extrabold">10:00 - 13:00</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#64748B]">{t("doctor.eveningConsultation")}</span>
              <span className="text-[#111827] font-extrabold">17:00 - 20:00</span>
            </div>
          </div>
        </div>

        {/* Sign Out Action Button */}
        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-200/50 text-red-600 py-3.5 rounded-[12px] text-xs font-bold active:scale-[0.99] transition-transform"
          >
            <LogOut className="size-4" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </div>
  );
}
