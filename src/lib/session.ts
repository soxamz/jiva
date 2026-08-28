import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import type { users } from "@/db/schema";

const sessionCookieName = "jiva_session";
const emergencyPreviewCookieName = "jiva_break_glass_preview";

export type UserRole = typeof users.$inferSelect.role;

export type SessionPayload = {
  userId: string;
  role: UserRole;
};

export type EmergencyPreviewPayload = {
  patientId: string;
  method: "biometric" | "qr";
};

function getEncodedSecret() {
  const secret =
    process.env.SESSION_SECRET?.trim().replace(/^['"]|['"]$/g, "") ??
    "jivahq-demo-session-secret-change-me-before-production";

  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getEncodedSecret());

  const cookieStore = await cookies();

  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}

export async function readSession() {
  const token = (await cookies()).get(sessionCookieName)?.value;

  return readSessionToken(token);
}

async function readSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify<SessionPayload>(
      token,
      getEncodedSecret(),
      {
        algorithms: ["HS256"],
      },
    );

    if (!payload.userId || !payload.role) {
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function readSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${sessionCookieName}=`))
    ?.slice(sessionCookieName.length + 1);

  return readSessionToken(token);
}

export async function clearSession() {
  (await cookies()).delete(sessionCookieName);
}

export async function createEmergencyPreview(payload: EmergencyPreviewPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getEncodedSecret());

  (await cookies()).set(emergencyPreviewCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });
}

export async function readEmergencyPreview() {
  const token = (await cookies()).get(emergencyPreviewCookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify<EmergencyPreviewPayload>(
      token,
      getEncodedSecret(),
      {
        algorithms: ["HS256"],
      },
    );

    if (
      !payload.patientId ||
      (payload.method !== "biometric" && payload.method !== "qr")
    ) {
      return null;
    }

    return {
      patientId: payload.patientId,
      method: payload.method,
    };
  } catch {
    return null;
  }
}
