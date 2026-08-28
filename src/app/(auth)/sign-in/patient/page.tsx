import { SignInForm } from "@/components/auth/sign-in-form";
import { demoCredentials } from "@/lib/demo-credentials";

export default function PatientSignInPage() {
  return (
    <SignInForm
      defaultIdentifier={demoCredentials.patient.identifier}
      defaultOtp={demoCredentials.patient.otp}
      expectedRole="patient"
    />
  );
}
