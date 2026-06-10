import { useState, useEffect } from "react";
import { subscribeStaff, updateUser, deleteUser } from "@/lib/firestore/users";
import { createStaff } from "@/lib/auth/createStaff";
import { logError } from "@/lib/logError";
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

  useEffect(() => {
    const unsub = subscribeStaff(
      (data) => {
        setStaff(data);
        setLoading(false);
      },
      (err) => {
        setError("Erreur lors du chargement du personnel");
        setLoading(false);
        logError(err, { scope: "personnel" });
      },
    );
    return () => unsub();
  }, []);

  const addStaff = async (data: NewStaff): Promise<void> => {
    await createStaff(data);
  };

  const editStaff = async (
    uid: string,
    data: Partial<Pick<User, "nom" | "prenom" | "role">>,
  ): Promise<void> => {
    await updateUser(uid, data);
  };

  const removeStaff = async (uid: string): Promise<void> => {
    await deleteUser(uid);
  };

  return {
    staff,
    loading,
    error,
    addStaff,
    editStaff,
    removeStaff,
  };
}
