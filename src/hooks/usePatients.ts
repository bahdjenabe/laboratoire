import { useState, useEffect } from 'react';
import {
  subscribePatients,
  createPatient,
  updatePatient,
  deletePatient,
  archivePatient,
  restorePatient,
  assignMissingNumeros,
} from '@/lib/firestore/patients';
import { logError } from '@/lib/logError';
import type { Patient } from '@/types';

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading]   = useState<boolean>(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribePatients(
      (data) => {
        setPatients(data);
        setLoading(false);
      },
      (err) => {
        setError('Erreur lors du chargement des patients');
        setLoading(false);
        logError(err, { scope: 'patients' });
      },
    );
    return () => unsub();
  }, []);

  const addPatient = async (
    data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    return createPatient(data);
  };

  // Migration : attribue un matricule aux patients qui n'en ont pas encore.
  const backfillNumeros = async (): Promise<number> => {
    return assignMissingNumeros();
  };

  const editPatient = async (
    id: string,
    data: Partial<Omit<Patient, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await updatePatient(id, data);
  };

  const removePatient = async (id: string): Promise<void> => {
    await deletePatient(id);
  };

  // Suppression douce : archive / restaure un patient.
  const archive = async (id: string): Promise<void> => {
    await archivePatient(id);
  };

  const restore = async (id: string): Promise<void> => {
    await restorePatient(id);
  };

  return {
    patients,
    loading,
    error,
    addPatient,
    editPatient,
    removePatient,
    archive,
    restore,
    backfillNumeros,
  };
}
