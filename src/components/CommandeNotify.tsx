"use client";

// Partage groupé : envoie au patient, en un seul message, les liens sécurisés
// de tous les résultats validés d'une commande (WhatsApp / SMS / Email).

import { useState } from "react";
import {
  buildMessageGroupe,
  whatsappUrl,
  smsUrl,
  emailUrl,
} from "@/lib/notify";
import type { Patient } from "@/types";

export interface ResultatPartage {
  examenNom: string;
  lien: string;
}

interface Props {
  patient: Patient;
  resultats: ResultatPartage[];
}

export default function CommandeNotify({ patient, resultats }: Props) {
  const [copied, setCopied] = useState(false);

  const message = buildMessageGroupe(patient.prenom, resultats);
  const hasTel = !!patient.telephone;
  const hasEmail = !!patient.email;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiez les liens du patient :", message);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h2 className="font-bold text-slate-900 text-base mb-1">
        📤 Envoyer {resultats.length} résultat{resultats.length > 1 ? "s" : ""}{" "}
        au patient
      </h2>
      <p className="text-sm text-slate-400 mb-4">
        Un seul message contenant les liens sécurisés de tous les examens
        validés de la commande.
      </p>

      {/* Liste des liens */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-100 mb-3 max-h-44 overflow-y-auto">
        {resultats.map((r) => (
          <div key={r.lien} className="px-3 py-2">
            <p className="text-sm font-medium text-slate-700 truncate">
              {r.examenNom}
            </p>
            <p className="text-xs text-slate-400 truncate">{r.lien}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={copier}
        className="w-full h-11 mb-3 rounded-xl bg-slate-900 hover:bg-slate-800
          text-white text-sm font-semibold transition-colors"
      >
        {copied ? "✓ Message copié" : "Copier le message (tous les liens)"}
      </button>

      {/* Canaux */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <a
          href={hasTel ? whatsappUrl(patient.telephone, message) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!hasTel}
          className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-colors
            ${
              hasTel
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-slate-100 text-slate-400 pointer-events-none"
            }`}
        >
          🟢 WhatsApp
        </a>
        <a
          href={hasTel ? smsUrl(patient.telephone, message) : undefined}
          aria-disabled={!hasTel}
          className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-colors
            ${
              hasTel
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-slate-100 text-slate-400 pointer-events-none"
            }`}
        >
          💬 SMS
        </a>
        <a
          href={
            hasEmail
              ? emailUrl(patient.email!, "vos résultats", message)
              : undefined
          }
          aria-disabled={!hasEmail}
          className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-colors
            ${
              hasEmail
                ? "bg-violet-600 hover:bg-violet-700 text-white"
                : "bg-slate-100 text-slate-400 pointer-events-none"
            }`}
        >
          ✉️ Email
        </a>
      </div>

      {(!hasTel || !hasEmail) && (
        <p className="text-xs text-slate-400 mt-3">
          {!hasTel && "Aucun téléphone enregistré pour ce patient. "}
          {!hasEmail && "Aucun e-mail enregistré pour ce patient."}
        </p>
      )}
    </div>
  );
}
