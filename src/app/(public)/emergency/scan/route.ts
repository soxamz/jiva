import { NextResponse } from "next/server";

import { startEmergencyPreview } from "@/lib/dal";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const method = searchParams.get("method");

  if (method !== "biometric" && method !== "qr") {
    return NextResponse.redirect(new URL("/emergency", request.url));
  }

  const patient = await startEmergencyPreview(method);

  return NextResponse.redirect(
    new URL(patient ? "/emergency-information" : "/emergency", request.url),
  );
}
