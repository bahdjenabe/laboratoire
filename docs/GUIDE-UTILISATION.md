# Guide d'utilisation — LabMédical

Application de gestion de laboratoire d'analyses médicales.
Accès : **https://laboratoire-delta.vercel.app**

---

## 1. Se connecter

1. Ouvrez le lien ci-dessus dans un navigateur (Chrome, Edge, Firefox…).
2. Saisissez votre **adresse e-mail** et votre **mot de passe** (fournis par l'administrateur).
3. Cliquez sur **Se connecter**.

- **Mot de passe oublié ?** Saisissez votre e-mail puis cliquez sur « Mot de passe oublié ? » : un lien de réinitialisation vous est envoyé par e-mail.
- **Déconnexion automatique** : après **2 heures sans activité**, une fenêtre « Toujours là ? » s'affiche, puis vous êtes déconnecté. C'est une sécurité.
- Pour quitter manuellement : bouton **Se déconnecter** (en bas du menu de gauche).

---

## 2. Les trois rôles en un coup d'œil

| | **Administrateur** | **Technicien** | **Médecin** |
|---|---|---|---|
| Patients | ✅ gérer | ✅ gérer | 👁️ via l'examen |
| Examens | ✅ créer/gérer | ✅ créer | 👁️ consulter |
| Saisie des résultats | ✅ | ✅ | — |
| **Validation** des résultats | ✅ | — | ✅ |
| Paiements | ✅ | ✅ | — |
| Catalogue (examens + prix) | ✅ | — | — |
| Personnel (comptes) | ✅ | — | — |
| Suppressions | ✅ | — | — |

> Chaque utilisateur ne voit dans le menu que ce qui le concerne.

---

## 3. Le parcours complet d'un examen

Voici qui fait quoi, dans l'ordre :

1. **Technicien** — enregistre le **patient** (s'il est nouveau).
2. **Technicien** — crée l'**examen** : il sélectionne le patient et coche un ou plusieurs examens du catalogue (le prix vient automatiquement).
3. **Technicien** (accueil) — **encaisse le paiement** de la commande.
   ⚠️ **L'analyse ne peut pas démarrer tant que l'examen n'est pas payé.**
4. **Technicien** — **saisit le résultat** de l'analyse depuis la fiche de l'examen.
5. **Médecin** — **valide** le résultat.
6. Le patient est **notifié** et consulte son résultat via un **lien sécurisé** (sans compte).

Statuts d'un examen : **En attente → En cours → Terminé → Validé**.

---

## 4. Guide par rôle

### 👨‍🔬 Technicien (accueil + analyses)

**Enregistrer un patient**
- Menu **Patients** → **+ Nouveau patient** → remplir la fiche → enregistrer.
- Un **matricule** unique est attribué automatiquement (ex. `P-2026-0001`).
- Le téléphone et l'e-mail doivent être uniques (pas de doublon).

**Créer un (ou plusieurs) examen(s)**
- Menu **Examens** → **+ Nouvel examen**.
- Saisir le **matricule du patient** puis lancer la recherche.
- **Cocher un ou plusieurs examens** du catalogue → le prix est repris automatiquement, le total s'affiche.
- Valider : les examens cochés ensemble forment **une commande** (une seule ligne dans le tableau).

**Encaisser un paiement**
- Menu **Paiements** → **+ Nouveau paiement**.
- Choisir la **commande** du patient → tous ses examens sont encaissés en une fois.
- Choisir le **mode** (espèces, Mobile Money, carte, virement) puis enregistrer.
- Bouton **🧾** : télécharger le **reçu** (un seul reçu pour toute la commande).

**Saisir un résultat**
- Menu **Examens** → cliquer sur la commande pour la déplier → ouvrir l'examen.
- (L'examen doit être **payé**.) Cliquer **Démarrer l'analyse**.
- Saisir les **paramètres et valeurs**, ajouter des observations → **Enregistrer**.
- L'examen passe en « Terminé », en attente de validation par le médecin.

---

### 🩺 Médecin (validation)

- À la connexion, vous arrivez sur la **liste des résultats** à traiter.
- Ouvrez un résultat saisi par le technicien, vérifiez les valeurs et les observations.
- Cliquez sur **Valider (médecin)**.
- Une fois validé : le résultat est **figé** (non modifiable) et un **lien de consultation** est généré pour le patient.
- Vous pouvez consulter les fiches patients en lecture seule depuis l'examen.

---

### 🛠️ Administrateur (gestion)

**Gérer le catalogue d'examens**
- Menu **Catalogue** → **+ Nouvel examen** : choisir un examen dans la liste déroulante et saisir son **prix**.
- Bouton **✨ Examens par défaut** : pré-remplit une sélection d'examens courants (à ajuster).
- ✏️ modifier un prix · 🗑️ retirer un examen du catalogue.

**Gérer le personnel**
- Menu **Personnel** → **+ Nouveau membre** : prénom, nom, e-mail, mot de passe, **rôle**.
- Communiquez ses identifiants au nouvel utilisateur.
- ✏️ modifier · 🗑️ retirer un membre (il perd alors l'accès).

**Suppressions** : seul l'administrateur peut supprimer patients, examens et paiements (y compris par sélection multiple). Un examen lié à un résultat ou un paiement ne peut pas être supprimé (sécurité).

---

## 5. Le patient consulte son résultat

- Le patient **ne se connecte pas** à l'application.
- Une fois le résultat **validé**, il reçoit un **lien sécurisé** (par SMS / e-mail / partage).
- Ce lien ouvre une page affichant **uniquement son résultat** (et permet d'en télécharger le PDF).

---

## 6. Bon à savoir

- **Mises à jour en direct** : les listes se rafraîchissent automatiquement quand un collègue saisit quelque chose (pas besoin de recharger la page).
- **Paiement obligatoire** avant toute analyse.
- **Recherche** : un champ de recherche en haut de chaque liste (par nom de patient, d'examen…).
- **Sécurité** : ne partagez jamais votre mot de passe. Déconnectez-vous sur un poste partagé.

---

*Pour toute question technique, contactez l'administrateur de l'application.*
