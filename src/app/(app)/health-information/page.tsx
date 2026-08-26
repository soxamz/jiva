import Link from 'next/link';
import { SaveIcon, ShieldCheckIcon } from 'lucide-react';

import { updateMedicalProfileAction } from '@/lib/actions';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getPatientWorkspace } from '@/lib/dal';

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] as const;

function displayList(values: string[] | undefined) {
  return values?.join(', ') ?? '';
}

export default async function HealthInformationPage() {
  const { profile } = await getPatientWorkspace();
  const emergencyContacts = (profile?.emergencyContacts ?? [])
    .map((contact) => `${contact.name} | ${contact.relation} | ${contact.phone}`)
    .join('\n');

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-muted-foreground text-sm">Your health record</p>
          <h1 className="text-2xl font-semibold">Health information</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Keep these details current so they are ready when care is needed.
          </p>
        </div>
        <Link href="/emergency-card" className={buttonVariants({ variant: 'outline' })}>
          <ShieldCheckIcon data-icon="inline-start" aria-hidden />
          View emergency card
        </Link>
      </section>

      <form action={updateMedicalProfileAction} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Emergency health details</CardTitle>
            <CardDescription>
              This information is shown on your emergency card and when you share records with a
              doctor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="bloodType">Blood group</FieldLabel>
                <Select id="bloodType" name="bloodType" defaultValue={profile?.bloodType ?? 'O+'}>
                  {bloodTypes.map((bloodType) => (
                    <option key={bloodType} value={bloodType}>
                      {bloodType}
                    </option>
                  ))}
                </Select>
              </Field>

              <FieldGroup className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="allergies">Allergies</FieldLabel>
                  <Input
                    id="allergies"
                    name="allergies"
                    defaultValue={displayList(profile?.allergies)}
                    placeholder="For example: Penicillin, Peanuts"
                  />
                  <FieldDescription>Separate each allergy with a comma.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="criticalConditions">Critical conditions</FieldLabel>
                  <Input
                    id="criticalConditions"
                    name="criticalConditions"
                    defaultValue={displayList(profile?.criticalConditions)}
                    placeholder="For example: Diabetes, Asthma"
                  />
                  <FieldDescription>Separate each condition with a comma.</FieldDescription>
                </Field>
              </FieldGroup>

              <Field>
                <FieldLabel htmlFor="currentMedications">Current medicines</FieldLabel>
                <Input
                  id="currentMedications"
                  name="currentMedications"
                  defaultValue={displayList(profile?.currentMedications)}
                  placeholder="For example: Metformin 500mg, Vitamin D"
                />
                <FieldDescription>Separate each medicine with a comma.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="emergencyContacts">Emergency contacts</FieldLabel>
                <Textarea
                  id="emergencyContacts"
                  name="emergencyContacts"
                  defaultValue={emergencyContacts}
                  placeholder={
                    'Asha Sharma | Mother | 9876543210\nRohan Sharma | Brother | 9876543211'
                  }
                  rows={4}
                />
                <FieldDescription>
                  Use one contact per line: name | relation | phone number.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">
              <SaveIcon data-icon="inline-start" aria-hidden />
              Save health information
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
