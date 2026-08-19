import "server-only";
import { NextResponse } from "next/server";
import { extractBearerToken, verifyPlayerAccessToken, type PlayerClaims } from "@/lib/player-auth";

export async function requirePlayerAuth(
  request: Request
): Promise<{ claims: PlayerClaims } | { error: NextResponse }> {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return { error: NextResponse.json({ error: "missing_bearer_token" }, { status: 401 }) };
  }

  const claims = await verifyPlayerAccessToken(token);
  if (!claims) {
    return { error: NextResponse.json({ error: "invalid_or_expired_token" }, { status: 401 }) };
  }

  return { claims };
}
