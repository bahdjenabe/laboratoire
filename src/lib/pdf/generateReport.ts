import { jsPDF } from "jspdf";
import type { Examen, Patient, Resultat } from "@/types";

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

function age(dateNaissance: unknown): string {
  const d = toDate(dateNaissance);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  return `${Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))} ans`;
}

// Palette (RGB)
const EMERALD: [number, number, number] = [5, 150, 105];
const EMERALD_LIGHT: [number, number, number] = [209, 250, 229]; // emerald-100
const EMERALD_DARK: [number, number, number] = [4, 120, 87]; // emerald-700
const DARK: [number, number, number] = [15, 23, 42]; // slate-900
const GRAY: [number, number, number] = [100, 116, 139]; // slate-500
const LIGHT: [number, number, number] = [248, 250, 252]; // slate-50
const BORDER: [number, number, number] = [226, 232, 240]; // slate-200
const AMBER_LIGHT: [number, number, number] = [254, 243, 199];
const AMBER_DARK: [number, number, number] = [180, 83, 9];

/**
 * Génère et télécharge le rapport PDF d'un résultat d'analyse.
 */
export function generateReport(
  examen: Examen,
  patient: Patient,
  resultat: Resultat,
): void {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const contentW = pageW - marginX * 2;
  doc.setLineWidth(0.2);

  // ── Bandeau d'en-tête ─────────────────────────────
  doc.setFillColor(...EMERALD);
  doc.rect(0, 0, pageW, 34, "F");

  // Logo (carré blanc + initiales)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginX, 9, 16, 16, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...EMERALD);
  doc.text("LM", marginX + 8, 19.5, { align: "center" });

  // Identité du laboratoire
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("LabMédical", marginX + 23, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...EMERALD_LIGHT);
  doc.text("Laboratoire d'analyses médicales", marginX + 23, 22);
  doc.text("Conakry, Guinée  |  Tél : +224 600 00 00 00", marginX + 23, 27);

  // Titre + date + référence (à droite)
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("RAPPORT D'ANALYSE", pageW - marginX, 15, { align: "right" });
  const dateRef = resultat.valideAt ?? resultat.createdAt;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...EMERALD_LIGHT);
  doc.text(`Date : ${formatDate(dateRef)}`, pageW - marginX, 22, {
    align: "right",
  });
  const ref = String(resultat.id || examen.id || "")
    .slice(0, 8)
    .toUpperCase();
  if (ref) {
    doc.text(`Réf : ${ref}`, pageW - marginX, 27, { align: "right" });
  }

  let y = 46;

  // ── Carte patient ─────────────────────────────────
  const cardH = 26;
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(marginX, y, contentW, cardH, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...EMERALD);
  doc.text("PATIENT", marginX + 5, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(`${patient.prenom} ${patient.nom}`, marginX + 5, y + 15);
  const sexe =
    patient.sexe === "M" ? "Masculin" : patient.sexe === "F" ? "Féminin" : "—";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(
    `${age(patient.dateNaissance)}  |  ${sexe}  |  Tél : ${
      patient.telephone || "—"
    }  |  Groupe : ${patient.groupeSanguin || "—"}`,
    marginX + 5,
    y + 21.5,
  );
  y += cardH + 12;

  // ── Titre de l'analyse ────────────────────────────
  doc.setFillColor(...EMERALD);
  doc.rect(marginX, y - 4.5, 2.5, 7, "F"); // barre d'accent
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("ANALYSE", marginX + 6, y - 1.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(examen.nomExamen, marginX + 6, y + 4);
  y += 12;

  // ── Tableau des valeurs ───────────────────────────
  const entries = Object.entries(resultat.valeurs ?? {});
  const colValX = marginX + contentW * 0.58;
  const rowH = 9;
  const tableTop = y;

  // En-tête du tableau
  doc.setFillColor(...EMERALD);
  doc.rect(marginX, y, contentW, rowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("PARAMÈTRE", marginX + 4, y + 6);
  doc.text("RÉSULTAT", colValX, y + 6);
  y += rowH;

  doc.setFontSize(10);
  if (entries.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text("Aucune valeur saisie.", marginX + 4, y + 6);
    y += rowH;
  } else {
    entries.forEach(([param, valeur], i) => {
      if (i % 2 === 1) {
        doc.setFillColor(...LIGHT);
        doc.rect(marginX, y, contentW, rowH, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(String(param), marginX + 4, y + 6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(String(valeur), colValX, y + 6);
      doc.setDrawColor(...BORDER);
      doc.line(marginX, y + rowH, marginX + contentW, y + rowH);
      y += rowH;
    });
  }

  // Cadre + séparateur de colonnes
  doc.setDrawColor(...BORDER);
  doc.rect(marginX, tableTop, contentW, y - tableTop);
  doc.line(colValX - 4, tableTop, colValX - 4, y);
  y += 14;

  // ── Observations ──────────────────────────────────
  if (resultat.observations) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...EMERALD);
    doc.text("OBSERVATIONS", marginX, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(resultat.observations, contentW - 10);
    const boxH = lines.length * 5 + 8;
    doc.setFillColor(...LIGHT);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(marginX, y, contentW, boxH, 2.5, 2.5, "FD");
    doc.text(lines, marginX + 5, y + 6);
    y += boxH + 12;
  }

  // ── Badge de validation ───────────────────────────
  const badgeH = 11;
  if (resultat.valideParMedecin) {
    doc.setFillColor(...EMERALD_LIGHT);
    doc.roundedRect(marginX, y, contentW, badgeH, 2.5, 2.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...EMERALD_DARK);
    doc.text(
      `Résultat validé par le médecin  -  le ${formatDate(dateRef)}`,
      marginX + 5,
      y + 7,
    );
  } else {
    doc.setFillColor(...AMBER_LIGHT);
    doc.roundedRect(marginX, y, contentW, badgeH, 2.5, 2.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...AMBER_DARK);
    doc.text(
      "Résultat provisoire - en attente de validation médicale",
      marginX + 5,
      y + 7,
    );
  }
  y += badgeH + 18;

  // ── Zone signature ────────────────────────────────
  const sigX = pageW - marginX - 60;
  doc.setDrawColor(...GRAY);
  doc.line(sigX, y, pageW - marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Signature et cachet du médecin", sigX, y + 5);

  // ── Pied de page ──────────────────────────────────
  doc.setDrawColor(...BORDER);
  doc.line(marginX, pageH - 18, pageW - marginX, pageH - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Document généré par LabMédical  -  Ce rapport est strictement confidentiel.",
    pageW / 2,
    pageH - 12,
    { align: "center" },
  );

  // ── Téléchargement ────────────────────────────────
  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`resultat-${safe(patient.nom)}-${safe(examen.nomExamen)}.pdf`);
}
