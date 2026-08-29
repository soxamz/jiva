import Link from "next/link";
import {
  PhoneCallIcon,
  ShieldCheckIcon,
  PrinterIcon,
  HeartPulseIcon,
  AlertTriangleIcon,
  PencilIcon,
  PillIcon,
  StethoscopeIcon,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPatientWorkspace } from "@/lib/dal";
import { getI18n } from "@/lib/i18n";
import { MobileEmergencyCard } from "@/components/mobile/mobile-emergency-card";
import { PrintCardButton } from "@/components/emergency/print-card-button";

export default async function EmergencyCardPage() {
  const data = await getPatientWorkspace();
  const { t } = await getI18n();
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
    <>
      {/* Mobile view */}
      <MobileEmergencyCard data={data} />

      {/* Desktop View */}
      <div className="hidden md:flex mx-auto w-full max-w-5xl flex-col gap-6">
        <PageHeader
          actions={
            <Link
              href="/health-information"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <PencilIcon className="size-3.5 mr-1.5" />
              {t("dashboard.editHealthInformation")}
            </Link>
          }
          description={t("emergencyCard.description")}
          title={t("emergencyCard.title")}
        />

        {/* Hero Section: ID Card Left + Primary Emergency Cards Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Digital Emergency Card Pass (4 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-gradient-to-br from-[#0D5F5A] via-[#0b524e] to-[#083F3C] text-white rounded-[24px] p-6 shadow-xl border border-teal-700/50 flex flex-col gap-5">
              {/* Card Brand Header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold tracking-[0.2em] text-teal-300 uppercase block">
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

              {/* Verified Pill */}
              <div className="flex items-center justify-between bg-white/10 border border-white/15 px-3.5 py-2 rounded-xl text-xs">
                <span className="text-teal-200 text-[11px] font-medium">Vault Status</span>
                <StatusPill tone="success" className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30">
                  <ShieldCheckIcon className="size-3.5" aria-hidden />
                  {t("emergencyCard.verified")}
                </StatusPill>
              </div>

              {/* Blood Group Display */}
              <div className="bg-white/10 border border-white/20 rounded-[18px] p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold tracking-wider text-teal-200 uppercase block leading-none">
                    Blood Group
                  </span>
                  <span className="text-3xl font-black text-white leading-none mt-1 block">
                    {profile?.bloodType ?? "NA"}
                  </span>
                </div>
                <div className="size-10 rounded-full bg-red-500/20 border border-red-300/30 flex items-center justify-center text-red-300 font-bold">
                  <HeartPulseIcon className="size-5" />
                </div>
              </div>

              {/* Quick Summary Counts */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/10 border border-white/15 p-2.5 rounded-xl">
                  <span className="text-[10px] text-teal-200 uppercase font-bold block">Allergies</span>
                  <span className="font-extrabold text-white text-sm">
                    {profile?.allergies?.length ?? 0} Listed
                  </span>
                </div>
                <div className="bg-white/10 border border-white/15 p-2.5 rounded-xl">
                  <span className="text-[10px] text-teal-200 uppercase font-bold block">Medicines</span>
                  <span className="font-extrabold text-white text-sm">
                    {profile?.currentMedications?.length ?? 0} Active
                  </span>
                </div>
              </div>
            </div>

            {/* Print Action */}
            <PrintCardButton />
          </div>

          {/* Right Column: Detailed Info Breakdown (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Allergies & Blood Group Card */}
            <Card className="rounded-2xl shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b pb-4">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                    <AlertTriangleIcon className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">Known Allergies & Sensitivities</CardTitle>
                    <CardDescription className="text-xs">Critical alerts for first responders</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {(profile?.allergies ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(profile?.allergies ?? []).map((allergy) => (
                      <Badge
                        key={allergy}
                        variant="destructive"
                        className="text-xs px-3 py-1 font-semibold rounded-full"
                      >
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {t("emergencyCard.noAllergies")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Critical Conditions & Medications */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="rounded-2xl shadow-sm border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <StethoscopeIcon className="size-4 text-teal-600" />
                    <CardTitle className="text-sm font-bold">{t("health.criticalConditions")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {(profile?.criticalConditions ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(profile?.criticalConditions ?? []).map((condition) => (
                        <Badge key={condition} variant="secondary" className="text-xs">
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {t("emergencyCard.noneListed")}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <PillIcon className="size-4 text-emerald-600" />
                    <CardTitle className="text-sm font-bold">{t("health.currentMedicines")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {(profile?.currentMedications ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(profile?.currentMedications ?? []).map((medication) => (
                        <Badge key={medication} variant="secondary" className="text-xs">
                          {medication}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {t("emergencyCard.noneListed")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Emergency Contacts Card */}
            <Card className="rounded-2xl shadow-sm border-slate-200">
              <CardHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-teal-50 text-[#0D5F5A] flex items-center justify-center">
                      <PhoneCallIcon className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">{t("dashboard.emergencyContacts")}</CardTitle>
                      <CardDescription className="text-xs">{t("dashboard.emergencyContactsDescription")}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {(profile?.emergencyContacts ?? []).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(profile?.emergencyContacts ?? []).map((contact) => (
                      <div
                        key={contact.phone}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{contact.name}</p>
                          <p className="text-[11px] text-slate-500 font-medium">{contact.relation}</p>
                        </div>
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1 bg-[#0D5F5A] text-white hover:bg-[#0b504c] px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ml-2"
                        >
                          <PhoneCallIcon className="size-3" />
                          <span>{contact.phone}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {t("dashboard.noEmergencyContacts")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
