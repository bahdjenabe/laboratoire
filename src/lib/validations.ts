import { z } from "zod";

// ── Connexion ─────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "L'adresse e-mail est requise")
    .email("Adresse e-mail invalide"),
  password: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ── Patient ───────────────────────────────────────
export const patientSchema = z.object({
  prenom: z.string().trim().min(1, "Le prénom est requis"),
  nom: z.string().trim().min(1, "Le nom est requis"),
  dateNaissance: z.string().min(1, "La date de naissance est requise"),
  sexe: z.enum(["M", "F", "Autre"]),
  telephone: z.string().trim().min(6, "Numéro de téléphone invalide"),
  email: z
    .string()
    .trim()
    .email("Adresse e-mail invalide")
    .optional()
    .or(z.literal("")),
  adresse: z.string().trim().optional(),
  groupeSanguin: z.string().optional(),
  antecedents: z.string().trim().optional(),
});
export type PatientInput = z.infer<typeof patientSchema>;

// ── Catalogue d'examens (géré par l'admin) ────────
export const catalogueExamenSchema = z.object({
  nom: z.string().trim().min(1, "Le nom de l'examen est requis"),
  prix: z
    .number({ message: "Le prix est requis" })
    .min(0, "Le prix doit être positif"),
});
export type CatalogueExamenInput = z.infer<typeof catalogueExamenSchema>;

// ── Examen ────────────────────────────────────────
// Création : on sélectionne un patient et un ou plusieurs examens du
// catalogue (le prix est repris du catalogue, pas de saisie manuelle).
export const examenSchema = z.object({
  patientId: z.string().min(1, "Veuillez sélectionner un patient"),
  catalogueIds: z
    .array(z.string().min(1))
    .min(1, "Sélectionnez au moins un examen"),
});
export type ExamenInput = z.infer<typeof examenSchema>;

// ── Paiement ──────────────────────────────────────
export const paiementSchema = z.object({
  examenId: z.string().min(1, "Veuillez sélectionner un examen"),
  montant: z
    .number({ message: "Le montant est requis" })
    .min(0, "Le montant doit être positif"),
  modePaiement: z.string().min(1, "Mode de paiement requis"),
  detailPaiement: z.string().optional(),
  referencePaiement: z.string().optional(),
  statut: z.enum(["paye", "non_paye"]),
});
export type PaiementInput = z.infer<typeof paiementSchema>;

// ── Personnel ─────────────────────────────────────
export const staffSchema = z.object({
  prenom: z.string().trim().min(1, "Le prénom est requis"),
  nom: z.string().trim().min(1, "Le nom est requis"),
  email: z
    .string()
    .trim()
    .min(1, "L'adresse e-mail est requise")
    .email("Adresse e-mail invalide"),
  password: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  role: z.enum(["admin", "medecin", "technicien"]),
});
export type StaffInput = z.infer<typeof staffSchema>;

// Édition : on ne modifie pas l'e-mail ni le mot de passe ici.
export const staffEditSchema = z.object({
  prenom: z.string().trim().min(1, "Le prénom est requis"),
  nom: z.string().trim().min(1, "Le nom est requis"),
  role: z.enum(["admin", "medecin", "technicien"]),
});
export type StaffEditInput = z.infer<typeof staffEditSchema>;

// ── Résultat ──────────────────────────────────────
export const resultatSchema = z.object({
  valeurs: z
    .array(
      z.object({
        param: z.string().trim(),
        valeur: z.string().trim(),
      }),
    )
    .refine((rows) => rows.some((r) => r.param.length > 0), {
      message: "Saisissez au moins un paramètre",
    }),
  observations: z.string().trim().optional(),
});
export type ResultatInput = z.infer<typeof resultatSchema>;
