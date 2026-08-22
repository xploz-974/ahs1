"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";

export type ActionState = { error: string | null; success: string | null };

export async function createZone(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const name = String(formData.get("name") ?? "").trim();
  const storeId = String(formData.get("store_id") ?? "");
  if (!name || !storeId) {
    return { error: "Nom et magasin sont obligatoires.", success: null };
  }

  const { error } = await supabase.from("player_zones").insert({
    organization_id: organizationId,
    store_id: storeId,
    name,
  });

  if (error) {
    return { error: `Échec de la création : ${error.message}`, success: null };
  }

  revalidatePath("/zones");
  return { error: null, success: `Zone « ${name} » créée.` };
}

export async function deleteZone(zoneId: string): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("player_zones").delete().eq("id", zoneId);
  if (error) {
    return { error: `Échec : ${error.message}`, success: null };
  }
  revalidatePath("/zones");
  return { error: null, success: "Zone supprimée." };
}

export async function setZoneLeader(zoneId: string, leaderPlayerId: string | null): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("player_zones").update({ leader_player_id: leaderPlayerId }).eq("id", zoneId);
  if (error) {
    return { error: `Échec : ${error.message}`, success: null };
  }
  revalidatePath("/zones");
  return { error: null, success: "Leader mis à jour." };
}

export async function assignPlayerToZone(playerId: string, zoneId: string | null): Promise<ActionState> {
  const supabase = createClient();

  // Un player retiré d'une zone ne doit plus être désigné comme son leader.
  if (zoneId === null) {
    await supabase.from("player_zones").update({ leader_player_id: null }).eq("leader_player_id", playerId);
  }

  const { error } = await supabase.from("players").update({ zone_id: zoneId }).eq("id", playerId);
  if (error) {
    return { error: `Échec : ${error.message}`, success: null };
  }
  revalidatePath("/zones");
  return { error: null, success: "Affectation mise à jour." };
}
