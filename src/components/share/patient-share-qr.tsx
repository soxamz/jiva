"use client";

import { DownloadIcon } from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type PatientShareQrProps = {
  value: string;
  downloadPngLabel: string;
  downloadSvgLabel: string;
  loadingLabel: string;
};

const qrOptions = {
  errorCorrectionLevel: "M" as const,
  margin: 1,
  color: { dark: "#0f172a", light: "#ffffff" },
};

export function PatientShareQr({
  value,
  downloadPngLabel,
  downloadSvgLabel,
  loadingLabel,
}: PatientShareQrProps) {
  const [png, setPng] = useState<string>();
  const [svg, setSvg] = useState<string>();

  useEffect(() => {
    let active = true;

    void Promise.all([
      QRCode.toDataURL(value, { ...qrOptions, width: 720 }),
      QRCode.toString(value, { ...qrOptions, type: "svg", width: 720 }),
    ]).then(([nextPng, nextSvg]) => {
      if (active) {
        setPng(nextPng);
        setSvg(nextSvg);
      }
    });

    return () => {
      active = false;
    };
  }, [value]);

  function downloadPng() {
    if (!png) return;
    const link = document.createElement("a");
    link.href = png;
    link.download = "jivahq-doctor-access.png";
    link.click();
  }

  function downloadSvg() {
    if (!svg) return;
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "jivahq-doctor-access.svg";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!png) {
    return (
      <div className="flex flex-col items-center gap-4" aria-live="polite">
        <Skeleton className="size-56 rounded-xl" />
        <p className="text-muted-foreground text-sm">{loadingLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        <Image
          alt="QR code for doctor record access"
          className="size-56"
          height={224}
          src={png}
          unoptimized
          width={224}
        />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={downloadPng} type="button" variant="outline">
          <DownloadIcon data-icon="inline-start" />
          {downloadPngLabel}
        </Button>
        <Button onClick={downloadSvg} type="button" variant="outline">
          <DownloadIcon data-icon="inline-start" />
          {downloadSvgLabel}
        </Button>
      </div>
    </div>
  );
}
