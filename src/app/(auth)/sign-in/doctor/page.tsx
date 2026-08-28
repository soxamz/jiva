import { SignInForm } from "@/components/auth/sign-in-form";
import { demoCredentials } from "@/lib/demo-credentials";

export default async function DoctorSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const returnTo = typeof next === "string" ? next : undefined;

  return (
    <SignInForm
      defaultIdentifier={demoCredentials.doctor.identifier}
      defaultOtp={demoCredentials.doctor.otp}
      expectedRole="doctor"
      returnTo={returnTo}
    />
  );
}
