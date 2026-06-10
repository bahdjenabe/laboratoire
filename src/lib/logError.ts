// Point d'entrée UNIQUE pour journaliser les erreurs de l'application.
// Aujourd'hui : trace en console (visible dans la console navigateur et, côté
// serveur, dans les logs Vercel). Demain : pour activer un service de
// monitoring (Sentry, LogRocket…), il suffit de brancher ici — un seul
// endroit à modifier dans tout le code.

export type ErrorContext = Record<string, unknown>;

export function logError(error: unknown, context?: ErrorContext): void {
  if (context && Object.keys(context).length > 0) {
    console.error("[labo-app]", error, context);
  } else {
    console.error("[labo-app]", error);
  }

  // Crochet optionnel de capture externe : un fichier d'init (ex. Sentry)
  // peut définir globalThis.__captureError = Sentry.captureException.
  // Inerte tant qu'aucun service n'est configuré → aucun risque en prod.
  const hook = (
    globalThis as {
      __captureError?: (e: unknown, c?: ErrorContext) => void;
    }
  ).__captureError;
  if (typeof hook === "function") {
    try {
      hook(error, context);
    } catch {
      // Le monitoring ne doit jamais casser l'application.
    }
  }
}
