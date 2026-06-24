// Enregistre une vidéo de démonstration de LabMédical en pilotant l'app réelle
// avec Playwright. La vidéo (.webm) est écrite dans docs/video/.
//
// Usage (PowerShell) :
//   $env:DEMO_BASE="http://localhost:3000"
//   $env:TECH_EMAIL="technicien@..."; $env:TECH_PASS="..."
//   $env:MED_EMAIL="medecin@...";     $env:MED_PASS="..."
//   $env:ADMIN_EMAIL="admin@...";     $env:ADMIN_PASS="..."
//   node scripts/demo-video.mjs
//
// Seuls les identifiants fournis sont utilisés ; les autres rôles sont sautés.
import { chromium } from "playwright";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.DEMO_BASE ?? "http://localhost:3000";
const OUT_DIR = "docs/video";
const SIZE = { width: 1280, height: 720 };

const ROLES = {
  technicien: { email: process.env.TECH_EMAIL, pass: process.env.TECH_PASS },
  medecin: { email: process.env.MED_EMAIL, pass: process.env.MED_PASS },
  admin: { email: process.env.ADMIN_EMAIL, pass: process.env.ADMIN_PASS },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Affiche une légende en surimpression (bandeau bas) directement dans la page,
// donc capturée dans la vidéo. Recréée après chaque navigation.
async function caption(page, text, ms = 2600) {
  await page.evaluate((t) => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      el.style.cssText = [
        "position:fixed",
        "left:50%",
        "bottom:28px",
        "transform:translateX(-50%)",
        "max-width:80%",
        "padding:14px 26px",
        "background:rgba(15,23,42,0.92)",
        "color:#fff",
        "font:600 18px/1.4 'Segoe UI',system-ui,sans-serif",
        "border-radius:12px",
        "box-shadow:0 8px 30px rgba(0,0,0,.35)",
        "z-index:2147483647",
        "text-align:center",
        "border:1px solid rgba(16,185,129,.6)",
      ].join(";");
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text).catch(() => {});
  await sleep(ms);
}

// Firestore utilise du long-polling : le réseau n'est jamais "idle", donc on
// attend seulement le DOM puis une courte pause fixe pour le rendu des données.
async function login(page, email, pass, roleLabel) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await caption(page, `Connexion — ${roleLabel}`, 1500);
  await page.fill("#email", email);
  await page.fill("#password", pass);
  await sleep(500);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await sleep(1800);
}

// Défilement doux pour donner le temps de voir le contenu d'une page.
async function slowScroll(page) {
  await page.evaluate(async () => {
    const step = 220;
    const max = Math.max(0, document.body.scrollHeight - window.innerHeight);
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 180));
    }
    await new Promise((r) => setTimeout(r, 500));
    window.scrollTo(0, 0);
  }).catch(() => {});
}

async function visit(page, path, cap, ms = 3500) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await sleep(1800); // laisse Firestore peupler la liste
  await caption(page, cap, ms);
  await slowScroll(page);
  await sleep(1500); // pause pour bien voir la page
}

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Utilise le Chrome déjà installé sur la machine (channel "chrome"),
  // ce qui évite de télécharger le Chromium fourni par Playwright.
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: OUT_DIR, size: SIZE },
    locale: "fr-FR",
  });
  const page = await context.newPage();

  try {
    // ── Intro : page publique de pré-inscription ──────────────
    await page.goto(`${BASE}/pre-inscription`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await caption(page, "LabMédical — gestion d'un laboratoire d'analyses", 3000);
    await caption(page, "1. Le patient peut se pré-inscrire en ligne, sans compte", 3200);
    await sleep(800);

    // ── Parcours TECHNICIEN ───────────────────────────────────
    if (ROLES.technicien.email) {
      await login(page, ROLES.technicien.email, ROLES.technicien.pass, "Technicien (accueil)");
      await caption(page, "Tableau de bord : activité du jour en temps réel", 3200);
      await visit(page, "/dashboard/pre-inscriptions", "2. L'accueil confirme les pré-inscriptions reçues");
      await visit(page, "/dashboard/patients", "3. Les patients : recherche par matricule, nom, téléphone");
      await visit(page, "/dashboard/examens", "4. Les examens, regroupés par commande (En attente → Validé)");
      await visit(page, "/dashboard/paiements", "5. Encaissement : le paiement débloque l'analyse, puis reçu PDF");
      await logout(page);
    }

    // ── Parcours MÉDECIN ──────────────────────────────────────
    if (ROLES.medecin.email) {
      await login(page, ROLES.medecin.email, ROLES.medecin.pass, "Médecin (validation)");
      await caption(page, "6. Le médecin arrive sur les résultats à valider", 3200);
      await visit(page, "/dashboard/resultats", "Validation médicale : le résultat est figé et horodaté");
      await logout(page);
    }

    // ── Parcours ADMIN (accès complet : tour A→Z) ─────────────
    if (ROLES.admin.email) {
      await login(page, ROLES.admin.email, ROLES.admin.pass, "Administrateur");
      await caption(page, "Tableau de bord : patients du jour, examens à traiter, revenus", 3400);
      await visit(page, "/dashboard/pre-inscriptions", "2. Pré-inscriptions en ligne à confirmer à l'accueil");
      await visit(page, "/dashboard/patients", "3. Patients : matricule unique, recherche, archivage");
      await visit(page, "/dashboard/examens", "4. Examens regroupés par commande (En attente → Validé)");
      await visit(page, "/dashboard/paiements", "5. Paiements : le paiement débloque l'analyse, reçu PDF");
      await visit(page, "/dashboard/resultats", "6. Résultats : validation médicale, puis lien patient sécurisé");
      await visit(page, "/dashboard/catalogue", "7. Catalogue des examens et de leurs prix");
      await visit(page, "/dashboard/personnel", "8. Gestion du personnel et des rôles");
      await visit(page, "/dashboard/dashboard", "Une chaîne claire, traçable et confidentielle — de A à Z");
      await logout(page);
    }

    await caption(page, "Merci d'avoir suivi cette démonstration de LabMédical", 3000);
  } catch (err) {
    console.error("Erreur pendant l'enregistrement :", err);
  } finally {
    await context.close(); // finalise l'écriture de la vidéo
    await browser.close();
  }

  // Renomme la vidéo générée (nom aléatoire Playwright) en demo-labmedical.webm
  const files = readdirSync(OUT_DIR).filter((f) => f.endsWith(".webm"));
  const latest = files
    .map((f) => ({ f, t: f }))
    .sort((a, b) => (a.f < b.f ? 1 : -1))[0];
  if (latest) {
    renameSync(join(OUT_DIR, latest.f), join(OUT_DIR, "demo-labmedical.webm"));
    console.log("✅ Vidéo générée : docs/video/demo-labmedical.webm");
  } else {
    console.log("⚠️ Aucune vidéo trouvée — l'enregistrement a-t-il démarré ?");
  }
}

async function logout(page) {
  await page.getByRole("button", { name: /se d[ée]connecter/i }).click().catch(() => {});
  await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
  await sleep(1200);
}

run();
