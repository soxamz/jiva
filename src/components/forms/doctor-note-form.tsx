'use client';

import { useActionState } from 'react';

import { addDoctorNoteAction, type FormState } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/components/i18n-provider';

export function DoctorNoteForm({ code }: { code: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(
    addDoctorNoteAction,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input name="code" type="hidden" value={code} />
      <FieldGroup>
        <Field data-invalid={Boolean(state?.errors?.title)}>
          <FieldLabel htmlFor="title">{t('documents.document')}</FieldLabel>
          <Input
            aria-invalid={Boolean(state?.errors?.title)}
            defaultValue="Consultation note"
            id="title"
            maxLength={120}
            name="title"
            required
          />
          <FieldError errors={state?.errors?.title?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(state?.errors?.note)}>
          <FieldLabel htmlFor="note">{t('doctor.clinicalNote')}</FieldLabel>
          <Textarea
            aria-invalid={Boolean(state?.errors?.note)}
            defaultValue="Reviewed uploaded timeline. Continue current medications and follow up in 2 weeks."
            id="note"
            maxLength={5000}
            name="note"
            required
          />
          <FieldError errors={state?.errors?.note?.map((message) => ({ message }))} />
        </Field>
        {state?.message && <FieldError>{state.message}</FieldError>}
        <Field>
          <Button disabled={pending} type="submit">
            {t('doctor.saveNote')}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
