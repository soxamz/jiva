'use client';

import { useActionState } from 'react';

import { uploadDocumentAction, type FormState } from '@/lib/actions';
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
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/components/i18n-provider';

const documentTypes = [
  ['lab', 'Lab report'],
  ['rx', 'Prescription'],
  ['discharge', 'Discharge summary'],
  ['note', 'Clinical note'],
  ['other', 'Other'],
] as const;

export function DocumentUploadForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(
    uploadDocumentAction,
    undefined
  );
  const titleError = state?.errors?.title;
  const typeError = state?.errors?.docType;
  const fileError = state?.errors?.file;
  const notesError = state?.errors?.notes;

  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={Boolean(titleError)}>
          <FieldLabel htmlFor="title">{t('documents.document')}</FieldLabel>
          <Input
            aria-invalid={Boolean(titleError)}
            id="title"
            maxLength={120}
            name="title"
            placeholder="CBC report"
            required
          />
          <FieldError errors={titleError?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(typeError)}>
          <FieldLabel htmlFor="docType">{t('documents.documentType')}</FieldLabel>
          <Select defaultValue="lab" name="docType">
            <SelectTrigger aria-invalid={Boolean(typeError)} className="w-full" id="docType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {documentTypes.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError errors={typeError?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(fileError)}>
          <FieldLabel htmlFor="file">{t('documents.file')}</FieldLabel>
          <Input
            accept=".pdf,.jpg,.jpeg,.png"
            aria-invalid={Boolean(fileError)}
            id="file"
            name="file"
            required
            type="file"
          />
          <FieldError errors={fileError?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(notesError)}>
          <FieldLabel htmlFor="notes">{t('documents.notes')}</FieldLabel>
          <Textarea
            aria-invalid={Boolean(notesError)}
            id="notes"
            maxLength={1000}
            name="notes"
            placeholder="Optional context for the doctor"
          />
          <FieldError errors={notesError?.map((message) => ({ message }))} />
        </Field>
        {state?.message ? (
          <p className="text-destructive text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
        <Field>
          <Button disabled={pending} type="submit">
            {pending ? t('documents.uploading') : t('documents.add')}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
