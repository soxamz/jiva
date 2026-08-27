'use client';

import { useActionState } from 'react';

import { grantConsentAction, type FormState } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/components/i18n-provider';

const durations = [
  ['30', '30 minutes'],
  ['60', '1 hour'],
  ['120', '2 hours'],
  ['240', '4 hours'],
  ['480', '8 hours'],
  ['1440', '24 hours'],
] as const;

export function ConsentForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(
    grantConsentAction,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={Boolean(state?.errors?.doctorId)}>
          <FieldLabel htmlFor="doctorId">{t('share.doctorId')}</FieldLabel>
          <Input
            aria-invalid={Boolean(state?.errors?.doctorId)}
            defaultValue="HPR-DEMO-1001"
            id="doctorId"
            maxLength={80}
            name="doctorId"
          />
          <FieldError errors={state?.errors?.doctorId?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(state?.errors?.durationMinutes)}>
          <FieldLabel htmlFor="durationMinutes">{t('share.duration')}</FieldLabel>
          <Select defaultValue="120" name="durationMinutes">
            <SelectTrigger
              aria-invalid={Boolean(state?.errors?.durationMinutes)}
              className="w-full"
              id="durationMinutes"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {durations.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError errors={state?.errors?.durationMinutes?.map((message) => ({ message }))} />
        </Field>
        {state?.message && <FieldError>{state.message}</FieldError>}
        <Field>
          <Button disabled={pending} type="submit">
            {t('share.createCode')}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
