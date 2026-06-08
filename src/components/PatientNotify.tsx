"use client";

import { useState } from "react";
import {
  buildMessage,
  whatsappUrl,
  smsUrl,
  emailUrl,
} from "@/lib/notify";
import type { Patient } from "@/types";

interface Props {
  patient: Patient;
  examenNom: string;
  lien: string;
}

export default function PatientNotify({ patient, examenNom, lien }: Props) {
  const [copied, setCopied] = useState(false);

  const message = buildMessage(patient.prenom, examenNom, lien);
  const hasTel = !!patient.telephone;
  const hasEmail = !!patient.email;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiez le lien du patient :", lien);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h2 className="font-bold text-slate-900 text-base mb-1">
        📤 Envoyer le résultat au patient
      </h2>
      <p className="text-sm text-slate-400 mb-4">
        Le message contient le lien sécurisé de consultation en ligne.
      </p>

      {/* Lien + copie */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          readOnly
          value={lien}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200
            bg-slate-50 text-sm text-slate-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={copier}
          className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800
            text-white text-sm font-semibold transition-colors whitespace-nowrap"
        >
          {copied ? "✓ Copié" : "Copier"}
        </button>
      </div>

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
          href={hasEmail ? emailUrl(patient.email!, examenNom, message) : undefined}
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
