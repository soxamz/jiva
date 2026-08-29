"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { StethoscopeIcon, UserIcon, ShieldCheckIcon, AlertCircleIcon, KeyRoundIcon, ArrowRightIcon, LockIcon } from "lucide-react";

import { signInAction, type FormState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";
import { demoCredentials } from "@/lib/demo-credentials";

type SignInFormProps = React.ComponentProps<"form"> & {
  returnTo?: string;
  expectedRole?: "patient" | "doctor";
  defaultIdentifier?: string;
  defaultOtp?: string;
};

export function SignInForm({
  className,
  returnTo,
  expectedRole: initialExpectedRole = "patient",
  defaultIdentifier,
  defaultOtp,
  ...props
}: SignInFormProps) {
  const { t } = useI18n();
  const [role, setRole] = useState<"patient" | "doctor">(initialExpectedRole ?? "patient");
  const [state, action, pending] = useActionState<FormState, FormData>(
    signInAction,
    undefined,
  );

  const isDoctor = role === "doctor";

  // Pre-fill values based on role if defaultIdentifier not explicitly passed
  const activeIdentifier =
    defaultIdentifier ??
    (isDoctor
      ? demoCredentials.doctor.identifier
      : demoCredentials.patient.identifier);

  const activeOtp =
    defaultOtp ??
    (isDoctor
      ? demoCredentials.doctor.otp
      : demoCredentials.patient.otp);

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Role Toggle Tabs */}
      <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
        <button
          type="button"
          onClick={() => setRole("patient")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all",
            !isDoctor
              ? "bg-[#0D5F5A] text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <UserIcon className="size-3.5" />
          <span>Patient Portal</span>
        </button>
        <button
          type="button"
          onClick={() => setRole("doctor")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all",
            isDoctor
              ? "bg-[#0D5F5A] text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <StethoscopeIcon className="size-3.5" />
          <span>Doctor Portal</span>
        </button>
      </div>

      <form
        action={action}
        className={cn("flex w-full flex-col gap-4", className)}
        {...props}
      >
        {returnTo ? (
          <input type="hidden" name="returnTo" value={returnTo} />
        ) : null}
        <input type="hidden" name="expectedRole" value={role} />

        {/* Portal Header */}
        <div className="text-center flex flex-col items-center gap-2 pt-1">
          {isDoctor ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-[#0D5F5A] text-[11px] font-extrabold">
              <ShieldCheckIcon className="size-3.5 text-[#0D5F5A]" />
              <span>Verified Physician Access</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-[#0D5F5A] text-[11px] font-extrabold">
              <LockIcon className="size-3.5 text-[#0D5F5A]" />
              <span>Personal Health Vault</span>
            </div>
          )}

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {isDoctor ? "Doctor Portal Sign In" : "Patient Portal Sign In"}
          </h1>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-medium">
            {isDoctor
              ? "Access consent-shared patient vaults, clinical summaries, and digital prescriptions."
              : "Access your lifetime medical records, emergency card, and Arohi AI assistant."}
          </p>
        </div>

        {/* Demo Credentials Alert Chip */}
        <div className="bg-teal-50/60 border border-teal-200/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-600">
          <KeyRoundIcon className="size-4 text-[#0D5F5A] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="font-bold text-slate-900 block leading-tight">
              {isDoctor ? "Doctor Demo Account" : "Patient Demo Account"}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Mobile: <strong className="font-mono text-slate-800">{activeIdentifier}</strong> • OTP: <strong className="font-mono text-slate-800">{activeOtp}</strong>
            </span>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="identifier" className="text-xs font-bold text-slate-800">
              {isDoctor ? "Doctor Mobile Number or HPR ID" : "Mobile Number or ABHA ID"}
            </label>
            <Input
              id="identifier"
              name="identifier"
              inputMode="numeric"
              defaultValue={activeIdentifier}
              key={`identifier-${role}`}
              aria-describedby="identifier-error"
              aria-invalid={Boolean(state?.errors?.identifier)}
              pattern="[0-9]{10}|[0-9]{12}"
              required
              className="text-base sm:text-sm h-11 rounded-xl border-slate-200 focus-visible:ring-[#0D5F5A]"
            />
            {state?.errors?.identifier && (
              <p id="identifier-error" className="text-xs text-red-600 font-medium">
                {state.errors.identifier.join(", ")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="otp" className="text-xs font-bold text-slate-800">
              {t("auth.otp")}
            </label>
            <Input
              aria-invalid={Boolean(state?.errors?.otp)}
              defaultValue={activeOtp}
              key={`otp-${role}`}
              id="otp"
              inputMode="numeric"
              name="otp"
              pattern="[0-9]{6}"
              required
              className="text-base sm:text-sm h-11 rounded-xl border-slate-200 focus-visible:ring-[#0D5F5A]"
            />
            {state?.errors?.otp && (
              <p className="text-xs text-red-600 font-medium">
                {state.errors.otp.join(", ")}
              </p>
            )}
          </div>
        </div>

        {state?.message && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertCircleIcon className="size-4 shrink-0" />
            <span>{state.message}</span>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={pending}
          className="w-full h-11 rounded-xl text-xs font-extrabold transition-all mt-1 bg-[#0D5F5A] hover:bg-[#0b524e] text-white shadow-sm"
        >
          {pending ? (
            <span>{t("auth.verifying")}</span>
          ) : (
            <span className="flex items-center justify-center gap-1.5">
              <span>{isDoctor ? "Sign In to Doctor Dashboard" : "Sign In to Patient Vault"}</span>
              <ArrowRightIcon className="size-3.5" />
            </span>
          )}
        </Button>

        {/* Bottom Helper Links */}
        <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
          <p>
            {t("auth.needAccount")}{" "}
            <Link href="/sign-up" className="font-bold text-[#0D5F5A] hover:underline">
              {t("auth.createAccount")}
            </Link>
          </p>
          <p>
            Emergency responder?{" "}
            <Link href="/emergency" className="font-bold text-red-600 hover:underline">
              {t("auth.useBreakGlass")}
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
