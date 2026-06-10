import { describe, it, expect } from "vitest";
import {
  examenSchema,
  catalogueExamenSchema,
  patientSchema,
  loginSchema,
} from "./validations";

describe("examenSchema", () => {
  it("accepte un patient et au moins un examen du catalogue", () => {
    const r = examenSchema.safeParse({
      patientId: "pat1",
      catalogueIds: ["c1", "c2"],
    });
    expect(r.success).toBe(true);
  });

  it("refuse une commande sans aucun examen sélectionné", () => {
    const r = examenSchema.safeParse({ patientId: "pat1", catalogueIds: [] });
    expect(r.success).toBe(false);
  });

  it("refuse l'absence de patient", () => {
    const r = examenSchema.safeParse({ patientId: "", catalogueIds: ["c1"] });
    expect(r.success).toBe(false);
  });
});

describe("catalogueExamenSchema", () => {
  it("accepte un nom et un prix positif", () => {
    expect(
      catalogueExamenSchema.safeParse({ nom: "Glycémie", prix: 30000 }).success,
    ).toBe(true);
  });

  it("refuse un prix négatif", () => {
    expect(
      catalogueExamenSchema.safeParse({ nom: "Glycémie", prix: -5 }).success,
    ).toBe(false);
  });

  it("refuse un nom vide", () => {
    expect(
      catalogueExamenSchema.safeParse({ nom: "  ", prix: 100 }).success,
    ).toBe(false);
  });
});

describe("patientSchema", () => {
  const base = {
    prenom: "Aïssatou",
    nom: "Barry",
    dateNaissance: "1990-01-01",
    sexe: "F" as const,
    telephone: "620000000",
  };

  it("accepte un patient valide avec e-mail vide", () => {
    expect(patientSchema.safeParse({ ...base, email: "" }).success).toBe(true);
  });

  it("refuse un e-mail invalide", () => {
    expect(
      patientSchema.safeParse({ ...base, email: "pasunemail" }).success,
    ).toBe(false);
  });

  it("refuse un téléphone trop court", () => {
    expect(patientSchema.safeParse({ ...base, telephone: "12" }).success).toBe(
      false,
    );
  });
});

describe("loginSchema", () => {
  it("refuse un mot de passe trop court", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "123" }).success,
    ).toBe(false);
  });
});
