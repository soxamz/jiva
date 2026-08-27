import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  hasHighSeverityContradiction,
  renderSummaryParagraphs,
  type ClinicalSummary,
} from '@/lib/clinical-summary';
import { cn } from '@/lib/utils';

function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={`${part}-${index}`} className="text-foreground font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

export function OverviewSectionCard({
  title,
  description,
  children,
  className,
  headerAside,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerAside?: ReactNode;
}) {
  return (
    <Card className={cn('gap-0', className)}>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {headerAside}
        </div>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

export function SummaryEngineCard({
  title,
  description,
  clinical,
  generatedLabel,
  highConfidenceLabel,
  reviewLabel,
}: {
  title: string;
  description: string;
  clinical: ClinicalSummary;
  generatedLabel: string;
  highConfidenceLabel: string;
  reviewLabel: string;
}) {
  const narrative = clinical.doctor_english_summary?.trim() ?? '';
  const highConfidence =
    !clinical.triage_alert && !hasHighSeverityContradiction(clinical);
  const paragraphs = renderSummaryParagraphs(narrative);

  return (
    <OverviewSectionCard
      title={title}
      description={description}
      headerAside={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={highConfidence ? 'secondary' : 'destructive'}>
            {highConfidence ? highConfidenceLabel : reviewLabel}
          </Badge>
          <span className="text-muted-foreground text-xs">{generatedLabel}</span>
        </div>
      }
    >
      {paragraphs.length > 0 ? (
        <div className="flex flex-col gap-3 text-sm leading-6">
          {paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="text-muted-foreground whitespace-pre-wrap">
              <BoldText text={paragraph} />
            </p>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No physician narrative available yet.</p>
      )}
    </OverviewSectionCard>
  );
}

export function CriticalExtractsCard({
  title,
  description,
  clinical,
  emptyLabel,
}: {
  title: string;
  description: string;
  clinical: ClinicalSummary;
  emptyLabel: string;
}) {
  const labs = clinical.abnormal_lab_flags ?? [];
  const contradictions = (clinical.detected_contradictions ?? []).filter((item) => {
    const severity = item.severity?.toLowerCase();
    return severity === 'high' || severity === 'medium';
  });

  const hasItems = labs.length > 0 || contradictions.length > 0;

  return (
    <OverviewSectionCard title={title} description={description}>
      {!hasItems ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {labs.map((lab, index) => (
            <li
              key={`lab-${index}-${lab.test_name}-${lab.flagged_value}`}
              className="border-border/70 rounded-xl border px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{lab.test_name}</p>
                <Badge variant="destructive">{lab.flagged_value}</Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">{lab.clinical_significance}</p>
            </li>
          ))}
          {contradictions.map((item, index) => (
            <li
              key={`contradiction-${index}-${item.severity}-${item.issue}`}
              className="border-border/70 rounded-xl border px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={item.severity.toLowerCase() === 'high' ? 'destructive' : 'secondary'}
                >
                  {item.severity}
                </Badge>
                <p className="font-medium">{item.issue}</p>
              </div>
              {item.source_reference ? (
                <p className="text-muted-foreground mt-1 text-xs">{item.source_reference}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </OverviewSectionCard>
  );
}

export function SuggestedActionsCard({
  title,
  description,
  actions,
  emptyLabel,
}: {
  title: string;
  description: string;
  actions: string[];
  emptyLabel: string;
}) {
  return (
    <OverviewSectionCard title={title} description={description}>
      {actions.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {actions.map((action, index) => (
            <li
              key={action}
              className="bg-primary/5 border-primary/15 flex gap-3 rounded-xl border px-3 py-2.5 text-sm"
            >
              <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {index + 1}
              </span>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      )}
    </OverviewSectionCard>
  );
}

export function MedicationsCard({
  title,
  description,
  medications,
  emptyLabel,
}: {
  title: string;
  description: string;
  medications: string[];
  emptyLabel: string;
}) {
  return (
    <OverviewSectionCard title={title} description={description}>
      {medications.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {medications.map((med) => (
            <Badge key={med} variant="secondary">
              {med}
            </Badge>
          ))}
        </div>
      )}
    </OverviewSectionCard>
  );
}

export function ClinicalHistoryCard({
  title,
  description,
  items,
  emptyLabel,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; dateLabel: string; type: string; title: string }>;
  emptyLabel: string;
}) {
  return (
    <OverviewSectionCard title={title} description={description}>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <ul className="divide-border divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.title}</p>
                <p className="text-muted-foreground text-xs">{item.type}</p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {item.dateLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </OverviewSectionCard>
  );
}
