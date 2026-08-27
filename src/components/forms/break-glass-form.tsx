'use client';

import { useActionState } from 'react';

import { breakGlassAction, type FormState } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/components/i18n-provider';

export function BreakGlassForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(breakGlassAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={Boolean(state?.errors?.identifier)}>
          <FieldLabel htmlFor="identifier">{t('emergency.patientIdentifier')}</FieldLabel>
          <Input
            aria-invalid={Boolean(state?.errors?.identifier)}
            defaultValue="9876543210"
            id="identifier"
            inputMode="numeric"
            name="identifier"
            required
          />
          <FieldError errors={state?.errors?.identifier?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(state?.errors?.reason)}>
          <FieldLabel htmlFor="reason">{t('emergency.reason')}</FieldLabel>
          <Textarea
            aria-invalid={Boolean(state?.errors?.reason)}
            defaultValue="Trauma/unconscious patient"
            id="reason"
            maxLength={500}
            name="reason"
            required
          />
          <FieldError errors={state?.errors?.reason?.map((message) => ({ message }))} />
        </Field>
        {state?.message && <FieldError>{state.message}</FieldError>}
        <Field>
          <Button disabled={pending} type="submit">
            {t('emergency.initiate')}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
