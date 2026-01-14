import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * @deprecated Esta file convention está deprecada.
 * Usar 'rewrites' con 'beforeFiles' en next.config.ts en su lugar.
 * Este código se mantiene para compatibilidad hacia atrás.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo ejecutar en rutas protegidas
  console.log(`[MIDDLEWARE] Checking: ${pathname}`);

  // Rutas públicas (no requieren login)
  const publicRoutes = [
    '/login',
    '/register',
    '/', // ← Catálogo público
    '/_next',
    '/api',
    '/favicon.ico',
  ];

  // Excluir rutas públicas
  if (publicRoutes.includes(pathname) || 
      pathname.startsWith('/_next') || 
      pathname.startsWith('/api') ||
      pathname === '/favicon.ico' ||
      pathname.includes('.')) {
    console.log(`[MIDDLEWARE] Public route: ${pathname}`);
    return NextResponse.next();
  }

  // Verificar cookie de sesión para rutas protegidas
  const sessionCookie = request.cookies.get('sky_sid');
  console.log(`[MIDDLEWARE] Session cookie: ${sessionCookie ? 'EXISTS' : 'MISSING'}`);

  if (!sessionCookie || !sessionCookie.value) {
    console.log(`[MIDDLEWARE] Redirecting to login from: ${pathname}`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  console.log(`[MIDDLEWARE] Allowing access to: ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
