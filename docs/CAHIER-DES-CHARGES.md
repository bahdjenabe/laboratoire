# CAHIER DES CHARGES

## Application **LabMédical** — Gestion de laboratoire d'analyses médicales

---

### Suivi du document

| Élément | Valeur |
|---------|--------|
| Projet | LabMédical |
| Version du document | 1.0 |
| Date | 2026-06-08 |
| Auteur | Équipe projet |
| Statut | Référence |
| Projet Firebase | `laboratoire-f8e84` |
| Dépôt | `github.com/bahdjenabe/laboratoire` |

> Les exigences sont numérotées : **EF** = exigence fonctionnelle,
> **ENF** = exigence non-fonctionnelle, **RG** = règle de gestion.
> Les sections marquées *(estimation)* doivent être validées par le client.

---

## SOMMAIRE

1. Introduction
2. Périmètre du projet
3. Acteurs et rôles
4. Exigences fonctionnelles
5. Workflow métier
6. Règles de gestion
7. Exigences non-fonctionnelles
8. Architecture technique
9. Modèle de données
10. Inventaire des écrans
11. Plan de tests et critères de recette
12. Planning et jalons
13. Budget et coûts
14. Livrables
15. Maintenance et évolutions
16. Annexes

---

## 1. Introduction

### 1.1 Contexte
**LabMédical** est une application web de gestion d'un laboratoire d'analyses
médicales situé en Guinée (Conakry). Elle digitalise l'ensemble du parcours, de
l'enregistrement du patient à la mise à disposition sécurisée des résultats.

### 1.2 Objectifs
- Centraliser patients, examens, résultats et paiements dans un outil unique.
- Séparer les responsabilités : **saisie technique** vs **validation médicale**.
- Conditionner la réalisation d'un examen à son **paiement**.
- Garantir la **confidentialité** des résultats et leur consultation par le
  patient via un **lien sécurisé**.
- Fournir une **vision temps réel** de l'activité.

### 1.3 Enjeux
- Fiabilité des résultats (chaîne de validation médicale).
- Confidentialité des données de santé.
- Traçabilité (qui a saisi, qui a validé, quand).
- Simplicité d'usage pour le personnel d'accueil.

### 1.4 Glossaire
| Terme | Définition |
|-------|-----------|
| **Examen** | Analyse demandée pour un patient (ex. NFS, glycémie) |
| **Résultat** | Valeurs mesurées + observations pour un examen |
| **Validation** | Approbation médicale d'un résultat (acte médico-légal) |
| **Token** | Clé aléatoire permettant l'accès public à un résultat |
| **GNF** | Franc guinéen (devise) |
| **Snapshot public** | Copie figée d'un résultat validé, exposée au patient |

---

## 2. Périmètre du projet

### 2.1 Inclus
- Authentification et gestion des rôles du personnel.
- Gestion des patients, examens, résultats, paiements, personnel.
- Tableau de bord d'activité.
- Portail patient public (consultation par lien).
- Génération de documents PDF (reçu, rapport).

### 2.2 Exclus (voir §15 — évolutions)
- Envoi 100 % automatique des notifications (SMS/WhatsApp/e-mail).
- Espace patient authentifié.
- Comptabilité avancée / facturation fiscale.
- Application mobile native.
- Interfaçage avec des automates de laboratoire.

---

## 3. Acteurs et rôles

| Rôle | Description | Connexion |
|------|-------------|-----------|
| **Administrateur** | Supervision globale, personnel, validation possible | Oui |
| **Technicien** | Accueil + exécution : patients, examens, encaissement, saisie | Oui |
| **Médecin** | Validation médicale des résultats | Oui |
| **Patient** | Consulte ses résultats via lien sécurisé | Non |

### 3.1 Matrice des permissions

| Action | Admin | Technicien | Médecin |
|--------|:---:|:---:|:---:|
| Créer / modifier un patient | ✅ | ✅ | ❌ (lecture) |
| Supprimer un patient | ✅ | ❌ | ❌ |
| Créer / modifier un examen | ✅ | ✅ | ❌ (lecture) |
| Supprimer un examen | ✅ | ✅ | ❌ |
| Encaisser un paiement | ✅ | ✅ | ❌ |
| Supprimer un paiement | ✅ | ❌ | ❌ |
| Démarrer / saisir un résultat | ✅ | ✅ | ❌ |
| **Valider** un résultat | ✅ | ❌ | ✅ |
| Liste des résultats | ✅ | ❌ | ✅ |
| Gérer le personnel | ✅ | ❌ | ❌ |

---

## 4. Exigences fonctionnelles

