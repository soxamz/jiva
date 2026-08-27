'use client';

import { useActionState } from 'react';

import { redeemConsentAction, type FormState } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/components/i18n-provider';

export function DoctorConsentForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(
    redeemConsentAction,
    undefined
  );
  const errorMessage =
    state?.errorCode === 'assigned_to_another_clinician'
      ? t('doctor.accessBoundMessage')
      : state?.errorCode === 'access_unavailable'
        ? t('doctor.accessUnavailableMessage')
        : state?.message;

  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={Boolean(state?.errors?.code)}>
          <FieldLabel htmlFor="code">{t('doctor.consentCode')}</FieldLabel>
          <Input
            id="code"
            name="code"
            className="h-12 font-mono text-lg uppercase tracking-widest"
            defaultValue="JIVA-DEMO"
            aria-describedby="code-error"
            aria-invalid={Boolean(state?.errors?.code)}
            maxLength={24}
            minLength={4}
            required
          />
          <FieldError
            id="code-error"
            errors={state?.errors?.code?.map((message) => ({ message }))}
          />
        </Field>
        {errorMessage && <FieldError>{errorMessage}</FieldError>}
        <Field>
          <Button className="h-11 w-full" type="submit" disabled={pending}>
            {pending ? t('doctor.checkingAccess') : t('doctor.accessSummary')}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
