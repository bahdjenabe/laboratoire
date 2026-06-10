import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/types";

// Cookie de session signé (JWT HS256) posé par /api/session et vérifié par le
// middleware. Remplace l'ancien cookie JSON en clair, qui était falsifiable.
export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours
export const FIREBASE_PROJECT_ID = "laboratoire-f8e84";

export interface SessionPayload {
  uid: string;
  role: Role;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Fail-closed : sans secret, aucune session valide (connexion impossible).
    throw new Error("SESSION_SECRET manquant (variable d'environnement).");
  }
  return new TextEncoder().encode(secret);
}

function isRole(value: unknown): value is Role {
  return value === "admin" || value === "medecin" || value === "technicien";
}

// Signe un cookie de session (durée 7 jours).
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ uid: payload.uid, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

// Vérifie un cookie de session ; renvoie le payload ou null (invalide/expiré).
export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.uid !== "string" || !isRole(payload.role)) return null;
    return { uid: payload.uid, role: payload.role };
  } catch {
    return null;
  }
}