### 4.1 Authentification & sécurité d'accès
- **EF-01** — Connexion par email + mot de passe.
- **EF-02** — Réinitialisation du mot de passe par e-mail.
- **EF-03** — Contrôle d'accès aux pages selon le rôle (redirection si interdit).
- **EF-04** — Redirection post-connexion selon le rôle (médecin → file de
  validation des résultats).
- **EF-05** — Déconnexion automatique après **30 min d'inactivité**, avec une
  modale d'avertissement **1 min** avant et possibilité de rester connecté.
- **EF-06** — Déconnexion manuelle.

### 4.2 Tableau de bord
- **EF-07** — Indicateurs : patients du jour, **examens à traiter** (en attente +
  en cours), résultats validés, **revenus du jour**.
- **EF-08** — Liste des examens récents (accès direct à la fiche).
- **EF-09** — Liste des derniers patients.
- **EF-10** — Actualisation manuelle des données.

### 4.3 Gestion des patients
- **EF-11** — Liste des patients avec recherche (nom, prénom, téléphone, email).
- **EF-12** — Création d'un patient (identité, date de naissance, sexe,
  téléphone, e-mail, adresse, groupe sanguin, antécédents).
- **EF-13** — Modification d'un patient.
- **EF-14** — Fiche patient : informations, **historique des examens** et **des
  paiements**, total payé.
- **EF-15** — Suppression d'un patient (admin), **bloquée s'il a des examens**.

### 4.4 Gestion des examens
- **EF-16** — Liste des examens avec filtres par statut et recherche
  (examen ou patient).
- **EF-17** — Création d'un examen : **sélection du patient par recherche**
  (nom/téléphone, désambiguïsation par date de naissance et sexe), type d'examen
  avec suggestions d'analyses courantes, prix.
- **EF-18** — Suivi du statut : `en_attente` → `en_cours` → `terminé` → `validé`.
- **EF-19** — Page détail : progression visuelle, infos patient, actions selon le
  rôle et le statut.
- **EF-20** — **Blocage** du démarrage/saisie tant que l'examen n'est pas payé.
- **EF-21** — Démarrage de l'analyse (technicien/admin) → `en_cours`.
- **EF-22** — Suppression d'un examen, **bloquée s'il a un résultat ou un
  paiement**.

### 4.5 Résultats
- **EF-23** — Saisie d'un résultat depuis la fiche examen : paramètres dynamiques
  (nom + valeur) et observations.
- **EF-24** — La saisie fait passer l'examen en `terminé`.
- **EF-25** — Validation médicale (médecin/admin) → `validé` + horodatage.
- **EF-26** — Un résultat validé n'est plus modifiable.
- **EF-27** — Liste des résultats (médecin/admin) avec filtre « À valider /
  Validés » et recherche.
- **EF-28** — Génération PDF du rapport d'analyse.

### 4.6 Paiements
- **EF-29** — Encaissement (admin/technicien) : **sélection de l'examen par
  recherche**, montant **pré-rempli** par le prix, mode de paiement, statut.
- **EF-30** — Modes de paiement : Espèces, Mobile Money, Carte bancaire, Virement.
- **EF-31** — Génération PDF du reçu.
- **EF-32** — Suppression d'un paiement (admin uniquement).
- **EF-33** — Totaux : encaissé, en attente.

### 4.7 Personnel
- **EF-34** — Liste du personnel (admin).
- **EF-35** — Création d'un compte (email, mot de passe, rôle).
- **EF-36** — Modification d'un compte (dont le rôle, par l'admin).

### 4.8 Portail patient
- **EF-37** — Consultation publique d'un résultat **validé** via lien token,
  **sans connexion**.
- **EF-38** — Affichage : patient, analyse, **date de validation**, valeurs,
  observations.
- **EF-39** — Impression / enregistrement PDF côté patient.
- **EF-40** — Partage du lien au patient via **WhatsApp / SMS / e-mail** (message
  pré-rempli) depuis la fiche examen, après validation.

---

## 5. Workflow métier

```
Création patient (technicien/admin)
   └─► Création examen ───────────► EN ATTENTE
          └─► Encaissement ────────► (paiement « payé »)
                 └─► Démarrer ─────► EN COURS
                        └─► Saisie ► TERMINÉ
                               └─► Validation médecin ► VALIDÉ (+ horodatage)
                                      └─► Notification patient (lien token)
                                             └─► Consultation portail public
```

---

## 6. Règles de gestion

