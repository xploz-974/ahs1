import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Le matcher ci-dessous exclut déjà /api/, mais certains adaptateurs
  // (ex. le runtime Next.js de Netlify) ne le respectent pas toujours —
  // on revérifie explicitement pour ne jamais rediriger un client API vers
  // /login.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
