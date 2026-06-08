import { jsPDF } from "jspdf";
import type { Examen, Paiement, Patient } from "@/types";

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
  `${new Intl.NumberFormat("fr-FR").format(n)} GNF`;

/**
 * Génère et télécharge le reçu PDF d'un paiement.
 */
export function generateRecu(
  paiement: Paiement,
  patient: Patient,
  examen: Examen | null,
): void {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 16;
  const contentW = pageW - marginX * 2;
  let y = 20;

  // ── En-tête ───────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(5, 150, 105);
  doc.text("LabMedical", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Laboratoire d'analyses medicales", marginX, y + 6);
  doc.text("Conakry, Guinee  -  Tel: +224 600 00 00 00", marginX, y + 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text("RECU DE PAIEMENT", pageW - marginX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`No ${paiement.id.slice(0, 8).toUpperCase()}`, pageW - marginX, y + 6, {
    align: "right",
  });
  doc.text(`Date : ${formatDate(paiement.createdAt)}`, pageW - marginX, y + 11, {
    align: "right",
  });

  y += 20;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageW - marginX, y);
  y += 10;

  // ── Client ────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Recu de", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`${patient.prenom} ${patient.nom}`, marginX, y);
  y += 5;
  doc.text(`Tel: ${patient.telephone || "—"}`, marginX, y);
  y += 12;

  // ── Détail ────────────────────────────────────────
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, y - 5, contentW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("DESIGNATION", marginX + 3, y);
  doc.text("MONTANT", pageW - marginX - 3, y, { align: "right" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(examen ? examen.nomExamen : "Prestation de laboratoire", marginX + 3, y);
  doc.text(formatGNF(paiement.montant), pageW - marginX - 3, y, {
    align: "right",
  });
  y += 8;

  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageW - marginX, y);
  y += 10;

  // ── Total ─────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text("TOTAL", marginX + 3, y);
  doc.setTextColor(5, 150, 105);
  doc.text(formatGNF(paiement.montant), pageW - marginX - 3, y, {
    align: "right",
  });
  y += 12;

  // ── Statut + mode ─────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Mode de paiement : ${paiement.modePaiement || "—"}`,
    marginX,
    y,
  );
  y += 6;
  doc.setFont("helvetica", "bold");
  if (paiement.statut === "paye") {
    doc.setTextColor(5, 150, 105);
    doc.text("Statut : PAYE", marginX, y);
  } else {
    doc.setTextColor(220, 38, 38);
    doc.text("Statut : NON PAYE", marginX, y);
  }

  // ── Pied de page ──────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, pageH - 18, pageW - marginX, pageH - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Merci de votre confiance - LabMedical",
    pageW / 2,
    pageH - 12,
    { align: "center" },
  );

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`recu-${safe(patient.nom)}-${paiement.id.slice(0, 6)}.pdf`);
}
