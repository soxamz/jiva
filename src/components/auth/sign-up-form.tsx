'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { signUpAction, type FormState } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function SignUpForm({ className, ...props }: React.ComponentProps<'form'>) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, undefined);

  return (
    <form action={action} className={cn('flex w-full flex-col gap-4', className)} {...props}>
      <FieldGroup>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create demo account</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Register a patient, doctor, or responder profile for the prototype.
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" name="name" placeholder="Aarav Sharma" required />
          <FieldError errors={state?.errors?.name?.map((message) => ({ message }))} />
        </Field>
        <Field>
          <FieldLabel htmlFor="phone">Mobile number</FieldLabel>
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
          <FieldLabel htmlFor="aadhaar">Aadhaar number</FieldLabel>
          <Input id="aadhaar" name="aadhaar" inputMode="numeric" placeholder="Optional for demo" />
          <FieldError errors={state?.errors?.aadhaar?.map((message) => ({ message }))} />
        </Field>
        <Field>
          <FieldLabel htmlFor="role">Role</FieldLabel>
          <Select id="role" name="role" defaultValue="patient">
            <option value="patient">Patient</option>
            <option value="doctor">Doctor</option>
            <option value="responder">Emergency responder</option>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="otp">Demo OTP</FieldLabel>
          <Input id="otp" name="otp" inputMode="numeric" defaultValue="123456" required />
          <FieldError errors={state?.errors?.otp?.map((message) => ({ message }))} />
        </Field>
        {state?.message && <FieldError>{state.message}</FieldError>}
        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating...' : 'Create account'}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          Already registered? <Link href="/sign-in">Sign in</Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
