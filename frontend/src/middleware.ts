import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo ejecutar en rutas protegidas
  console.log(`[MIDDLEWARE] Checking: ${pathname}`);

  // Excluir rutas públicas
  if (pathname.startsWith('/login') || 
      pathname.startsWith('/_next') || 
      pathname.startsWith('/api') ||
      pathname === '/favicon.ico' ||
      pathname.includes('.')) {
    console.log(`[MIDDLEWARE] Public route: ${pathname}`);
    return NextResponse.next();
  }

  // Verificar cookie de sesión
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
