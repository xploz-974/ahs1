import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client élevé (clé "secret") pour les routes /api/player/* : ces routes ne
// passent pas par une session Supabase Auth (les players s'authentifient
// avec leur propre JWT AHS1, vérifié séparément — voir lib/player-auth.ts),
// donc RLS n'a rien à évaluer ici. Chaque requête DOIT filtrer explicitement
// par organization_id / store_id issus du token vérifié.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secretKey = process.env.SUPABASE_SECRET_KEY!;
  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
