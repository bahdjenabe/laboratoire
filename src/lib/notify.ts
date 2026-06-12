// Construction des liens de notification (WhatsApp / SMS / Email).
//
// Approche sans backend : on ouvre l'application du destinataire avec le
// message pré-rempli (lien wa.me, protocole sms:, mailto:). Aucun identifiant
// requis. Pour un envoi 100 % automatique, il faudrait un backend + Twilio
// (SMS), l'API WhatsApp Business et un serveur SMTP (email).

const INDICATIF_DEFAUT = "224"; // Guinée

// Normalise un numéro pour wa.me : chiffres uniquement, avec indicatif pays.
export function sanitizePhone(tel: string): string {
  let d = (tel || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  // Numéro local (sans indicatif) → on préfixe l'indicatif par défaut.
  if (d.length > 0 && d.length <= 9) d = INDICATIF_DEFAUT + d;
  return d;
}

export function buildMessage(
  prenom: string,
  examenNom: string,
  lien: string,
): string {
  return (
    `Bonjour ${prenom}, ` +
    `votre résultat d'analyse (${examenNom}) est disponible. ` +
    `Consultez-le en ligne en toute sécurité : ${lien}`
  );
}

// Message « commande » : un seul lien regroupant tous les examens validés.
export function buildMessageCommande(
  prenom: string,
  nb: number,
  lien: string,
): string {
  return (
    `Bonjour ${prenom}, vos ${nb} résultats d'analyse sont disponibles. ` +
    `Consultez-les en ligne en toute sécurité : ${lien}`
  );
}

export function whatsappUrl(tel: string, message: string): string {
  return `https://wa.me/${sanitizePhone(tel)}?text=${encodeURIComponent(message)}`;
}

export function smsUrl(tel: string, message: string): string {
  const num = (tel || "").replace(/\s/g, "");
  return `sms:${num}?body=${encodeURIComponent(message)}`;
}

export function emailUrl(
  email: string,
  examenNom: string,
  message: string,
): string {
  const subject = `Résultat d'analyse - ${examenNom}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}

// Envoi automatique de l'e-mail via l'API serveur (Resend). Contrairement à
// emailUrl (qui ouvre le client mail du personnel), ceci envoie réellement le
// message au patient. Renvoie { ok } ou lève une Error avec un message lisible.
export async function sendResultEmail(params: {
  to: string;
  prenom: string;
  examenLabel: string;
  lien: string;
}): Promise<void> {
  const res = await fetch("/api/notify/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "L'envoi de l'e-mail a échoué.");
  }
}
