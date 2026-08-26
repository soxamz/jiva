import { submitIntakeAction } from '@/lib/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        <h1 className="text-2xl font-semibold">Tell us how you feel</h1>
        <p className="text-muted-foreground text-sm">
          Share your symptoms before you meet a doctor.
        </p>
      </div>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>Describe your symptoms</CardTitle>
            <CardDescription>
              Answer in your own words. Urgent symptoms will be highlighted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitIntakeAction} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="chiefComplaint">What is troubling you?</FieldLabel>
                  <Input
                    id="chiefComplaint"
                    name="chiefComplaint"
                    placeholder="Dizziness, fever, chest pain"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="symptomDuration">When did it begin?</FieldLabel>
                  <Input
                    id="symptomDuration"
                    name="symptomDuration"
                    placeholder="Since yesterday evening"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="location">Where do you feel it?</FieldLabel>
                  <Input
                    id="location"
                    name="location"
                    placeholder="Left chest, abdomen, generalized"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="character">What does it feel like?</FieldLabel>
                  <Textarea
                    id="character"
                    name="character"
                    placeholder="Sharp, dull, burning, intermittent"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="severity">How severe is it? (1 to 10)</FieldLabel>
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
                  <FieldLabel htmlFor="aggravatingFactors">What makes it worse?</FieldLabel>
                  <Textarea id="aggravatingFactors" name="aggravatingFactors" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="relievingFactors">What makes it better?</FieldLabel>
                  <Textarea id="relievingFactors" name="relievingFactors" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="associatedSymptoms">Any other symptoms?</FieldLabel>
                  <Textarea id="associatedSymptoms" name="associatedSymptoms" />
                </Field>
                <Button type="submit">Check my symptoms</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>Previous symptom checks</CardTitle>
            <CardDescription>A summary is saved for you and your doctor.</CardDescription>
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
                      {intake.redFlag ? 'Needs quick attention' : 'Saved'}
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
