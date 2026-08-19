import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { CampaignEditor, type AssetRow, type Campaign, type StoreOption, type TrackOption } from "./campaign-editor";

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);

  const { data: campaign } = await supabase
    .from("advertisement_campaigns")
    .select(
      "id, name, start_date, end_date, start_time, end_time, passes_per_day, priority, status, version, advertisers(name)"
    )
    .eq("id", params.id)
    .maybeSingle()
    .returns<Campaign>();

  if (!campaign) notFound();

  const { data: assets } = await supabase
    .from("advertisement_assets")
    .select("id, audio_files(id, title, duration_ms)")
    .eq("campaign_id", params.id)
    .returns<AssetRow[]>();

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name")
    .order("name")
    .returns<StoreOption[]>();

  const { data: assignedStores } = await supabase
    .from("campaign_stores")
    .select("store_id")
    .eq("campaign_id", params.id);

  const { data: audioFiles } = await supabase
    .from("audio_files")
    .select("id, title, artists(name)")
    .eq("organization_id", organizationId ?? "")
    .eq("category", "advertisement")
    .order("title")
    .returns<TrackOption[]>();

  return (
    <div className="p-8">
      <CampaignEditor
        campaign={campaign}
        assets={assets ?? []}
        stores={stores ?? []}
        assignedStoreIds={(assignedStores ?? []).map((s) => s.store_id)}
        availableAssets={audioFiles ?? []}
      />
    </div>
  );
}
