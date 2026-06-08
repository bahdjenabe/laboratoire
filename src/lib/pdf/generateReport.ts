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
  const marginX = 16;
  const contentW = pageW - marginX * 2;
  let y = 20;

  // ── En-tête ───────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text("LabMedical", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Laboratoire d'analyses médicales", marginX, y + 6);
  doc.text("Conakry, Guinee  -  Tel: +224 600 00 00 00", marginX, y + 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("RAPPORT D'ANALYSE", pageW - marginX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Date : ${formatDate(resultat.createdAt)}`, pageW - marginX, y + 6, {
    align: "right",
  });

  y += 18;
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(marginX, y, pageW - marginX, y);
  y += 10;

  // ── Informations patient ──────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Patient", marginX, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600
  const sexe =
    patient.sexe === "M" ? "Masculin" : patient.sexe === "F" ? "Féminin" : "—";
  const infos: [string, string][] = [
    ["Nom complet", `${patient.prenom} ${patient.nom}`],
    ["Age / Sexe", `${age(patient.dateNaissance)} - ${sexe}`],
    ["Téléphone", patient.telephone || "—"],
    ["Groupe sanguin", patient.groupeSanguin || "—"],
  ];
  infos.forEach(([label, val]) => {
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`${label} :`, marginX, y);
    doc.setTextColor(30, 41, 59);
    doc.text(String(val), marginX + 40, y);
    y += 6;
  });

  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageW - marginX, y);
  y += 10;

  // ── Examen ────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`Analyse : ${examen.nomExamen}`, marginX, y);
  y += 10;

  // ── Tableau des valeurs ───────────────────────────
  const entries = Object.entries(resultat.valeurs ?? {});
  // En-tête du tableau
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(marginX, y - 5, contentW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("PARAMÈTRE", marginX + 3, y);
  doc.text("RÉSULTAT", marginX + contentW * 0.6, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (entries.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.text("Aucune valeur saisie.", marginX + 3, y);
    y += 7;
  } else {
    entries.forEach(([param, valeur], i) => {
      if (i % 2 === 1) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(marginX, y - 5, contentW, 7, "F");
      }
      doc.setTextColor(51, 65, 85);
      doc.text(String(param), marginX + 3, y);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text(String(valeur), marginX + contentW * 0.6, y);
      doc.setFont("helvetica", "normal");
      y += 7;
    });
  }

  y += 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageW - marginX, y);
  y += 10;

  // ── Observations ──────────────────────────────────
  if (resultat.observations) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("Observations", marginX, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(resultat.observations, contentW);
    doc.text(lines, marginX, y);
    y += lines.length * 5 + 6;
  }

  // ── Validation ────────────────────────────────────
  doc.setFontSize(10);
  if (resultat.valideParMedecin) {
    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.text("Resultat valide par le medecin", marginX, y);
  } else {
    doc.setTextColor(217, 119, 6); // amber-600
    doc.setFont("helvetica", "bold");
    doc.text("Resultat non valide - provisoire", marginX, y);
  }

  // ── Pied de page ──────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, pageH - 18, pageW - marginX, pageH - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Document genere par LabMedical - Ce rapport est confidentiel.",
    pageW / 2,
    pageH - 12,
    { align: "center" },
  );

  // ── Téléchargement ────────────────────────────────
  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`resultat-${safe(patient.nom)}-${safe(examen.nomExamen)}.pdf`);
}
