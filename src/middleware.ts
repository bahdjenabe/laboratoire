import { NextRequest, NextResponse } from 'next/server';
import type { Role } from '@/types';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

// Routes accessibles sans authentification
const PUBLIC_PATHS = ['/login'];

// Routes autorisées par rôle
// Un rôle a accès à toutes les routes de sa liste (startsWith)
const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  admin:      ['/dashboard'],
  medecin:    ['/dashboard'],
  technicien: ['/dashboard'],
};

// Routes interdites par rôle (priment sur ROLE_ALLOWED_PATHS).
// Le technicien saisit les résultats via la fiche examen ; la consultation
// de la liste des résultats est réservée au médecin et à l'admin.
const ROLE_DENIED_PATHS: Partial<Record<Role, string[]>> = {
  technicien: ['/dashboard/resultats'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Laisser passer les routes publiques
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Lire le cookie de session (JWT signé posé par /api/session)
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionCookie) {
    // Pas de session → redirection vers login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Vérifier la signature et l'expiration du cookie (non falsifiable)
  const session = await verifySession(sessionCookie);

  if (!session?.role) {
    // Cookie invalide/expiré/falsifié → on l'efface et on redirige
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  // 4. Vérifier que le rôle a accès à la route demandée
  const allowedPaths = ROLE_ALLOWED_PATHS[session.role] ?? [];
  const hasAccess    = allowedPaths.some((p) => pathname.startsWith(p));

  if (!hasAccess) {
    // Rôle authentifié mais route interdite → redirection vers son espace
    const fallback = ROLE_ALLOWED_PATHS[session.role]?.[0] ?? '/login';
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  // 5. Routes explicitement interdites pour ce rôle (denylist)
  const deniedPaths = ROLE_DENIED_PATHS[session.role] ?? [];
  if (deniedPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/dashboard/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/patients/:path*',
    '/examens/:path*',
    '/resultats/:path*',
    '/paiements/:path*',
    '/personnel/:path*',
  ],
};