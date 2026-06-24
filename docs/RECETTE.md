# Checklist de recette — LabMédical

Document de validation avant mise en production (phase P5 du cahier des charges).
Cocher chaque critère après vérification sur l'environnement de test
(**https://laboratoire-delta.vercel.app**).

| Élément | Valeur |
|---------|--------|
| Version testée | _(à compléter : commit / date)_ |
| Testeur | _______________________ |
| Date de recette | _____ / _____ / __________ |
| Environnement | ☐ Test (Vercel)  ☐ Production |

**Recette acceptée** lorsque **T1 → T10** sont tous au vert.

### Comptes de test nécessaires
Préparer un compte par rôle avant de commencer :

- ☐ Administrateur — email : ________________________
- ☐ Technicien — email : ________________________
- ☐ Médecin — email : ________________________

---

## T1 — Connexion par rôle  *(EF-01, EF-03, EF-04, ENF-11)*

| # | Étape | Attendu | OK |
|---|-------|---------|:--:|
| 1.1 | Se connecter en **technicien** | Arrive sur le tableau de bord, menu sans « Résultats » ni « Catalogue » ni « Personnel » | ☐ |
| 1.2 | Se connecter en **médecin** | Atterrit sur la **liste des résultats** à valider ; menu adapté | ☐ |
| 1.3 | Se connecter en **admin** | Accès complet (Catalogue, Personnel, Suppressions visibles) | ☐ |
| 1.4 | Mauvais mot de passe | Message d'erreur clair, pas d'accès | ☐ |
| 1.5 | « Mot de passe oublié ? » | E-mail de réinitialisation reçu | ☐ |

---

## T2 — Création patient + examen  *(EF-12, EF-16, EF-17, EF-41)*

| # | Étape | Attendu | OK |
|---|-------|---------|:--:|
| 2.1 | Créer un patient (technicien) | Matricule **P-AAAA-NNNN** attribué automatiquement | ☐ |
| 2.2 | Nouvel examen → saisir le matricule puis rechercher | La fiche patient s'affiche, le reste du formulaire se débloque | ☐ |
| 2.3 | Cocher un ou plusieurs examens du catalogue | Prix repris automatiquement, total affiché | ☐ |
| 2.4 | Valider | Commande créée, examens en statut **En attente** | ☐ |

---

## T3 — Blocage paiement  *(EF-20, RG-01)*

| # | Étape | Attendu | OK |
|---|-------|---------|:--:|
| 3.1 | Ouvrir un examen **non payé** | Bouton « Démarrer l'analyse » bloqué / indisponible | ☐ |
| 3.2 | Tenter la saisie d'un résultat avant paiement | Impossible (action bloquée) | ☐ |

---

## T4 — Encaissement  *(EF-29, EF-30, EF-31)*

| # | Étape | Attendu | OK |
|---|-------|---------|:--:|
| 4.1 | Nouveau paiement → choisir la commande par recherche | Montant **pré-rempli** par le total de la commande | ☐ |
| 4.2 | Choisir un mode (Mobile Money / Carte / Virement) | Détail adapté (opérateur / réseau / banque) + réf. facultative | ☐ |
| 4.3 | Enregistrer | Examen(s) marqué(s) **payé** | ☐ |
| 4.4 | Télécharger le reçu 🧾 | PDF avec en-tête, cachet & signature, mode + détail + référence | ☐ |

---

## T5 — Saisie + validation  *(EF-23, EF-24, EF-25, EF-26)*

| # | Étape | Attendu | OK |
|---|-------|---------|:--:|
| 5.1 | Technicien : « Démarrer l'analyse » | Examen passe en **En cours** | ☐ |
| 5.2 | Technicien : saisir paramètres/valeurs + observations | Examen passe en **Terminé** | ☐ |
| 5.3 | Médecin : ouvrir le résultat et « Valider (médecin) » | Statut **Validé** + horodatage | ☐ |
| 5.4 | Rouvrir un résultat validé | Non modifiable (figé) | ☐ |
| 5.5 | Télécharger le rapport PDF | En-tête, valeurs, **cachet & signature** présents | ☐ |

---

## T6 — Portail patient  *(EF-37, EF-38, EF-39, ENF-04, ENF-06)*

| # | Étape | Attendu | OK |
|---|-------|---------|:--:|
| 6.1 | Ouvrir le lien token du résultat validé (sans connexion) | Rapport affiché : patient, démographie, analyse, date de validation, valeurs | ☐ |
| 6.2 | Télécharger le PDF officiel côté patient | Identique au PDF labo (cachet & signature) | ☐ |
| 6.3 | Ouvrir un **faux token** | Page « indisponible », aucune donnée exposée | ☐ |
| 6.4 | Révoquer le lien puis le rouvrir | Accès refusé après révocation | ☐ |

---

## T7 — Restrictions technicien  *(EF-03, RG-02, ENF-02)*

| # | Étape | Attendu | OK |
|---|-------|---------|:--:|
| 7.1 | Menu technicien | Pas d'entrée « Résultats » | ☐ |
| 7.2 | Accès direct à l'URL `/dashboard/resultats` en technicien | Redirigé (route bloquée par le proxy) | ☐ |
| 7.3 | Fiche examen en technicien | Aucun bouton « Valider (médecin) » | ☐ |

---

## T8 — Intégrité des suppressions  *(EF-22, RG-04, RG-05)*

| # | Étape | Attendu | OK |
|---|-------|---------|:--:|
| 8.1 | Supprimer un examen ayant un résultat ou un paiement | Refusé (message d'erreur) | ☐ |
| 8.2 | « Supprimer » un patient (admin) | **Archivé** (suppression douce), historique conservé | ☐ |
| 8.3 | Restaurer un patient archivé | Patient de nouveau actif | ☐ |
| 8.4 | Patient archivé sur une nouvelle saisie d'examen | Non proposé à la sélection | ☐ |

---

## T9 — Sécurité des rôles  *(EF-36, RG-06, ENF-03)*

| # | Étape | Attendu | OK |
|---|-------|---------|:--:|
| 9.1 | Un utilisateur tente de modifier **son propre rôle** | Interdit (admin inclus) | ☐ |
| 9.2 | Un non-admin tente d'accéder à `/dashboard/personnel` | Redirigé / refusé | ☐ |
| 9.3 | Téléphone ou email en doublon à la création patient | Refus avec message (RG-08) | ☐ |

---

## T10 — Déconnexion automatique  *(EF-05, ENF-05)*

| # | Étape | Attendu | OK |
|---|-------|---------|:--:|
| 10.1 | Laisser la session inactive (≈ 2 h) | Modale « Toujours là ? » avec compte à rebours **2 min** avant | ☐ |
| 10.2 | « Rester connecté » dans la modale | La session est prolongée | ☐ |
| 10.3 | Laisser le compte à rebours expirer | Déconnexion automatique → page de connexion | ☐ |
| 10.4 | Déconnexion manuelle | Bouton « Se déconnecter » fonctionne | ☐ |

> Astuce pour T10 : pour ne pas attendre 2 h en test, vérifier le comportement du
> compte à rebours et de la prolongation, le délai d'inactivité étant configuré
> dans le code (cf. `src/lib/idleActivity.ts` / `src/components/IdleLogout.tsx`).

---

## Synthèse

| Scénario | Statut |
|----------|:------:|
| T1 — Connexion par rôle | ☐ |
| T2 — Création patient + examen | ☐ |
| T3 — Blocage paiement | ☐ |
| T4 — Encaissement | ☐ |
| T5 — Saisie + validation | ☐ |
| T6 — Portail patient | ☐ |
| T7 — Restrictions technicien | ☐ |
| T8 — Intégrité suppressions | ☐ |
| T9 — Sécurité rôle | ☐ |
| T10 — Déconnexion auto | ☐ |

**Décision de recette :** ☐ Acceptée  ☐ Acceptée avec réserves  ☐ Refusée

Réserves / anomalies relevées :

```
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
```

Signature testeur : ____________________  Date : ____ / ____ / ________

---

## Reste à faire avant production (phase P6)

- ☐ Recette T1 → T10 validée (ci-dessus)
- ☐ Variables d'environnement de production configurées sur Vercel
      (`RESEND_API_KEY`, `RESEND_FROM`, secret de session, config Firebase)
- ☐ Expéditeur e-mail Resend vérifié (domaine ou `onboarding@resend.dev` pour les tests)
- ☐ Règles Firestore (`src/firestore.rules`) déployées sur le projet `laboratoire-f8e84`
- ☐ RGPD / conservation des données de santé cadrés avec le client
- ☐ Sauvegarde Firestore et procédure de restauration documentées
- ☐ Formation des utilisateurs (cf. `docs/GUIDE-UTILISATION.md`)
