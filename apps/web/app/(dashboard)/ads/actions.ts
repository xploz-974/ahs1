"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";

export type ActionState = { error: string | null; success: string | null };

async function findOrCreateAdvertiser(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  name: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("advertisers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("advertisers")
    .insert({ organization_id: organizationId, name })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

async function bumpVersion(supabase: ReturnType<typeof createClient>, campaignId: string) {
  const { data } = await supabase
    .from("advertisement_campaigns")
    .select("version")
    .eq("id", campaignId)
    .single();
  await supabase
    .from("advertisement_campaigns")
    .update({ version: (data?.version ?? 1) + 1 })
    .eq("id", campaignId);
}

export async function createCampaign(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const name = String(formData.get("name") ?? "").trim();
  const advertiserName = String(formData.get("advertiser") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");

  if (!name || !advertiserName || !startDate || !endDate) {
    return { error: "Nom, client, date de début et date de fin sont obligatoires.", success: null };
  }

  let advertiserId: string;
  try {
    advertiserId = await findOrCreateAdvertiser(supabase, organizationId, advertiserName);
  } catch (e) {
    const message = e instanceof Error ? e.message : "erreur inconnue";
    return { error: `Échec de la résolution du client : ${message}`, success: null };
  }

  const { data, error } = await supabase
    .from("advertisement_campaigns")
    .insert({
      organization_id: organizationId,
      advertiser_id: advertiserId,
      name,
      start_date: startDate,
      end_date: endDate,
    })
    .select("id")
    .single();

  if (error) {
    return { error: `Échec de la création : ${error.message}`, success: null };
  }

  redirect(`/ads/${data.id}`);
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("advertisement_campaigns").delete().eq("id", campaignId);
  revalidatePath("/ads");
  redirect("/ads");
}

export interface UpdateCampaignInput {
  id: string;
  name: string;
  advertiserName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  passesPerDay: number | null;
  priority: number;
  status: string;
}

export async function updateCampaignMeta(input: UpdateCampaignInput): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const name = input.name.trim();
  const advertiserName = input.advertiserName.trim();
  if (!name || !advertiserName) {
    return { error: "Nom et client sont obligatoires.", success: null };
  }

  let advertiserId: string;
  try {
    advertiserId = await findOrCreateAdvertiser(supabase, organizationId, advertiserName);
  } catch (e) {
    const message = e instanceof Error ? e.message : "erreur inconnue";
    return { error: `Échec de la résolution du client : ${message}`, success: null };
  }

  const { error } = await supabase
    .from("advertisement_campaigns")
    .update({
      name,
      advertiser_id: advertiserId,
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime || null,
      end_time: input.endTime || null,
      passes_per_day: input.passesPerDay,
      priority: input.priority,
      status: input.status,
    })
    .eq("id", input.id);

  if (error) {
    return { error: `Échec de la mise à jour : ${error.message}`, success: null };
  }

  await bumpVersion(supabase, input.id);
  revalidatePath(`/ads/${input.id}`);
  revalidatePath("/ads");
  return { error: null, success: "Campagne mise à jour." };
}

export async function addAssetToCampaign(campaignId: string, audioFileId: string): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase
    .from("advertisement_assets")
    .insert({ campaign_id: campaignId, audio_file_id: audioFileId });

  if (error) {
    return { error: `Échec de l'ajout : ${error.message}`, success: null };
  }

  await bumpVersion(supabase, campaignId);
  revalidatePath(`/ads/${campaignId}`);
  return { error: null, success: null };
}

export async function removeAssetFromCampaign(campaignId: string, assetId: string): Promise<ActionState> {
  const supabase = createClient();
  const { error } = await supabase.from("advertisement_assets").delete().eq("id", assetId);

  if (error) {
    return { error: `Échec de la suppression : ${error.message}`, success: null };
  }

  await bumpVersion(supabase, campaignId);
  revalidatePath(`/ads/${campaignId}`);
  return { error: null, success: null };
}

export async function setCampaignStores(campaignId: string, storeIds: string[]): Promise<ActionState> {
  const supabase = createClient();

  await supabase.from("campaign_stores").delete().eq("campaign_id", campaignId);

  if (storeIds.length > 0) {
    const { error } = await supabase
      .from("campaign_stores")
      .insert(storeIds.map((storeId) => ({ campaign_id: campaignId, store_id: storeId })));
    if (error) {
      return { error: `Échec de l'affectation : ${error.message}`, success: null };
    }
  }

  await bumpVersion(supabase, campaignId);
  revalidatePath(`/ads/${campaignId}`);
  return { error: null, success: "Magasins mis à jour." };
}
