import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Envoi d'e-mail automatique via Resend (https://resend.com).
// Aucun Cloud Function requis : appel direct de l'API REST Resend depuis cette
// route Next.js (exécutée côté serveur sur Vercel).
//
// Variables d'environnement nécessaires (à définir sur Vercel et en local) :
//   RESEND_API_KEY  → clé API du compte Resend (commence par "re_")
//   RESEND_FROM     → expéditeur vérifié, ex. "Laboratoire <labo@mon-domaine.com>"
//                     (pour tester sans domaine : "Laboratoire <onboarding@resend.dev>")

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Validation minimale d'une adresse e-mail.
function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Gabarit HTML du message envoyé au patient.
function buildEmailHtml(prenom: string, examenLabel: string, lien: string): string {
  const p = escapeHtml(prenom);
  const l = escapeHtml(examenLabel);
  const href = escapeHtml(lien);
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e2e8f0;">
        <h1 style="font-size:18px;margin:0 0 12px;">Bonjour ${p},</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#334155;">
          Votre résultat d'analyse (<strong>${l}</strong>) est disponible.
          Vous pouvez le consulter en ligne en toute sécurité&nbsp;:
        </p>
        <p style="text-align:center;margin:0 0 20px;">
          <a href="${href}"
             style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;
                    font-weight:bold;font-size:15px;padding:12px 22px;border-radius:10px;">
            Consulter mon résultat
          </a>
        </p>
        <p style="font-size:12px;line-height:1.5;color:#94a3b8;margin:0;word-break:break-all;">
          Si le bouton ne fonctionne pas, copiez ce lien&nbsp;:<br/>${href}
        </p>
      </div>
    </div>
  </body>
</html>`;
}

// POST { to, prenom, examenLabel, lien } → envoie l'e-mail au patient.
// Réservé aux utilisateurs authentifiés (cookie de session signé).
export async function POST(request: NextRequest) {
  // 1. Authentifier l'appelant (personnel connecté uniquement).
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const session = sessionCookie ? await verifySession(sessionCookie) : null;
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Vérifier la configuration serveur.
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return NextResponse.json(
      { error: "Service e-mail non configuré (RESEND_API_KEY / RESEND_FROM)." },
      { status: 503 },
    );
  }

  // 3. Lire et valider la requête.
  let body: {
    to?: unknown;
    prenom?: unknown;
    examenLabel?: unknown;
    lien?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const { to, prenom, examenLabel, lien } = body;
  if (!isEmail(to)) {
    return NextResponse.json(
      { error: "Adresse e-mail invalide" },
      { status: 400 },
    );
  }
  if (typeof lien !== "string" || !lien) {
    return NextResponse.json({ error: "Lien manquant" }, { status: 400 });
  }
  const prenomSafe = typeof prenom === "string" && prenom ? prenom : "patient";
  const labelSafe =
    typeof examenLabel === "string" && examenLabel
      ? examenLabel
      : "vos résultats";

  // 4. Appeler l'API Resend.
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Résultat d'analyse - ${labelSafe}`,
        html: buildEmailHtml(prenomSafe, labelSafe, lien),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Resend a renvoyé une erreur :", res.status, detail);
      // On remonte le message de Resend : la route est réservée au personnel
      // authentifié, et ce détail est indispensable pour diagnostiquer
      // (domaine non vérifié, expéditeur refusé, clé invalide, etc.).
      let reason = detail;
      try {
        reason = JSON.parse(detail)?.message ?? detail;
      } catch {
        /* detail n'est pas du JSON, on le garde tel quel */
      }
      return NextResponse.json(
        { error: `Resend a refusé l'envoi : ${reason || res.status}` },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("Échec de l'appel à Resend :", err);
    return NextResponse.json(
      { error: "Impossible de joindre le service e-mail." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
