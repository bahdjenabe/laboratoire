import { jsPDF } from "jspdf";
import type { Paiement, Patient } from "@/types";

// Une ligne du reçu = un examen facturé (nom + montant).
export interface LigneRecu {
  nom: string;
  montant: number;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return null;
}

function formatDate(value: unknown): string {
  const d = toDate(value) ?? new Date();
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const formatGNF = (n: number) =>
  // Normalise les separateurs de milliers fr-FR (espace fine insecable U+202F)
  // en espace ASCII, que les polices standard de jsPDF affichent correctement.
  `${new Intl.NumberFormat("fr-FR").format(n).replace(/\s/g, " ")} GNF`;

// Palette (RGB)
const EMERALD: [number, number, number] = [5, 150, 105];
const EMERALD_LIGHT: [number, number, number] = [209, 250, 229];
const EMERALD_DARK: [number, number, number] = [4, 120, 87];
const DARK: [number, number, number] = [15, 23, 42];
const GRAY: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [248, 250, 252];
const BORDER: [number, number, number] = [226, 232, 240];
const RED_LIGHT: [number, number, number] = [254, 226, 226];
const RED_DARK: [number, number, number] = [185, 28, 28];
const INK: [number, number, number] = [30, 58, 138]; // bleu encre signature

/** Tronque un texte pour qu'il tienne sur une seule ligne de largeur maxW. */
function fitOneLine(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + "…") > maxW) {
    t = t.slice(0, -1);
  }
  return t.replace(/\s+$/, "") + "…";
}

/** Dessine un cachet rond « par défaut » du laboratoire. */
function drawCachet(doc: jsPDF, cx: number, cy: number, r: number): void {
  doc.setDrawColor(...EMERALD_DARK);
  doc.setLineWidth(0.8);
  doc.circle(cx, cy, r, "S");
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, r - 2.2, "S");
  doc.setLineWidth(0.2);

  doc.setTextColor(...EMERALD_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5);
  doc.text("LABMÉDICAL", cx, cy - r + 4.2, { align: "center" });
  doc.text("CONAKRY • GUINÉE", cx, cy + r - 2.6, { align: "center" });
  doc.setFontSize(11);
  doc.text("LM", cx, cy + 1.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.5);
  doc.text("PAYÉ", cx, cy + 5.2, { align: "center" });
}

/** Dessine une signature manuscrite « par défaut » (tracé vectoriel). */
function drawSignature(doc: jsPDF, x: number, y: number): void {
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.lines(
    [
      [3, -5, 5, 4, 7, -3],
      [2, 5, 5, -7, 7, 2],
      [3, 4, 6, -5, 10, 1],
      [4, 2, 5, -3, 8, 0],
    ],
    x,
    y,
    [1, 1],
    "S",
  );
  doc.setLineWidth(0.2);
}

/**
 * Génère et télécharge le reçu PDF d'un paiement (une ou plusieurs lignes,
 * pour encaisser tous les examens d'une commande en un seul reçu).
 * `paiement` fournit les métadonnées (n°, date, mode, statut, référence).
 */
