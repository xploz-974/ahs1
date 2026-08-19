"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { bumpStoreManifest } from "@/lib/manifest";

export type ActionState = { error: string | null; success: string | null };

export async function createJingle(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const audioFileId = String(formData.get("audio_file_id") ?? "");
  const storeId = String(formData.get("store_id") ?? "");
  const frequency = Number(formData.get("frequency") ?? 5);
  const priority = Number(formData.get("priority") ?? 0);
  const startDate = String(formData.get("start_date") ?? "") || null;
  const endDate = String(formData.get("end_date") ?? "") || null;

  if (!audioFileId || !storeId) {
    return { error: "Fichier audio et magasin sont obligatoires.", success: null };
  }

  const { error } = await supabase.from("jingles").insert({
    organization_id: organizationId,
    audio_file_id: audioFileId,
    store_id: storeId,
    frequency_every_n_tracks: frequency,
    priority,
    start_date: startDate,
    end_date: endDate,
  });

  if (error) {
    return { error: `Échec de la création : ${error.message}`, success: null };
  }

  await bumpStoreManifest(supabase, storeId, organizationId, ["jingles_version"]);
  revalidatePath("/jingles");
  return { error: null, success: "Jingle créé." };
}

export interface UpdateJingleInput {
  id: string;
  storeId: string;
  frequency: number;
  priority: number;
  startDate: string;
  endDate: string;
  status: string;
}

export async function updateJingle(input: UpdateJingleInput): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);

  const { data: previous } = await supabase.from("jingles").select("store_id").eq("id", input.id).maybeSingle();

  const { error } = await supabase
    .from("jingles")
    .update({
      store_id: input.storeId,
      frequency_every_n_tracks: input.frequency,
      priority: input.priority,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      status: input.status,
    })
    .eq("id", input.id);

  if (error) {
    return { error: `Échec de la mise à jour : ${error.message}`, success: null };
  }

  if (organizationId) {
    await bumpStoreManifest(supabase, input.storeId, organizationId, ["jingles_version"]);
    if (previous && previous.store_id !== input.storeId) {
      await bumpStoreManifest(supabase, previous.store_id, organizationId, ["jingles_version"]);
    }
  }
  revalidatePath("/jingles");
  return { error: null, success: "Jingle mis à jour." };
}

export async function deleteJingle(id: string): Promise<void> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  const { data: previous } = await supabase.from("jingles").select("store_id").eq("id", id).maybeSingle();

  await supabase.from("jingles").delete().eq("id", id);

  if (organizationId && previous) {
    await bumpStoreManifest(supabase, previous.store_id, organizationId, ["jingles_version"]);
  }
  revalidatePath("/jingles");
}
