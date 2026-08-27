import Link from "next/link";
import { PillIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ParsedMed = {
  name: string;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  needsReview: boolean;
};

function parseMedication(raw: string): ParsedMed {
  const text = raw.trim();
  const doseMatch = text.match(
    /(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|iu|units?)\b)/i,
  );
  const routeMatch = text.match(
    /\b(oral|po|iv|im|sc|topical|inhaled|sublingual)\b/i,
  );
  const frequencyMatch = text.match(
    /\b(once\s+daily|twice\s+daily|thrice\s+daily|three\s+times\s+daily|qid|tid|bid|od|hs|prn|daily|nightly|every\s+\d+\s+hours?)\b/i,
  );

  let name = text;
  for (const match of [doseMatch, routeMatch, frequencyMatch]) {
    if (match?.[0]) name = name.replace(match[0], " ");
  }
  name =
    name
      .replace(/[·|,;/]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || text;

  const needsReview =
    /review|adjust|hold|increase|decrease|caution|interact/i.test(text) ||
    !doseMatch;

  return {
    name,
    dose: doseMatch?.[1]?.trim() ?? null,
    route: routeMatch?.[1]
      ? routeMatch[1].toLowerCase() === "po"
        ? "Oral"
        : routeMatch[1].charAt(0).toUpperCase() +
          routeMatch[1].slice(1).toLowerCase()
      : null,
    frequency: frequencyMatch?.[1]
      ? frequencyMatch[1].replace(/\b\w/g, (c) => c.toUpperCase())
      : null,
    needsReview,
  };
}

export function MedicationsPanel({
  title,
  emptyLabel,
  medications,
  footerLabel,
  itemsLabel,
  compliantLabel,
  reviewLabel,
}: {
  title: string;
  emptyLabel: string;
  medications: string[];
  footerLabel: string;
  itemsLabel: string;
  compliantLabel: string;
  reviewLabel: string;
}) {
  const parsed = medications.map(parseMedication);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="type-section-title flex items-center gap-2">
            <PillIcon className="text-primary size-4" aria-hidden />
            {title}
          </CardTitle>
          {parsed.length > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {itemsLabel}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {parsed.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {parsed.map((med, index) => {
              const meta = [med.dose, med.route, med.frequency]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={`${med.name}-${index}`}
                  className="flex items-start justify-between gap-3 rounded-lg border px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{med.name}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                      {meta || "As recorded in vault"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0",
                      med.needsReview && "text-destructive",
                    )}
                  >
                    {med.needsReview ? reviewLabel : compliantLabel}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href="/health-information"
          className={cn(
            buttonVariants({ variant: "link" }),
            "text-primary mt-3 h-auto px-0 text-sm",
          )}
        >
          {footerLabel}
        </Link>
      </CardContent>
    </Card>
  );
}
