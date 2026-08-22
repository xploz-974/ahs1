"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";

export type ActionState = { error: string | null; success: string | null };

export async function createStore(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const name = String(formData.get("name") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "Indian/Reunion").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!name) {
    return { error: "Le nom du magasin est obligatoire.", success: null };
  }

  const { error } = await supabase.from("stores").insert({
    organization_id: organizationId,
    name,
    region: region || null,
    timezone: timezone || "Indian/Reunion",
    address: address || null,
  });

  if (error) {
    return { error: `Échec de la création : ${error.message}`, success: null };
  }

  revalidatePath("/stores");
  return { error: null, success: `Magasin « ${name} » créé.` };
}

export async function updateStore(
  storeId: string,
  fields: { name: string; region: string; timezone: string; address: string }
): Promise<ActionState> {
  const supabase = createClient();
  const name = fields.name.trim();
  if (!name) {
    return { error: "Le nom du magasin est obligatoire.", success: null };
  }

  const { error } = await supabase
    .from("stores")
    .update({
      name,
      region: fields.region.trim() || null,
      timezone: fields.timezone.trim() || "Indian/Reunion",
      address: fields.address.trim() || null,
    })
    .eq("id", storeId);

  if (error) {
    return { error: `Échec de la mise à jour : ${error.message}`, success: null };
  }

  revalidatePath("/stores");
  return { error: null, success: "Magasin mis à jour." };
}

export async function deleteStore(storeId: string): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("stores").delete().eq("id", storeId);
  if (error) {
    return { error: `Suppression impossible : ${error.message}`, success: null };
  }
  revalidatePath("/stores");
  return { error: null, success: "Magasin supprimé." };
}
