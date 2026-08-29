import Link from "next/link";
import {
  ArrowLeftIcon,
  FileTextIcon,
  PhoneCallIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  TriangleAlertIcon,
  HeartPulseIcon,
  PillIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { OpenUploadedFileLink } from "@/components/documents/open-uploaded-file-link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getEmergencyPreviewData } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const documentTypeLabels = {
  discharge: "Discharge Summary",
  lab: "Lab Report",
  note: "Clinical Note",
  other: "Other Document",
  rx: "Prescription",
};

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function EmergencyInformationPage() {
  const [{ locale, t }, data] = await Promise.all([
    getI18n(),
    getEmergencyPreviewData(),
  ]);

  if (!data) {
    return (
      <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Patient Emergency Information
            </h1>
            <Link
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href="/emergency"
            >
              <ArrowLeftIcon className="size-4 mr-1" aria-hidden="true" />
              Scanner
            </Link>
          </div>
          <Card className="rounded-2xl shadow-sm border-slate-200">
            <CardHeader className="text-center pb-4">
              <div className="flex size-14 mx-auto items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 mb-2">
                <ShieldCheckIcon className="size-7" aria-hidden="true" />
              </div>
              <CardTitle className="text-lg font-bold">No Patient Card Selected</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Authenticate a patient through the QR or biometric step before
                opening emergency information.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pt-2">
              <Link className={cn(buttonVariants({ variant: "destructive" }), "w-full rounded-xl font-bold")} href="/emergency">
                Return to Emergency Scanner
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const allergies = data.profile?.allergies ?? [];
  const medications = data.profile?.currentMedications ?? [];
  const contacts = data.profile?.emergencyContacts ?? [];

  return (
    <main className="min-h-dvh bg-slate-50 px-3 py-4 sm:px-6 sm:py-8 lg:px-8 pb-20">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:gap-6">
        {/* Emergency Alert Banner */}
        <div className="bg-red-600 text-white rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
              <ShieldAlertIcon className="size-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-200 block">
                Break-Glass Protocol Active
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                Emergency Patient Records
              </h2>
            </div>
          </div>
          <Link
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-white text-red-700 hover:bg-red-50 text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-sm"
            href="/emergency"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
            <span>Back to Scanner</span>
          </Link>
        </div>

        {/* Hero Patient Header Strip */}
        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
          <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="size-12 rounded-2xl bg-teal-50 border border-teal-200/60 text-[#0D5F5A] flex items-center justify-center font-black text-lg shrink-0">
                {data.patient.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 truncate">
                  {data.patient.name}
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Emergency Medical Record Vault
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-start pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <div className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full font-black text-xs">
                <HeartPulseIcon className="size-3.5 text-red-600 animate-pulse" />
                <span>Blood: {data.profile?.bloodType ?? "NA"}</span>
              </div>
              <Badge variant="outline" className="text-xs font-bold text-teal-700 bg-teal-50 border-teal-200">
                Verified Patient
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Grid: Health Profile Left, Documents & Intakes Right */}
        <section className="grid gap-4 sm:gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Health Profile (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Allergies Card */}
            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
              <CardHeader className="p-4 sm:p-5 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
                  <TriangleAlertIcon className="size-4 text-red-500" />
                  Known Allergies
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0">
                {allergies.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {allergies.map((allergy) => (
                      <Badge key={allergy} variant="destructive" className="text-xs px-3 py-1 font-bold">
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No allergies recorded.</p>
                )}
              </CardContent>
            </Card>

            {/* Current Medicines Card */}
            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
              <CardHeader className="p-4 sm:p-5 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
                  <PillIcon className="size-4 text-emerald-600" />
                  Current Medicines
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0">
                {medications.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {medications.map((medication) => (
                      <Badge key={medication} variant="secondary" className="text-xs px-2.5 py-1 font-semibold">
                        {medication}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No medicines recorded.</p>
                )}
              </CardContent>
            </Card>

            {/* Emergency Contacts Card */}
            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
              <CardHeader className="p-4 sm:p-5 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
                  <PhoneCallIcon className="size-4 text-[#0D5F5A]" />
                  Emergency Contacts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0">
                {contacts.length ? (
                  <div className="flex flex-col gap-2.5">
                    {contacts.map((contact) => (
                      <div
                        key={contact.phone}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{contact.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{contact.relation}</p>
                        </div>
                        <a
                          className="flex items-center gap-1 bg-[#0D5F5A] text-white hover:bg-[#0b504c] text-[11px] font-extrabold px-3 py-1.5 rounded-full shrink-0 active:scale-95 transition-transform"
                          href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
                        >
                          <PhoneCallIcon className="size-3" />
                          <span>Call</span>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No emergency contacts recorded.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Documents & Symptom Checks (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Patient Documents Card */}
            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-teal-50 text-[#0D5F5A] flex items-center justify-center">
                    <FileTextIcon className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">Patient Documents</CardTitle>
                    <CardDescription className="text-xs">Records available in health vault</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.documents.length ? (
                  <ul className="divide-y divide-slate-100">
                    {data.documents.map((document) => (
                      <li
                        className="flex items-center gap-3 p-4 hover:bg-slate-50/50 transition-colors"
                        key={document.id}
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                          <FileTextIcon className="size-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs sm:text-sm font-bold text-slate-900">
                            {document.title}
                          </p>
                          <p className="mt-0.5 text-[10px] sm:text-xs text-slate-500 font-medium">
                            {documentTypeLabels[document.docType] || document.docType} •{" "}
                            {formatDateTime(document.uploadedAt, locale)}
                          </p>
                        </div>
                        <OpenUploadedFileLink
                          href={document.storageUrl}
                          label={t("documents.openFile")}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-5 text-xs text-slate-500 italic">No documents available.</p>
                )}
              </CardContent>
            </Card>

            {/* Recent Symptom Checks Card */}
            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <StethoscopeIcon className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">Recent Symptom Checks</CardTitle>
                    <CardDescription className="text-xs">Patient self-reported intake summaries</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.symptomChecks.length ? (
                  <ul className="divide-y divide-slate-100">
                    {data.symptomChecks.map((symptomCheck) => (
                      <li
                        className="flex flex-col gap-2 p-4"
                        key={symptomCheck.id}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs sm:text-sm font-bold text-slate-900">
                            {symptomCheck.chiefComplaint}
                          </p>
                          {symptomCheck.redFlag ? (
                            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 font-bold flex items-center gap-1">
                              <TriangleAlertIcon className="size-3" />
                              Urgent Attention Needed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-semibold">
                              Routine
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium line-clamp-3">
                          {symptomCheck.summary}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {formatDateTime(symptomCheck.createdAt, locale)} • Severity {symptomCheck.severity}/10
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-5 text-xs text-slate-500 italic">No symptom checks recorded.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
