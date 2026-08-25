import { submitIntakeAction } from '@/lib/actions';
import { DashboardCard } from '@/components/dashboard-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getPatientWorkspace } from '@/lib/dal';
import { formatDateTime } from '@/lib/format';

export default async function IntakePage() {
  const data = await getPatientWorkspace();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">BYOD intake</h1>
        <p className="text-muted-foreground text-sm">
          SOCRATES-style intake with demo red-flag rules.
        </p>
      </div>
      <section className="bg-border grid grid-cols-1 gap-px p-px xl:grid-cols-[0.8fr_1.2fr]">
        <DashboardCard className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>New intake</CardTitle>
            <CardDescription>Try chest pain or severity 9 to trigger triage.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitIntakeAction} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="chiefComplaint">Chief complaint</FieldLabel>
                  <Input
                    id="chiefComplaint"
                    name="chiefComplaint"
                    placeholder="Dizziness, fever, chest pain"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="symptomDuration">Onset and duration</FieldLabel>
                  <Input
                    id="symptomDuration"
                    name="symptomDuration"
                    placeholder="Since yesterday evening"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="location">Location</FieldLabel>
                  <Input
                    id="location"
                    name="location"
                    placeholder="Left chest, abdomen, generalized"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="character">Character</FieldLabel>
                  <Textarea
                    id="character"
                    name="character"
                    placeholder="Sharp, dull, burning, intermittent"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="severity">Severity 1-10</FieldLabel>
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
                  <FieldLabel htmlFor="aggravatingFactors">Aggravating factors</FieldLabel>
                  <Textarea id="aggravatingFactors" name="aggravatingFactors" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="relievingFactors">Relieving factors</FieldLabel>
                  <Textarea id="relievingFactors" name="relievingFactors" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="associatedSymptoms">Associated symptoms</FieldLabel>
                  <Textarea id="associatedSymptoms" name="associatedSymptoms" />
                </Field>
                <Button type="submit">Submit intake</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </DashboardCard>
        <DashboardCard className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>Submitted intakes</CardTitle>
            <CardDescription>Physician-ready draft summaries.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border flex flex-col divide-y">
              {data.intakeSessions.map((intake) => (
                <li className="flex min-h-18 flex-col gap-2 px-6 py-4" key={intake.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{intake.chiefComplaint}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(intake.createdAt)}
                      </p>
                    </div>
                    <Badge variant={intake.redFlag ? 'destructive' : 'success'}>
                      {intake.redFlag ? 'red flag' : 'routine'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm leading-6">{intake.summary}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </DashboardCard>
      </section>
    </div>
  );
}