- **RG-01** — Un examen doit être payé avant démarrage/saisie.
- **RG-02** — Seul le médecin (ou l'admin) valide un résultat ; le technicien ne
  valide jamais.
- **RG-03** — Un résultat validé est figé (non modifiable).
- **RG-04** — Un patient avec examens ne peut être supprimé.
- **RG-05** — Un examen avec résultat ou paiement ne peut être supprimé.
- **RG-06** — Un utilisateur ne peut pas modifier son propre rôle.
- **RG-07** — Le patient n'a pas de compte : il consulte par lien sécurisé.

---

## 7. Exigences non-fonctionnelles

### 7.1 Sécurité
- **ENF-01** — Règles d'accès aux données par collection et par champ (côté
  serveur, Firestore).
- **ENF-02** — Saisie des résultats : admin/technicien ; validation :
  admin/médecin ; le technicien ne peut écrire aucun champ de validation.
- **ENF-03** — Anti-élévation de privilèges (cf. RG-06).
- **ENF-04** — Données `resultats` privées ; consultation patient via **snapshot
  public** accessible uniquement par **token aléatoire (~192 bits)**, **non
  énumérable** et **révocable**.
- **ENF-05** — Déconnexion automatique (cf. EF-05).

### 7.2 Confidentialité des données de santé
- **ENF-06** — Le lien patient ne donne accès qu'à **un seul** résultat validé.
- **ENF-07** — Aucune donnée interne (identifiants techniques) exposée dans le
  snapshot public.
- *(À cadrer avec le client : politique de conservation, RGPD/loi locale,
  consentement, archivage.)*

### 7.3 Performance
- **ENF-08** — Affichage des listes fluide ; sélecteurs limités à 50 résultats
  affichés avec recherche.
- **ENF-09** — Chargement initial allégé (cache navigateur de session).

### 7.4 Ergonomie
- **ENF-10** — Interface en français, cohérente, avec retours visuels (états de
  chargement, confirmations, messages d'erreur).
- **ENF-11** — Navigation adaptée au rôle (menu filtré).

### 7.5 Disponibilité & compatibilité
- **ENF-12** — Application web accessible via navigateurs modernes (Chrome, Edge,
  Firefox, Safari).
- **ENF-13** — Hébergement avec déploiement continu.
- **ENF-14** — *(Évolution)* optimisation mobile (menu repliable).

### 7.6 Maintenabilité
- **ENF-15** — Code TypeScript typé, composants réutilisables, validations
  centralisées (zod).

---

## 8. Architecture technique

| Couche | Technologie |
|--------|-------------|
| Front / SSR | Next.js 16 (App Router, middleware) |
| Langage / UI | TypeScript, React 19, TailwindCSS 4 |
| Formulaires | react-hook-form + zod |
| Authentification | Firebase Authentication |
| Base de données | Cloud Firestore |
| Documents PDF | jsPDF |
| Hébergement front | Vercel (CI/CD sur push GitHub) |
| Backend données | Firebase (`laboratoire-f8e84`) |

- Contrôle d'accès aux routes : **middleware** (lecture d'un cookie de session).
- Sécurité des données : **règles Firestore** déployées.

---

## 9. Modèle de données

### `users`
`uid`, `email`, `nom`, `prenom`, `role` (admin|medecin|technicien), `createdAt`.

### `patients`
`id`, `nom`, `prenom`, `dateNaissance`, `sexe` (M|F|Autre), `telephone`,
`email?`, `adresse?`, `groupeSanguin?`, `antecedents?`, `createdAt`.

### `examens`
`id`, `patientId`, `nomExamen`, `technicienId?`, `medecinId?`,
`statut` (en_attente|en_cours|termine|valide), `prix`, `createdAt`, `updatedAt`.

### `resultats`
`id`, `examenId`, `patientId`, `valeurs` (clé→valeur), `observations?`,
`valideParMedecin`, `valideAt?`, `token?`, `examenNom?`, `patientNom?`,
`createdAt`.

### `paiements`
`id`, `patientId`, `examenId`, `montant`, `statut` (paye|non_paye),
`modePaiement?`, `createdAt`.

### `public_resultats/{token}`
`token`, `examenNom?`, `patientNom?`, `valeurs`, `observations?`, `valideAt`.
*(Snapshot public figé, sans référence interne.)*

---

## 10. Inventaire des écrans

