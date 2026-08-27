'use client';

import { useActionState } from 'react';
import { SaveIcon } from 'lucide-react';

import { updateMedicalProfileAction, type FormState } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/components/i18n-provider';

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] as const;

type MedicalProfileFormProps = {
  bloodType: string;
  allergies: string;
  criticalConditions: string;
  currentMedications: string;
  emergencyContacts: string;
};

export function MedicalProfileForm({
  bloodType,
  allergies,
  criticalConditions,
  currentMedications,
  emergencyContacts,
}: Readonly<MedicalProfileFormProps>) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateMedicalProfileAction,
    undefined
  );

  return (
    <form action={action} className="contents">
      <FieldGroup>
        <Field data-invalid={Boolean(state?.errors?.bloodType)}>
          <FieldLabel htmlFor="bloodType">{t('dashboard.bloodGroup')}</FieldLabel>
          <Select defaultValue={bloodType} name="bloodType">
            <SelectTrigger
              aria-invalid={Boolean(state?.errors?.bloodType)}
              className="w-full"
              id="bloodType"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {bloodTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError errors={state?.errors?.bloodType?.map((message) => ({ message }))} />
        </Field>

        <FieldGroup className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field data-invalid={Boolean(state?.errors?.allergies)}>
            <FieldLabel htmlFor="allergies">{t('dashboard.allergies')}</FieldLabel>
            <Input
              aria-invalid={Boolean(state?.errors?.allergies)}
              defaultValue={allergies}
              id="allergies"
              name="allergies"
              placeholder="For example: Penicillin, Peanuts"
            />
            <FieldDescription>{t('health.separateComma')}</FieldDescription>
            <FieldError errors={state?.errors?.allergies?.map((message) => ({ message }))} />
          </Field>
          <Field data-invalid={Boolean(state?.errors?.criticalConditions)}>
            <FieldLabel htmlFor="criticalConditions">{t('health.criticalConditions')}</FieldLabel>
            <Input
              aria-invalid={Boolean(state?.errors?.criticalConditions)}
              defaultValue={criticalConditions}
              id="criticalConditions"
              name="criticalConditions"
              placeholder="For example: Diabetes, Asthma"
            />
            <FieldDescription>{t('health.separateComma')}</FieldDescription>
            <FieldError
              errors={state?.errors?.criticalConditions?.map((message) => ({ message }))}
            />
          </Field>
        </FieldGroup>

        <Field data-invalid={Boolean(state?.errors?.currentMedications)}>
          <FieldLabel htmlFor="currentMedications">{t('health.currentMedicines')}</FieldLabel>
          <Input
            aria-invalid={Boolean(state?.errors?.currentMedications)}
            defaultValue={currentMedications}
            id="currentMedications"
            name="currentMedications"
            placeholder="For example: Metformin 500mg, Vitamin D"
          />
          <FieldDescription>{t('health.separateComma')}</FieldDescription>
          <FieldError errors={state?.errors?.currentMedications?.map((message) => ({ message }))} />
        </Field>

        <Field data-invalid={Boolean(state?.errors?.emergencyContacts)}>
          <FieldLabel htmlFor="emergencyContacts">{t('dashboard.emergencyContacts')}</FieldLabel>
          <Textarea
            aria-invalid={Boolean(state?.errors?.emergencyContacts)}
            defaultValue={emergencyContacts}
            id="emergencyContacts"
            name="emergencyContacts"
            placeholder={'Asha Sharma | Mother | 9876543210\nRohan Sharma | Brother | 9876543211'}
            rows={4}
          />
          <FieldDescription>{t('health.contactsFormat')}</FieldDescription>
          <FieldError errors={state?.errors?.emergencyContacts?.map((message) => ({ message }))} />
        </Field>
        {state?.message && <FieldError>{state.message}</FieldError>}
        <Field>
          <Button disabled={pending} type="submit">
            <SaveIcon data-icon="inline-start" aria-hidden />
            {t('health.save')}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
