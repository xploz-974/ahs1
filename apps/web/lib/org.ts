import type { SupabaseClient } from "@supabase/supabase-js";

// MVP : un utilisateur admin est rattaché à une seule organisation.
// Si plusieurs organisations doivent être supportées par utilisateur,
// remplacer par un sélecteur d'organisation actif (Phase ultérieure).
export async function getCurrentOrganizationId(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return data?.organization_id ?? null;
}
