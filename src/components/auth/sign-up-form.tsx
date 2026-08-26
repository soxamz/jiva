'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { signUpAction, type FormState } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useI18n } from '@/components/i18n-provider';

export function SignUpForm({ className, ...props }: React.ComponentProps<'form'>) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, undefined);

  return (
    <form action={action} className={cn('flex w-full flex-col gap-4', className)} {...props}>
      <FieldGroup>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t('auth.signUpTitle')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('auth.signUpDescription')}</p>
        </div>
        <Field>
          <FieldLabel htmlFor="name">{t('auth.name')}</FieldLabel>
          <Input id="name" name="name" placeholder="Aarav Sharma" required />
          <FieldError errors={state?.errors?.name?.map((message) => ({ message }))} />
        </Field>
        <Field>
          <FieldLabel htmlFor="phone">{t('auth.mobile')}</FieldLabel>
          <Input
            id="phone"
            name="phone"
            inputMode="numeric"
            placeholder="10-digit phone"
            required
          />
          <FieldError errors={state?.errors?.phone?.map((message) => ({ message }))} />
        </Field>
        <Field>
          <FieldLabel htmlFor="aadhaar">{t('auth.aadhaar')}</FieldLabel>
          <Input id="aadhaar" name="aadhaar" inputMode="numeric" placeholder="Optional for demo" />
          <FieldError errors={state?.errors?.aadhaar?.map((message) => ({ message }))} />
        </Field>
        <Field>
          <FieldLabel htmlFor="role">{t('auth.role')}</FieldLabel>
          <Select id="role" name="role" defaultValue="patient">
            <option value="patient">{t('auth.patient')}</option>
            <option value="doctor">{t('auth.doctor')}</option>
            <option value="responder">{t('auth.emergencyResponder')}</option>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="otp">{t('auth.demoOtp')}</FieldLabel>
          <Input id="otp" name="otp" inputMode="numeric" defaultValue="123456" required />
          <FieldError errors={state?.errors?.otp?.map((message) => ({ message }))} />
        </Field>
        {state?.message && <FieldError>{state.message}</FieldError>}
        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? t('auth.creating') : t('auth.create')}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          {t('auth.alreadyRegistered')} <Link href="/sign-in">{t('auth.signIn')}</Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
