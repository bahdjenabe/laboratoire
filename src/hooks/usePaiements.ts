import { useState, useEffect } from 'react';
import {
  subscribePaiements,
  createPaiement,
  createPaiements,
  updatePaiement,
  deletePaiement,
} from '@/lib/firestore/paiements';
import { logError } from '@/lib/logError';
import type { Paiement } from '@/types';

export function usePaiements() {
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribePaiements(
      (data) => {
        setPaiements(data);
        setLoading(false);
      },
      (err) => {
        setError('Erreur lors du chargement des paiements');
        setLoading(false);
        logError(err, { scope: 'paiements' });
      },
    );
    return () => unsub();
  }, []);

  const addPaiement = async (
    data: Omit<Paiement, 'id' | 'createdAt'>
  ): Promise<void> => {
    await createPaiement(data);
  };

  // Encaissement groupé atomique (tous les examens d'une commande).
  const addPaiements = async (
    items: Omit<Paiement, 'id' | 'createdAt'>[]
  ): Promise<void> => {
    await createPaiements(items);
  };

  const editPaiement = async (
    id: string,
    data: Partial<Omit<Paiement, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await updatePaiement(id, data);
  };

  const removePaiement = async (id: string): Promise<void> => {
    await deletePaiement(id);
  };

  return {
    paiements,
    loading,
    error,
    addPaiement,
    addPaiements,
    editPaiement,
    removePaiement,
  };
}
