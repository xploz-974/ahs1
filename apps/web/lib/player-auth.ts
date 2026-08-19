import "server-only";
import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1h
export const REFRESH_TOKEN_TTL_DAYS = 90;

function getSigningKey(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("SUPABASE_JWT_SECRET manquant");
  // Le secret est affiché en base64 par le dashboard Supabase (JWT Settings).
  return new Uint8Array(Buffer.from(secret, "base64"));
}

export interface PlayerClaims {
  playerId: string;
  organizationId: string;
  storeId: string;
}

// Signé avec le "Legacy JWT secret" du projet Supabase : ce même token peut
// donc servir de session Supabase (RLS auth_is_player() / auth_player_org_id()
// / auth_player_store_id() définies en migration 0001) si un accès direct
// devient nécessaire plus tard — pour l'instant nos routes /api/player/* font
// leur propre vérification + filtrage explicite avec la clé secret.
export async function signPlayerAccessToken(claims: PlayerClaims): Promise<string> {
  return new SignJWT({
    role: "authenticated",
    scope: "player",
    organization_id: claims.organizationId,
    store_id: claims.storeId,
    player_id: claims.playerId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.playerId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSigningKey());
}

export async function verifyPlayerAccessToken(token: string): Promise<PlayerClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey());
    if (payload.scope !== "player") return null;
    const organizationId = payload.organization_id;
    const storeId = payload.store_id;
    const playerId = payload.player_id;
    if (typeof organizationId !== "string" || typeof storeId !== "string" || typeof playerId !== "string") {
      return null;
    }
    return { playerId, organizationId, storeId };
  } catch {
    return null;
  }
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
