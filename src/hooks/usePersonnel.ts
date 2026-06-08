import { useState, useEffect, useCallback } from "react";
import { getStaff, updateUser, deleteUser } from "@/lib/firestore/users";
import { createStaff } from "@/lib/auth/createStaff";
import type { Role, User } from "@/types";

interface NewStaff {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  role: Role;
}

export function usePersonnel() {
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getStaff();
      setStaff(data);
    } catch (err) {
      setError("Erreur lors du chargement du personnel");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const addStaff = async (data: NewStaff): Promise<void> => {
    await createStaff(data);
    await fetchStaff();
  };

  const editStaff = async (
    uid: string,
    data: Partial<Pick<User, "nom" | "prenom" | "role">>,
  ): Promise<void> => {
    await updateUser(uid, data);
    await fetchStaff();
  };

  const removeStaff = async (uid: string): Promise<void> => {
    await deleteUser(uid);
    await fetchStaff();
  };

  return {
    staff,
    loading,
    error,
    fetchStaff,
    addStaff,
    editStaff,
    removeStaff,
  };
}
