import { Badge } from "@/components/ui/badge";
import { AiIntakeChat } from "@/components/intake/ai-intake-chat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPatientWorkspace } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export default async function IntakePage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("intake.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("intake.description")}
        </p>
      </div>
      <section className="space-y-4">
        <AiIntakeChat />
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>{t("intake.previous")}</CardTitle>
            <CardDescription>{t("intake.previousDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border flex flex-col divide-y">
              {data.intakeSessions.map((intake) => (
                <li
                  className="flex min-h-18 flex-col gap-2 px-6 py-4"
                  key={intake.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{intake.chiefComplaint}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(intake.createdAt, locale)}
                      </p>
                    </div>
                    <Badge
                      variant={intake.redFlag ? "destructive" : "secondary"}
                    >
                      {intake.redFlag
                        ? t("dashboard.needsAttention")
                        : t("dashboard.saved")}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm leading-6">
                    {intake.summary}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
