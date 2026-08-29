import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { StethoscopeIcon, UserCheckIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ConsentAccessError,
  getCurrentUser,
  redeemPatientQrForCurrentDoctor,
} from "@/lib/dal";
import { getI18n } from "@/lib/i18n";

const shareTokenSchema = z.string().uuid();

export default async function ShareScanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!shareTokenSchema.safeParse(token).success) {
    notFound();
  }

  const viewer = await getCurrentUser();
  if (!viewer) {
    redirect(
      `/sign-in/doctor?next=${encodeURIComponent(`/share/scan/${token}`)}`,
    );
  }

  const { t } = await getI18n();
  if (viewer.role !== "doctor") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-4 py-8 sm:py-12">
        <Card className="w-full rounded-[24px] border-slate-200 shadow-xl overflow-hidden bg-white">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#0D5F5A] to-[#083F3C] p-6 text-white text-center flex flex-col items-center gap-3">
            <div className="size-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-teal-200 shadow-inner">
              <StethoscopeIcon className="size-7" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold tracking-[0.2em] text-teal-300 uppercase block">
                JivaHQ Doctor Verification
              </span>
              <h1 className="text-xl font-bold text-white mt-1">
                Doctor Account Required
              </h1>
            </div>
          </div>

          <CardHeader className="text-center pt-6 pb-2">
            <CardTitle className="text-base font-bold text-slate-900">
              {t("share.doctorRequiredTitle")}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              {t("share.doctorRequiredDescription")}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 p-6 pt-2">
            {/* Account Status Pill */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheckIcon className="size-4 text-slate-500 shrink-0" />
                <span className="text-slate-600 font-medium truncate">
                  Signed in as <strong className="text-slate-900 font-bold">{viewer.name}</strong> ({viewer.role})
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 mt-2">
              <Link
                className={buttonVariants({
                  className: "w-full rounded-xl bg-[#0D5F5A] hover:bg-[#0b504c] text-white py-3 text-xs font-bold shadow-sm",
                })}
                href={`/sign-in/doctor?next=${encodeURIComponent(`/share/scan/${token}`)}`}
              >
                Sign In as Doctor
              </Link>

              <Link
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full rounded-xl border-slate-200 py-3 text-xs font-bold text-slate-700",
                })}
                href={viewer.role === "patient" ? "/dashboard" : "/emergency"}
              >
                Return to {viewer.role === "patient" ? "Patient Dashboard" : "Emergency Gateway"}
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  try {
    const code = await redeemPatientQrForCurrentDoctor(token);
    redirect(`/doctor/access/${code}`);
  } catch (error) {
    if (error instanceof ConsentAccessError) {
      notFound();
    }
    throw error;
  }
}
