// Horodatage PERSISTANT (localStorage) de la dernière activité utilisateur.
//
// Partagé entre :
//  - IdleLogout (minuteur d'inactivité du dashboard) ;
//  - AuthContext (refus de restaurer une session inactive au démarrage).
//
// Sans persistance, un rechargement de page (ou le déchargement de l'onglet
// par le navigateur pendant la veille du PC) remettait le compteur à zéro :
// Firebase restaurait la session et l'utilisateur restait connecté
// indéfiniment malgré le délai d'inactivité de 2 h.

export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 heures

const KEY = "labmedical_last_activity";

export function getLastActivity(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    const t = raw ? Number(raw) : NaN;
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

export function touchActivity(): void {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // localStorage indisponible : le minuteur en mémoire reste le fallback.
  }
}

export function clearActivity(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Sans importance : une valeur orpheline est écrasée au prochain login.
  }
}

// Vrai si la dernière activité enregistrée dépasse le délai d'inactivité.
// (Aucune valeur enregistrée = pas d'expiration : session toute fraîche.)
export function isIdleExpired(): boolean {
  const t = getLastActivity();
  return t !== null && Date.now() - t >= IDLE_TIMEOUT_MS;
}
