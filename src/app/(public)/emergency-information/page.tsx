import Link from "next/link";
import {
  ArrowLeftIcon,
  FileTextIcon,
  PhoneIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  TriangleAlertIcon,
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
      <main className="min-h-dvh bg-muted/50 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-pretty text-2xl font-semibold tracking-tight">
              Patient Emergency Information
            </h1>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/emergency"
            >
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              Back to Scanner
            </Link>
          </div>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <ShieldCheckIcon className="size-5" aria-hidden="true" />
              </div>
              <CardTitle>No Patient Card Selected</CardTitle>
              <CardDescription>
                Authenticate a patient through the QR or biometric step before
                opening emergency information.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link className={buttonVariants()} href="/emergency">
                Return to Scanner
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
    <main className="min-h-dvh bg-muted/50 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="type-eyebrow text-muted-foreground">
              Emergency Access
            </p>
            <h1 className="text-pretty text-2xl font-semibold tracking-tight">
              Patient Emergency Information
            </h1>
          </div>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/emergency"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Back to Scanner
          </Link>
        </div>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <ShieldCheckIcon className="size-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl">{data.patient.name}</CardTitle>
              <CardDescription>
                Blood Group {data.profile?.bloodType ?? "Not recorded"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Known Allergies
                </p>
                {allergies.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {allergies.map((allergy) => (
                      <Badge key={allergy} variant="destructive">
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No allergies recorded.
                  </p>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Current Medicines
                </p>
                {medications.length ? (
                  <ul className="mt-2 space-y-1 text-sm font-medium">
                    {medications.map((medication) => (
                      <li key={medication}>{medication}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No medicines recorded.
                  </p>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <PhoneIcon className="size-3.5" aria-hidden="true" />
                  Emergency Contacts
                </div>
                {contacts.length ? (
                  <ul className="mt-2 space-y-3">
                    {contacts.map((contact) => (
                      <li key={contact.phone}>
                        <p className="text-sm font-medium">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {contact.relation}
                        </p>
                        <a
                          className="mt-1 inline-flex text-sm text-primary underline underline-offset-4"
                          href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
                        >
                          {contact.phone}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No emergency contacts recorded.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileTextIcon className="size-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl">Patient Documents</CardTitle>
              <CardDescription>
                Records added to the patient&apos;s health vault.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {data.documents.length ? (
                <ul className="divide-y border-y">
                  {data.documents.map((document) => (
                    <li
                      className="flex items-center gap-3 px-6 py-4"
                      key={document.id}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <FileTextIcon className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {document.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {documentTypeLabels[document.docType]} |{" "}
                          {formatDateTime(document.uploadedAt, locale)}
                        </p>
                      </div>
                      <Badge className="shrink-0" variant="secondary">
                        {toTitleCase(document.status)}
                      </Badge>
                      <OpenUploadedFileLink
                        href={document.storageUrl}
                        label={t("documents.openFile")}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-6 text-sm text-muted-foreground">
                  No documents are available.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex-row items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <StethoscopeIcon className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Recent Symptom Checks</CardTitle>
              <CardDescription className="mt-1">
                Recent details shared by the patient before a doctor visit.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {data.symptomChecks.length ? (
              <ul className="divide-y border-y">
                {data.symptomChecks.map((symptomCheck) => (
                  <li
                    className="flex min-w-0 items-start gap-3 px-6 py-4"
                    key={symptomCheck.id}
                  >
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <StethoscopeIcon className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {symptomCheck.chiefComplaint}
                        </p>
                        {symptomCheck.redFlag ? (
                          <Badge variant="destructive">
                            <TriangleAlertIcon
                              className="size-3"
                              aria-hidden="true"
                            />
                            Needs Urgent Attention
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Saved</Badge>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {symptomCheck.summary}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDateTime(symptomCheck.createdAt, locale)} |
                        Severity {symptomCheck.severity}/10
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 text-sm text-muted-foreground">
                No symptom checks are available.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex-row items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <StethoscopeIcon className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Emergency Notes</CardTitle>
              <CardDescription className="mt-1">
                Share the emergency card and available documents with the
                treating clinical team.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