| Route | Écran | Accès |
|-------|-------|-------|
| `/login` | Connexion | Public |
| `/dashboard/dashboard` | Tableau de bord | Personnel |
| `/dashboard/patients` | Liste patients | Personnel |
| `/dashboard/patients/nouveau` | Nouveau patient | Admin, technicien |
| `/dashboard/patients/[id]` | Fiche patient | Personnel |
| `/dashboard/patients/[id]/modifier` | Modifier patient | Admin, technicien |
| `/dashboard/examens` | Liste examens | Personnel |
| `/dashboard/examens/[id]` | Détail examen / saisie / validation | Personnel |
| `/dashboard/resultats` | Liste des résultats | Admin, médecin |
| `/dashboard/paiements` | Paiements | Admin, technicien |
| `/dashboard/personnel` | Gestion du personnel | Admin |
| `/patient-portal/[token]` | Rapport patient | Public (lien) |

---

## 11. Plan de tests et critères de recette

| # | Scénario | Critère d'acceptation |
|---|----------|-----------------------|
| T1 | Connexion par rôle | Chaque rôle atterrit sur la bonne page, menu adapté |
| T2 | Création patient + examen | Examen créé en « en attente », sélecteur patient par recherche |
| T3 | Blocage paiement | Démarrage impossible tant que non payé |
| T4 | Encaissement | Montant pré-rempli, examen payé |
| T5 | Saisie + validation | Technicien saisit (terminé), médecin valide (validé) |
| T6 | Portail patient | Lien token affiche le rapport validé ; faux token → indisponible |
| T7 | Restrictions technicien | Pas de menu Résultats, URL bloquée, pas de bouton Valider |
| T8 | Intégrité suppressions | Patient avec examen et examen avec résultat/paiement non supprimables |
| T9 | Sécurité rôle | Un non-admin ne peut pas se promouvoir admin |
| T10 | Déconnexion auto | Déconnexion après inactivité avec avertissement |

**Recette** : l'application est acceptée lorsque T1→T10 sont validés.

---

## 12. Planning et jalons *(estimation)*

| Phase | Contenu | Statut |
|-------|---------|--------|
| P1 — Fondations | Auth, rôles, middleware, structure | ✅ Réalisé |
| P2 — Cœur métier | Patients, examens, résultats, paiements | ✅ Réalisé |
| P3 — Portail & sécurité | Portail token, règles Firestore, déconnexion auto | ✅ Réalisé |
| P4 — Fiabilisation | Intégrité, sélecteurs recherche, notifications header | ✅ Réalisé |
| P5 — Recette | Tests T1→T10, corrections | 🔄 En cours |
| P6 — Mise en production | Hébergement définitif, formation, RGPD | ⏳ À faire |

---

## 13. Budget et coûts *(estimation)*

| Poste | Option actuelle | Pour production |
|-------|-----------------|-----------------|
| Hébergement front | Vercel (gratuit, usage non commercial) | Vercel Pro (~20 $/mois) ou Firebase App Hosting |
| Backend (Firestore/Auth) | Firebase Spark (gratuit, quotas) | Firebase Blaze (à l'usage, alerte budget conseillée) |
| Nom de domaine | — | ~10–15 $/an *(optionnel)* |
| Développement / évolutions | — | À chiffrer selon backlog §15 |

> Pour un petit laboratoire, l'usage reste généralement dans les quotas gratuits ;
> le passage commercial impose toutefois un plan payant (licence Vercel / Blaze).

---

## 14. Livrables

- Application web déployée (URL).
- Code source (dépôt GitHub).
- Règles de sécurité Firestore.
- Présent cahier des charges.
- *(À prévoir)* guide utilisateur par rôle, procédure de sauvegarde.

---

## 15. Maintenance et évolutions futures

1. **Notifications automatiques** (Twilio / API WhatsApp Business / SMTP).
2. **Espace patient authentifié**.
3. **Intégrité côté serveur** (Cloud Functions pour les suppressions/cascades).
4. **Optimisation mobile** (menu repliable, ergonomie tactile).
5. **Statistiques & exports** (CA par période, volumétrie, export comptable).
6. **Archivage / conservation** conforme à la réglementation des données de santé.
7. **Sauvegardes** automatiques et plan de reprise.

---

## 16. Annexes

### 16.1 Analyses courantes proposées à la saisie
Hémogramme (NFS), Glycémie à jeun, Test de paludisme (TDR), Groupage sanguin,
Test VIH, Widal (typhoïde), Créatininémie, Transaminases (ASAT/ALAT), Bilan
lipidique, Test de grossesse (β-HCG).

### 16.2 Modes de paiement
Espèces, Mobile Money, Carte bancaire, Virement.

### 16.3 États d'un examen
`en_attente` (créé), `en_cours` (analyse démarrée), `terminé` (résultat saisi),
`validé` (approuvé par le médecin).

---

*Fin du document — Cahier des charges LabMédical v1.0 (2026-06-08).*