export function generateRecu(
  paiement: Paiement,
  patient: Patient,
  lignes: LigneRecu[],
): void {
  const total = lignes.reduce((s, l) => s + (l.montant || 0), 0);
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const contentW = pageW - marginX * 2;
  doc.setLineWidth(0.2);

  // ── Bandeau d'en-tête ─────────────────────────────
  doc.setFillColor(...EMERALD);
  doc.rect(0, 0, pageW, 34, "F");

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginX, 9, 16, 16, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...EMERALD);
  doc.text("LM", marginX + 8, 19.5, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("LabMédical", marginX + 23, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...EMERALD_LIGHT);
  doc.text("Laboratoire d'analyses médicales", marginX + 23, 22);
  doc.text("Conakry, Guinée  |  Tél : +224 600 00 00 00", marginX + 23, 27);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("REÇU DE PAIEMENT", pageW - marginX, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...EMERALD_LIGHT);
  doc.text(
    `N° ${String(paiement.id).slice(0, 8).toUpperCase()}`,
    pageW - marginX,
    22,
    { align: "right" },
  );
  doc.text(`Date : ${formatDate(paiement.createdAt)}`, pageW - marginX, 27, {
    align: "right",
  });

  let y = 46;

  // ── Carte client ──────────────────────────────────
  const cardH = 22;
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(marginX, y, contentW, cardH, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...EMERALD);
  doc.text("REÇU DE", marginX + 5, y + 7);

  // Téléphone (à droite) — mesuré d'abord pour borner le nom à gauche
  const telStr = `Tél : ${patient.telephone || "—"}`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(telStr, pageW - marginX - 5, y + 15, { align: "right" });
  const telW = doc.getTextWidth(telStr);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  const nameMaxW = contentW - 10 - telW - 6;
  doc.text(
    fitOneLine(doc, `${patient.prenom} ${patient.nom}`, nameMaxW),
    marginX + 5,
    y + 15,
  );
  y += cardH + 12;

  // ── Tableau détail ────────────────────────────────
  const rowH = 9;
  const tableTop = y;
  doc.setFillColor(...EMERALD);
  doc.rect(marginX, y, contentW, rowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("DÉSIGNATION", marginX + 4, y + 6);
  doc.text("MONTANT", pageW - marginX - 4, y + 6, { align: "right" });
  y += rowH;

  const designations: LigneRecu[] = lignes.length
    ? lignes
    : [{ nom: "Prestation de laboratoire", montant: total }];

  designations.forEach((ligne, i) => {
    // Bande alternée pour distinguer les examens d'une même commande.
    if (i % 2 === 1) {
      doc.setFillColor(...LIGHT);
      doc.rect(marginX, y, contentW, rowH, "F");
    }
    // Montant (à droite) — mesuré d'abord pour borner la désignation.
    const montantStr = formatGNF(ligne.montant);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(montantStr, pageW - marginX - 4, y + 6, { align: "right" });
    const montantW = doc.getTextWidth(montantStr);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const desigMaxW = contentW - 8 - montantW - 6;
    doc.text(fitOneLine(doc, ligne.nom, desigMaxW), marginX + 4, y + 6);
    y += rowH;
  });

  doc.setDrawColor(...BORDER);
  doc.rect(marginX, tableTop, contentW, y - tableTop);
  y += 10;

  // ── Encadré Total ─────────────────────────────────
  const totalH = 14;
  doc.setFillColor(...EMERALD_LIGHT);
  doc.roundedRect(marginX, y, contentW, totalH, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...EMERALD_DARK);
  doc.text("TOTAL", marginX + 5, y + 9);
  doc.setFontSize(14);
  doc.text(formatGNF(total), pageW - marginX - 5, y + 9.5, {
    align: "right",
  });
  y += totalH + 14;

  // ── Mode + statut ─────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const modeLabel = `${paiement.modePaiement || "—"}${
    paiement.detailPaiement ? ` — ${paiement.detailPaiement}` : ""
  }`;
  doc.text(`Mode de paiement : ${modeLabel}`, marginX, y + 6);
  if (paiement.referencePaiement) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(`Réf. transaction : ${paiement.referencePaiement}`, marginX, y + 12);
    doc.setFontSize(10);
  }

  const badgeW = 36;
  const badgeX = pageW - marginX - badgeW;
  if (paiement.statut === "paye") {
    doc.setFillColor(...EMERALD_LIGHT);
    doc.roundedRect(badgeX, y, badgeW, 10, 2.5, 2.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...EMERALD_DARK);
    doc.text("PAYÉ", badgeX + badgeW / 2, y + 6.5, { align: "center" });
  } else {
    doc.setFillColor(...RED_LIGHT);
    doc.roundedRect(badgeX, y, badgeW, 10, 2.5, 2.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...RED_DARK);
    doc.text("NON PAYÉ", badgeX + badgeW / 2, y + 6.5, { align: "center" });
  }
  y += 28;

  // ── Zone signature + cachet (par défaut) ──────────
  const sigBaseY = y + 8;
  const sigX = pageW - marginX - 60;

  // Cachet rond, légèrement à gauche de la signature
  drawCachet(doc, sigX + 4, sigBaseY - 7, 12);

  // Signature manuscrite au-dessus du trait
  drawSignature(doc, sigX + 24, sigBaseY - 6);

  doc.setDrawColor(...GRAY);
  doc.line(sigX, sigBaseY, pageW - marginX, sigBaseY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Signature et cachet", sigX, sigBaseY + 5);

  // ── Pied de page ──────────────────────────────────
  doc.setDrawColor(...BORDER);
  doc.line(marginX, pageH - 18, pageW - marginX, pageH - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Merci de votre confiance  -  LabMédical", pageW / 2, pageH - 12, {
    align: "center",
  });

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`recu-${safe(patient.nom)}-${paiement.id.slice(0, 6)}.pdf`);
}
