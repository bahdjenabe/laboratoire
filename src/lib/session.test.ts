import { describe, it, expect, beforeAll } from "vitest";

// Le secret est lu paresseusement par session.ts → on le fixe avant les tests.
beforeAll(() => {
  process.env.SESSION_SECRET = "secret-de-test-suffisamment-long-1234567890";
});

describe("session (cookie signé)", () => {
  it("signe puis vérifie : aller-retour conforme", async () => {
    const { signSession, verifySession } = await import("./session");
    const token = await signSession({ uid: "u1", role: "admin" });
    const payload = await verifySession(token);
    expect(payload).toEqual({ uid: "u1", role: "admin" });
  });

  it("rejette un jeton falsifié", async () => {
    const { signSession, verifySession } = await import("./session");
    const token = await signSession({ uid: "u1", role: "technicien" });
    // Altère le dernier caractère (la signature ne correspond plus).
    const falsifie = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(await verifySession(falsifie)).toBeNull();
  });

  it("rejette un jeton signé avec un autre secret", async () => {
    const { signSession, verifySession } = await import("./session");
    const token = await signSession({ uid: "u1", role: "medecin" });

    // Le secret est relu à chaque appel : on le change avant de vérifier.
    process.env.SESSION_SECRET = "un-tout-autre-secret-pour-le-test-000000";
    expect(await verifySession(token)).toBeNull();

    process.env.SESSION_SECRET = "secret-de-test-suffisamment-long-1234567890";
  });

  it("rejette une chaîne quelconque", async () => {
    const { verifySession } = await import("./session");
    expect(await verifySession("pas-un-jwt")).toBeNull();
  });
});
