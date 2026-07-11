// middleware.ts — Aplica la lógica de `authorized` de auth.config a cada request
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  // Excluye archivos estáticos, _next y la carpeta uploads (servidas con auth en su endpoint)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.svg$|public).*)'],
};
