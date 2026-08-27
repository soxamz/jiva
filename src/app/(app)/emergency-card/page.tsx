import { AlertTriangleIcon, PhoneIcon, ShieldCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPatientWorkspace } from "@/lib/dal";
import { getI18n } from "@/lib/i18n";

export default async function EmergencyCardPage() {
  const data = await getPatientWorkspace();
  const { t } = await getI18n();
  const profile = data.profile;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("emergencyCard.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("emergencyCard.description")}
        </p>
      </div>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="gap-0 md:col-span-3">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheckIcon aria-hidden />
              <CardTitle>{data.user.name}</CardTitle>
              <Badge variant="secondary">{t("emergencyCard.verified")}</Badge>
            </div>
            <CardDescription>
              {t("emergencyCard.verifiedDescription")}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-xs font-normal tracking-wide">
              {t("emergencyCard.bloodType")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {profile?.bloodType ?? "NA"}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-0 md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangleIcon aria-hidden />
              <CardTitle>{t("dashboard.allergies")}</CardTitle>
            </div>
            <CardDescription>
              {t("dashboard.importantInformationDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(profile?.allergies ?? []).length ? (
              profile?.allergies.map((allergy) => (
                <Badge key={allergy} variant="destructive">
                  {allergy}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">
                {t("emergencyCard.noAllergies")}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>{t("health.criticalConditions")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(profile?.criticalConditions ?? []).length ? (
              profile?.criticalConditions.map((condition) => (
                <Badge key={condition} variant="outline">
                  {condition}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">{t("emergencyCard.noneListed")}</Badge>
            )}
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>{t("health.currentMedicines")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(profile?.currentMedications ?? []).length ? (
              profile?.currentMedications.map((medication) => (
                <Badge key={medication} variant="secondary">
                  {medication}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">{t("emergencyCard.noneListed")}</Badge>
            )}
          </CardContent>
        </Card>
        <Card className="gap-0 md:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PhoneIcon aria-hidden />
              <CardTitle>{t("dashboard.emergencyContacts")}</CardTitle>
            </div>
            <CardDescription>
              {t("dashboard.emergencyContactsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
              {(profile?.emergencyContacts ?? []).map((contact) => (
                <li
                  key={contact.phone}
                  className="flex flex-col gap-1 px-6 py-4"
                >
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {contact.relation}
                  </p>
                  <p className="font-mono text-sm">{contact.phone}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
