"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import IdleLogout from "@/components/IdleLogout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !user) {
      router.replace("/login");
    }
  }, [mounted, user, loading, router]);

  // ✅ Avant montage — rendu identique serveur/client
  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="fixed top-0 left-0 h-screen w-64 bg-slate-900 z-40" />
        <div className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-slate-200 z-30" />
        <main className="ml-64 pt-16 min-h-screen">
          <div className="p-6" />
        </main>
      </div>
    );
  }

  // ✅ Spinner uniquement si loading sans cache
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-emerald-500 border-t-transparent
            rounded-full animate-spin mx-auto mb-3"
          />
          <p className="text-slate-400 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  // ✅ Pas connecté
  if (!user) return null;

  // ✅ Connecté — affichage normal
  return (
    <div className="min-h-screen bg-slate-50">
      <IdleLogout />
      <Sidebar />
      <Header />
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
