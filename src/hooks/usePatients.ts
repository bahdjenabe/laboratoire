import { useState, useEffect, useCallback } from 'react';
import {
  getPatients,
  createPatient,
  updatePatient,
  deletePatient,
  assignMissingNumeros,
} from '@/lib/firestore/patients';
import type { Patient } from '@/types';

export function usePatients() {
  const [patients, setPatients]   = useState<Patient[]>([]);
  const [loading, setLoading]     = useState<boolean>(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPatients();
      setPatients(data);
    } catch (err) {
      setError('Erreur lors du chargement des patients');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const addPatient = async (
    data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const numero = await createPatient(data);
    await fetchPatients();
    return numero;
  };

  // Migration : attribue un matricule aux patients qui n'en ont pas encore.
  const backfillNumeros = async (): Promise<number> => {
    const count = await assignMissingNumeros();
    await fetchPatients();
    return count;
  };

  const editPatient = async (
    id: string,
    data: Partial<Omit<Patient, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await updatePatient(id, data);
    await fetchPatients();
  };

  const removePatient = async (id: string): Promise<void> => {
    await deletePatient(id);
    await fetchPatients();
  };

  return {
    patients,
    loading,
    error,
    fetchPatients,
    addPatient,
    editPatient,
    removePatient,
    backfillNumeros,
  };
}