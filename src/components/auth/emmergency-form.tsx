import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Fingerprint } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '../ui/input-otp';

export function SignInForm({ className, ...props }: React.ComponentProps<'form'>) {
  return (
    <form className={cn('flex flex-col gap-6', className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Secure Clinical Access</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Verify identity via Aadhaar or registered mobile number.
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Aadhaar / Mobile Number</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="Enter 12-digit Aadhaar or 10-digit mobile"
            required
          />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">One-Time Password (OTP)</FieldLabel>
          </div>
          <InputOTP maxLength={6}>
            <InputOTPGroup className="w-full">
              <InputOTPSlot index={0} className="w-full" />
              <InputOTPSlot index={1} className="w-full" />
              <InputOTPSlot index={2} className="w-full" />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup className="w-full">
              <InputOTPSlot index={3} className="w-full" />
              <InputOTPSlot index={4} className="w-full" />
              <InputOTPSlot index={5} className="w-full" />
            </InputOTPGroup>
          </InputOTP>
        </Field>
        <Field>
          <Button type="submit">Verify & Autheticate</Button>
        </Field>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <Alert variant="destructive">
            <AlertTitle>Emergency Break-Glass</AlertTitle>
            <AlertDescription>
              For authorized first responders and ER personnel requiring immediate access to
              critical patient histories during life-threatening events. All access is strictly
              audited.
            </AlertDescription>
          </Alert>
          <Alert>
            <Fingerprint />
            <AlertTitle>Biometric Authentication</AlertTitle>
            <AlertDescription>
              Connect standard USB fingerprint scanner for rapid login.
            </AlertDescription>
          </Alert>
          <Button variant="destructive">Initiate Emergency Access</Button>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{' '}
            <a href="#" className="underline underline-offset-4">
              Sign up
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
