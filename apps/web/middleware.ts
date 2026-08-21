import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Le matcher ci-dessous exclut déjà /api/, mais certains adaptateurs
  // (ex. le runtime Next.js de Netlify) ne le respectent pas toujours —
  // on revérifie explicitement pour ne jamais rediriger un client API vers
  // /login.
  // /player n'est pas un compte Supabase Auth (c'est le lecteur lui-même,
  // authentifié par son propre JWT via localStorage) — jamais de redirect /login.
  if (request.nextUrl.pathname.startsWith("/api/") || request.nextUrl.pathname.startsWith("/player")) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api/|player|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
