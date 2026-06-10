"use client";

// Dernier filet de sécurité : capture les erreurs survenant dans le layout
// racine lui-même. Remplace tout le document → styles en ligne (le CSS global
// peut ne pas s'appliquer ici).

import { useEffect } from "react";
import { logError } from "@/lib/logError";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError(error, { digest: error.digest, boundary: "global" });
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1f5f9",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "1.5rem",
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            padding: "2rem",
            maxWidth: "28rem",
            width: "100%",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#0f172a",
              margin: "0 0 0.5rem",
            }}
          >
            Une erreur est survenue
          </h2>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#64748b",
              margin: "0 0 1.5rem",
            }}
          >
            L&apos;application a rencontré un problème inattendu. Réessayez ou
            rechargez la page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "0 1.25rem",
              height: "2.75rem",
              borderRadius: "0.75rem",
              background: "#059669",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
