import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

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
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl items-center px-4 py-10">
        <Card className="w-full rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t("share.doctorRequiredTitle")}</CardTitle>
            <CardDescription>
              {t("share.doctorRequiredDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              className={buttonVariants()}
              href={viewer.role === "patient" ? "/dashboard" : "/emergency"}
            >
              {t("nav.dashboard")}
            </Link>
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
