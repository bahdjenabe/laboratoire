// Liste de référence des examens couramment proposés par un laboratoire
// d'analyses médicales. Sert à alimenter la liste déroulante du catalogue :
// l'admin choisit l'examen ici (noms normalisés, sans faute de frappe) puis
// saisit uniquement le prix. Regroupée par famille pour la lisibilité.

export interface FamilleExamens {
  famille: string;
  examens: string[];
}

export const EXAMENS_DISPONIBLES: FamilleExamens[] = [
  {
    famille: "Hématologie",
    examens: [
      "Hémogramme (NFS)",
      "Numération formule sanguine",
      "Taux d'hémoglobine",
      "Groupage sanguin ABO/Rhésus",
      "Vitesse de sédimentation (VS)",
      "Taux de réticulocytes",
      "Numération plaquettaire",
      "Temps de saignement / coagulation",
      "Taux de prothrombine (TP)",
      "Temps de céphaline activée (TCA/TCK)",
      "Électrophorèse de l'hémoglobine",
      "Test d'Emmel (drépanocytose)",
    ],
  },
  {
    famille: "Biochimie",
    examens: [
      "Glycémie à jeun",
      "Glycémie post-prandiale",
      "Hémoglobine glyquée (HbA1c)",
      "Créatininémie",
      "Urémie (azotémie)",
      "Acide urique",
      "Cholestérol total",
      "Bilan lipidique complet",
      "Triglycérides",
      "Transaminases (ASAT/ALAT)",
      "Gamma GT (GGT)",
      "Phosphatases alcalines",
      "Bilirubine totale et conjuguée",
      "Protéines totales",
      "Albuminémie",
      "Ionogramme sanguin (Na/K/Cl)",
      "Calcémie",
      "Magnésémie",
      "Amylasémie",
      "Lipasémie",
      "Protéine C réactive (CRP)",
    ],
  },
  {
    famille: "Sérologie / Immunologie",
    examens: [
      "Test VIH (dépistage)",
      "Antigène HBs (hépatite B)",
      "Sérologie hépatite C",
      "Sérodiagnostic de Widal (typhoïde)",
      "Test de paludisme (TDR)",
      "Goutte épaisse / frottis (paludisme)",
      "ASLO (antistreptolysines)",
      "Facteur rhumatoïde",
      "Sérologie syphilis (TPHA/VDRL)",
      "Sérologie toxoplasmose",
      "Sérologie rubéole",
      "Test de grossesse (β-HCG)",
    ],
  },
  {
    famille: "Hormonologie",
    examens: [
      "TSH",
      "T3 / T4",
      "Prolactine",
      "Testostérone",
      "Progestérone",
      "Antigène prostatique spécifique (PSA)",
    ],
  },
  {
    famille: "Microbiologie / Parasitologie",
    examens: [
      "ECBU (cytobactériologie des urines)",
      "Coproculture",
      "Examen parasitologique des selles (KAOP)",
      "Spermogramme",
      "Prélèvement vaginal (PV)",
      "Prélèvement urétral",
      "Antibiogramme",
    ],
  },
  {
    famille: "Urines",
    examens: [
      "Analyse d'urines (bandelette)",
      "Protéinurie de 24 heures",
      "Glycosurie",
    ],
  },
];

// Tous les noms à plat (pratique pour vérifier les doublons du catalogue).
export const TOUS_LES_EXAMENS: string[] = EXAMENS_DISPONIBLES.flatMap(
  (f) => f.examens,
);
