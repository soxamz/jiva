"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangleIcon,
  CameraIcon,
  FingerprintIcon,
  QrCodeIcon,
  ScanFaceIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type GatewayOptionProps = {
  action: React.ReactNode;
  children?: React.ReactNode;
  description: string;
  highlighted?: boolean;
  icon: React.ReactNode;
  status: string;
  title: string;
};

function GatewayOption({
  action,
  children,
  description,
  highlighted = false,
  icon,
  status,
  title,
}: GatewayOptionProps) {
  return (
    <Card
      className={`flex min-h-[24rem] flex-col rounded-2xl border-border/80 shadow-sm ${
        highlighted
          ? "border-primary/35 bg-primary/[0.025] shadow-primary/10"
          : "bg-card"
      }`}
    >
      <CardHeader className="items-center px-5 pt-6 pb-3 text-center sm:px-6">
        <div
          className={`flex size-16 mx-auto items-center justify-center rounded-full border shadow-sm ${
            highlighted
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border bg-muted/50 text-destructive"
          }`}
        >
          {icon}
        </div>
        <div className="space-y-1.5 pt-4">
          <CardTitle className="text-pretty text-lg">{title}</CardTitle>
          <CardDescription className="mx-auto max-w-60 leading-5">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col items-center gap-4 px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
        {children}
        <Badge
          className="bg-muted text-muted-foreground hover:bg-muted"
          variant="secondary"
        >
          <span
            className={`mr-2 size-1.5 rounded-full ${
              highlighted ? "bg-primary" : "bg-muted-foreground/60"
            }`}
          />
          {status}
        </Badge>
        {action}
      </CardContent>
    </Card>
  );
}

export function EmergencyGateway() {
  const [isCardOpen, setIsCardOpen] = useState(false);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-muted/50 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <a
        className="sr-only rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
        href="#emergency-access"
      >
        Skip to emergency access methods
      </a>

      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-5 flex items-center gap-3">
          <div className="min-w-0">
            <p className="type-eyebrow text-muted-foreground">
              JivaHQ protocol
            </p>
            <h1 className="text-pretty text-lg font-semibold tracking-tight sm:text-xl">
              Emergency Access Gateway
            </h1>
          </div>
          <Badge className="ml-auto shrink-0" variant="outline">
            Break-glass mode
          </Badge>
        </header>

        <Card className="gap-0 overflow-hidden rounded-2xl border-border shadow-xl shadow-black/5">
          <div className="flex min-h-9 items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-primary-foreground text-xs font-semibold tracking-wide text-destructive-foreground uppercase">
            Secure Connection Active - Break-Glass Protocol
          </div>

          <CardHeader className="flex-row items-center gap-4 border-b px-5 py-5 sm:px-8">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldCheckIcon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-pretty text-xl text-destructive">
                JivaHQ Health Vault
              </CardTitle>
              <CardDescription>Emergency access gateway</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
            <Alert
              className="border-destructive/25 bg-destructive/5 text-foreground"
              variant="default"
            >
              <AlertTriangleIcon
                className="size-5 text-destructive"
                aria-hidden="true"
              />
              <AlertTitle className="text-destructive">High Alert</AlertTitle>
              <AlertDescription>
                A break-glass request must record a verified identity, a valid
                reason, and an immutable audit event.
              </AlertDescription>
            </Alert>

            <section
              id="emergency-access"
              aria-label="Emergency access methods"
              className="grid gap-5 md:grid-cols-3"
            >
              <GatewayOption
                description="Place the patient's finger on a scanner or use Aadhaar biometric authentication to proceed."
                icon={<FingerprintIcon className="size-8" aria-hidden="true" />}
                status="Ready to verify"
                title="Biometric Verification"
                action={
                  <Link
                    className={buttonVariants({
                      className: "w-full touch-manipulation",
                      variant: "destructive",
                    })}
                    href="/emergency/scan?method=biometric"
                  >
                    Verify Fingerprint
                  </Link>
                }
              />

              <GatewayOption
                description="Align the patient's JivaHQ emergency card or mobile QR code within the frame."
                highlighted
                icon={<QrCodeIcon className="size-8" aria-hidden="true" />}
                status="Ready to scan"
                title="Scan Patient QR Code"
                action={
                  <Button
                    className="w-full touch-manipulation"
                    onClick={() => setIsCardOpen(true)}
                    variant="destructive"
                    type="button"
                  >
                    <CameraIcon className="size-4" aria-hidden="true" />
                    Activate Scanner
                  </Button>
                }
              >
                <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-primary/30 bg-background p-2.5">
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="size-24 object-contain"
                    height={96}
                    priority
                    src="/emergency-qr-scanner.png"
                    width={96}
                  />
                </div>
              </GatewayOption>

              <GatewayOption
                description="Align the patient's face inside the frame for identity verification."
                icon={<ScanFaceIcon className="size-8" aria-hidden="true" />}
                status="Hardware required"
                title="Face Scan Verification"
                action={
                  <Button
                    className="w-full touch-manipulation"
                    disabled
                    type="button"
                    variant="destructive"
                  >
                    Activate Face Scanner
                  </Button>
                }
              />
            </section>

            <p className="text-center text-xs leading-5 text-muted-foreground">
              Camera, Aadhaar, face recognition, and biometric hardware are not
              connected to this prototype.
            </p>
          </CardContent>
        </Card>

        <div className="mt-5 text-center">
          <Link
            className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
          >
            Return Home
          </Link>
        </div>
      </div>

      <Dialog open={isCardOpen} onOpenChange={setIsCardOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl sm:max-w-xl"
          showCloseButton={false}
        >
          <DialogHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldCheckIcon className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle className="text-xl">QR Scan Verified</DialogTitle>
            <DialogDescription>
              The emergency card has been authenticated for temporary
              break-glass access.
            </DialogDescription>
          </DialogHeader>

          <Alert
            className="border-destructive/25 bg-destructive/5"
            variant="default"
          >
            <AlertTriangleIcon
              className="size-4 text-destructive"
              aria-hidden="true"
            />
            <AlertTitle className="text-destructive">
              Authentication Complete
            </AlertTitle>
            <AlertDescription>
              Open the patient&apos;s emergency information and available
              records.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Link
              className={buttonVariants({
                className: "w-full sm:w-auto",
                variant: "destructive",
              })}
              href="/emergency/scan?method=qr"
            >
              View Emergency Information
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
