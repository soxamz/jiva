'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { signUpAction, type FormState } from '@/lib/actions';
import { cn } from '@/lib/utils';
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
        <Field data-invalid={Boolean(state?.errors?.name)}>
          <FieldLabel htmlFor="name">{t('auth.name')}</FieldLabel>
          <Input
            aria-invalid={Boolean(state?.errors?.name)}
            id="name"
            minLength={2}
            name="name"
            placeholder="Aarav Sharma"
            required
          />
          <FieldError errors={state?.errors?.name?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(state?.errors?.phone)}>
          <FieldLabel htmlFor="phone">{t('auth.mobile')}</FieldLabel>
          <Input
            aria-invalid={Boolean(state?.errors?.phone)}
            id="phone"
            name="phone"
            inputMode="numeric"
            pattern="[0-9]{10}"
            placeholder="10-digit phone"
            required
          />
          <FieldError errors={state?.errors?.phone?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(state?.errors?.aadhaar)}>
          <FieldLabel htmlFor="aadhaar">{t('auth.aadhaar')}</FieldLabel>
          <Input
            aria-invalid={Boolean(state?.errors?.aadhaar)}
            id="aadhaar"
            inputMode="numeric"
            name="aadhaar"
            pattern="[0-9]{12}"
            placeholder="Optional for demo"
          />
          <FieldError errors={state?.errors?.aadhaar?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(state?.errors?.role)}>
          <FieldLabel htmlFor="role">{t('auth.role')}</FieldLabel>
          <Select defaultValue="patient" name="role">
            <SelectTrigger aria-invalid={Boolean(state?.errors?.role)} className="w-full" id="role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="patient">{t('auth.patient')}</SelectItem>
                <SelectItem value="doctor">{t('auth.doctor')}</SelectItem>
                <SelectItem value="responder">{t('auth.emergencyResponder')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError errors={state?.errors?.role?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(state?.errors?.otp)}>
          <FieldLabel htmlFor="otp">{t('auth.demoOtp')}</FieldLabel>
          <Input
            aria-invalid={Boolean(state?.errors?.otp)}
            defaultValue="123456"
            id="otp"
            inputMode="numeric"
            name="otp"
            pattern="[0-9]{6}"
            required
          />
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
