import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  FIREBASE_PROJECT_ID,
  signSession,
} from "@/lib/session";
import type { Role } from "@/types";

// Clés publiques Google pour vérifier la signature des jetons Firebase.
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

function isRole(value: unknown): value is Role {
  return value === "admin" || value === "medecin" || value === "technicien";
}

// Rôle = source de vérité côté Firestore (jamais une valeur fournie par le
// client). Lecture via l'API REST avec le jeton de l'utilisateur (règle :
// lecture autorisée si authentifié).
async function readRole(uid: string, idToken: string): Promise<Role | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const role = data?.fields?.role?.stringValue;
  return isRole(role) ? role : null;
}

// POST { idToken } → vérifie le jeton Firebase puis pose le cookie de session.
export async function POST(request: NextRequest) {
  let idToken: string | undefined;
  try {
    idToken = (await request.json())?.idToken;
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (!idToken) {
    return NextResponse.json({ error: "Jeton manquant" }, { status: 400 });
  }

  // 1. Vérifier le jeton Firebase (signature, émetteur, audience).
  let uid: string;
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    if (typeof payload.sub !== "string") throw new Error("sub manquant");
    uid = payload.sub;
  } catch {
    return NextResponse.json({ error: "Jeton invalide" }, { status: 401 });
  }

  // 2. Récupérer le rôle (source de vérité Firestore).
  const role = await readRole(uid, idToken);
  if (!role) {
    return NextResponse.json({ error: "Compte sans rôle" }, { status: 403 });
  }

  // 3. Poser un cookie de session signé, httpOnly.
  let token: string;
  try {
    token = await signSession({ uid, role });
  } catch {
    return NextResponse.json(
      { error: "Configuration serveur incomplète" },
      { status: 500 },
    );
  }
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

// DELETE → efface le cookie de session (déconnexion).
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
