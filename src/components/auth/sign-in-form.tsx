"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction, type FormState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";

type SignInFormProps = React.ComponentProps<"form"> & {
  returnTo?: string;
  expectedRole?: "patient" | "doctor";
  defaultIdentifier?: string;
  defaultOtp?: string;
};

export function SignInForm({
  className,
  returnTo,
  expectedRole,
  defaultIdentifier = "9876543210",
  defaultOtp = "123456",
  ...props
}: SignInFormProps) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(
    signInAction,
    undefined,
  );

  return (
    <form
      action={action}
      className={cn("flex w-full flex-col gap-4", className)}
      {...props}
    >
      {returnTo ? (
        <input type="hidden" name="returnTo" value={returnTo} />
      ) : null}
      {expectedRole ? (
        <input type="hidden" name="expectedRole" value={expectedRole} />
      ) : null}
      <FieldGroup>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("auth.signInTitle")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("auth.signInDescription")}
          </p>
        </div>
        <Field data-invalid={Boolean(state?.errors?.identifier)}>
          <FieldLabel htmlFor="identifier">{t("auth.identifier")}</FieldLabel>
          <Input
            id="identifier"
            name="identifier"
            inputMode="numeric"
            defaultValue={defaultIdentifier}
            aria-describedby="identifier-error"
            aria-invalid={Boolean(state?.errors?.identifier)}
            pattern="[0-9]{10}|[0-9]{12}"
            required
          />
          <FieldError
            id="identifier-error"
            errors={state?.errors?.identifier?.map((message) => ({ message }))}
          />
        </Field>
        <Field data-invalid={Boolean(state?.errors?.otp)}>
          <FieldLabel htmlFor="otp">{t("auth.otp")}</FieldLabel>
          <Input
            aria-invalid={Boolean(state?.errors?.otp)}
            defaultValue={defaultOtp}
            id="otp"
            inputMode="numeric"
            name="otp"
            pattern="[0-9]{6}"
            required
          />
          <FieldError
            errors={state?.errors?.otp?.map((message) => ({ message }))}
          />
        </Field>
        {state?.message && <FieldError>{state.message}</FieldError>}
        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? t("auth.verifying") : t("auth.verify")}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          {t("auth.needAccount")}{" "}
          <Link href="/sign-up">{t("auth.createAccount")}</Link>
          <br />
          {t("auth.responder")}{" "}
          <Link href="/emergency">{t("auth.useBreakGlass")}</Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
