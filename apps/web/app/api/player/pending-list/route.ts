import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Utilisé uniquement par l'écran d'activation (triple-tap sur "Code
// d'activation") pour éviter de retaper le code à la main pendant une
// installation sur site. Pas d'authentification possible à ce stade (le
// player n'est pas encore activé) — accès protégé par la découverte du geste
// plutôt que par un secret, sur le même principe que le mode diagnostic (§35).
// Ne renvoie que les players PENDING dont le code n'est pas expiré.
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("players")
    .select("id, name, activation_code, activation_code_expires_at, stores(name)")
    .eq("status", "PENDING")
    .not("activation_code", "is", null)
    .gt("activation_code_expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: "fetch_failed" }, { status: 500 });

  const players = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    storeName: (p.stores as unknown as { name: string } | null)?.name ?? null,
    activationCode: p.activation_code as string,
  }));

  return NextResponse.json({ players });
}
