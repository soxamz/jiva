import { CheckCircle2Icon, SparklesIcon } from "lucide-react";

import {
  hasHighSeverityContradiction,
  normalizeSeverity,
  parseSummarySections,
  type ClinicalSummary,
} from "@/lib/clinical-summary";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong
              key={`${part}-${index}`}
              className="text-foreground font-semibold"
            >
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

function extractTone(severity: string | undefined): "high" | "medium" | "low" {
  return normalizeSeverity(severity);
}

export function SummaryEnginePanel({
  clinical,
  title,
  generatedLabel,
  recordsLabel,
  highConfidenceLabel,
  reviewLabel,
  extractsTitle,
  extractsEmpty,
  footerLabel,
  reportLabel,
  sourceNote,
}: {
  clinical: ClinicalSummary;
  title: string;
  generatedLabel: string;
  recordsLabel: string;
  highConfidenceLabel: string;
  reviewLabel: string;
  extractsTitle: string;
  extractsEmpty: string;
  footerLabel: string;
  reportLabel: string;
  sourceNote?: string | null;
}) {
  const narrative = clinical.doctor_english_summary?.trim() ?? "";
  const sections = parseSummarySections(narrative);
  const highConfidence =
    !clinical.triage_alert && !hasHighSeverityContradiction(clinical);

  const labs = clinical.abnormal_lab_flags ?? [];
  const contradictions = (clinical.detected_contradictions ?? []).filter(
    (item) => {
      const severity = item.severity?.toLowerCase();
      return severity === "high" || severity === "medium" || severity === "low";
    },
  );
  const hasExtracts = labs.length > 0 || contradictions.length > 0;
  const hasChiefSection = sections.some((section) =>
    /chief complaint/i.test(section.title),
  );

  return (
    <Card>
      <CardHeader className="gap-3 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bg-muted text-primary mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md">
              <SparklesIcon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base tracking-wide uppercase">
                {title}
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                {generatedLabel}
                {recordsLabel ? ` ${recordsLabel}` : null}
              </p>
            </div>
          </div>
          <Badge
            variant={highConfidence ? "secondary" : "destructive"}
            className={cn("gap-1", highConfidence && "text-primary")}
          >
            {highConfidence ? (
              <CheckCircle2Icon className="size-3.5" aria-hidden />
            ) : null}
            {highConfidence ? highConfidenceLabel : reviewLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-5">
        <div className="flex flex-col gap-4">
          {clinical.chief_complaint &&
          !hasChiefSection &&
          clinical.chief_complaint.length <= 120 ? (
            <p className="text-foreground text-sm font-semibold">
              {clinical.chief_complaint}
            </p>
          ) : null}

          {sections.length > 0 ? (
            sections.map((section) => (
              <section key={section.title} className="flex flex-col gap-2">
                <h3 className="text-foreground text-sm font-semibold tracking-wide">
                  {section.title}
                </h3>
                {/current status|summary/i.test(section.title) &&
                section.lines.length <= 1 ? (
                  <p className="text-muted-foreground text-sm leading-6">
                    <BoldText text={section.lines[0] ?? ""} />
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {section.lines.map((line, index) => (
                      <li
                        key={`${section.title}-${index}-${line.slice(0, 40)}`}
                        className="text-muted-foreground flex gap-2 text-sm leading-6"
                      >
                        <span
                          className="text-foreground/40 mt-2 size-1 shrink-0 rounded-full bg-current"
                          aria-hidden
                        />
                        <span>
                          <BoldText text={line} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          ) : narrative ? (
            <p className="text-muted-foreground text-sm leading-6 whitespace-pre-wrap">
              <BoldText text={narrative} />
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              No physician narrative available yet.
            </p>
          )}
        </div>

        <div className="border-border/60 border-t pt-5">
          <h3 className="mb-3 text-sm font-semibold tracking-wide uppercase">
            {extractsTitle}
          </h3>
          {!hasExtracts ? (
            <p className="text-muted-foreground text-sm">{extractsEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {labs.map((lab, index) => {
                const tone =
                  /high|critical|elevat/i.test(lab.clinical_significance) ||
                  /high|critical/i.test(lab.flagged_value)
                    ? "high"
                    : /improv|normal|down|low risk/i.test(
                          lab.clinical_significance,
                        )
                      ? "low"
                      : "medium";
                return (
                  <li
                    key={`lab-${index}-${lab.test_name}-${lab.flagged_value}`}
                    className="flex gap-3 text-sm"
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2.5 shrink-0 rounded-full",
                        tone === "high" && "bg-destructive",
                        tone === "medium" && "bg-muted-foreground",
                        tone === "low" && "bg-primary",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-medium">
                        {lab.test_name}: {lab.flagged_value}
                      </p>
                      <p className="text-muted-foreground text-xs leading-5">
                        {lab.clinical_significance}
                      </p>
                    </div>
                  </li>
                );
              })}
              {contradictions.map((item, index) => {
                const tone = extractTone(item.severity);
                return (
                  <li
                    key={`contradiction-${index}-${item.severity}-${item.issue}`}
                    className="flex gap-3 text-sm"
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2.5 shrink-0 rounded-full",
                        tone === "high" && "bg-destructive",
                        tone === "medium" && "bg-muted-foreground",
                        tone === "low" && "bg-primary",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{item.issue}</p>
                      {item.source_reference ? (
                        <p className="text-muted-foreground text-xs">
                          {item.source_reference}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="text-muted-foreground border-border/50 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
          <p>
            {footerLabel}
            {sourceNote ? ` · ${sourceNote}` : null}
          </p>
          <a
            href="mailto:support@jivahq.local?subject=Clinical%20overview%20feedback"
            className="text-primary hover:underline"
          >
            {reportLabel}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
