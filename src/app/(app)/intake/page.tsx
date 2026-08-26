import { submitIntakeAction } from '@/lib/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime } from '@/lib/format';
import { getI18n } from '@/lib/i18n';

export default async function IntakePage() {
  const data = await getPatientWorkspace();
  const { locale, t } = await getI18n();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('intake.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('intake.description')}</p>
      </div>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>{t('intake.describe')}</CardTitle>
            <CardDescription>{t('intake.describeDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitIntakeAction} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="chiefComplaint">{t('intake.chiefComplaint')}</FieldLabel>
                  <Input
                    id="chiefComplaint"
                    name="chiefComplaint"
                    placeholder="Dizziness, fever, chest pain"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="symptomDuration">{t('intake.duration')}</FieldLabel>
                  <Input
                    id="symptomDuration"
                    name="symptomDuration"
                    placeholder="Since yesterday evening"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="location">{t('intake.location')}</FieldLabel>
                  <Input
                    id="location"
                    name="location"
                    placeholder="Left chest, abdomen, generalized"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="character">{t('intake.character')}</FieldLabel>
                  <Textarea
                    id="character"
                    name="character"
                    placeholder="Sharp, dull, burning, intermittent"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="severity">{t('intake.severity')}</FieldLabel>
                  <Input
                    id="severity"
                    name="severity"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={5}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="aggravatingFactors">{t('intake.worse')}</FieldLabel>
                  <Textarea id="aggravatingFactors" name="aggravatingFactors" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="relievingFactors">{t('intake.better')}</FieldLabel>
                  <Textarea id="relievingFactors" name="relievingFactors" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="associatedSymptoms">{t('intake.otherSymptoms')}</FieldLabel>
                  <Textarea id="associatedSymptoms" name="associatedSymptoms" />
                </Field>
                <Button type="submit">{t('intake.submit')}</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>{t('intake.previous')}</CardTitle>
            <CardDescription>{t('intake.previousDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border flex flex-col divide-y">
              {data.intakeSessions.map((intake) => (
                <li className="flex min-h-18 flex-col gap-2 px-6 py-4" key={intake.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{intake.chiefComplaint}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(intake.createdAt, locale)}
                      </p>
                    </div>
                    <Badge variant={intake.redFlag ? 'destructive' : 'success'}>
                      {intake.redFlag ? t('dashboard.needsAttention') : t('dashboard.saved')}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm leading-6">{intake.summary}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
