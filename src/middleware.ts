import { NextRequest, NextResponse } from 'next/server';
import type { Role } from '@/types';

// Routes accessibles sans authentification
const PUBLIC_PATHS = ['/login'];

// Routes autorisées par rôle
// Un rôle a accès à toutes les routes de sa liste (startsWith)
const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  admin:      ['/dashboard'],
  medecin:    ['/dashboard'],
  technicien: ['/dashboard'],
  patient:    ['/mon-espace'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Laisser passer les routes publiques
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Lire le cookie de session posé par AuthContext après login
  //    Format attendu : JSON.stringify({ uid, role })
  const sessionCookie = request.cookies.get('session')?.value;

  if (!sessionCookie) {
    // Pas de session → redirection vers login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Décoder la session
  let session: { uid: string; role: Role } | null = null;
  try {
    session = JSON.parse(decodeURIComponent(sessionCookie));
  } catch {
    // Cookie corrompu → on l'efface et on redirige
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }

  if (!session?.role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 4. Vérifier que le rôle a accès à la route demandée
  const allowedPaths = ROLE_ALLOWED_PATHS[session.role] ?? [];
  const hasAccess    = allowedPaths.some((p) => pathname.startsWith(p));

  if (!hasAccess) {
    // Rôle authentifié mais route interdite → redirection vers son espace
    const fallback = ROLE_ALLOWED_PATHS[session.role]?.[0] ?? '/login';
    return NextResponse.redirect(new URL(fallback, request.url));
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
    '/mon-espace/:path*',
  ],
};