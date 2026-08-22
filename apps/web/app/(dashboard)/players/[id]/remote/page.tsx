import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RemoteControl } from "./remote-control";
import { SupportPanel } from "./support-panel";
import { ActivityPanel } from "./activity-panel";

export default async function PlayerRemotePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: player } = await supabase
    .from("players")
    .select("id, name, store_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!player) notFound();

  return (
    <div className="p-8">
      <RemoteControl playerId={player.id} playerName={player.name} />
      <div className="max-w-md">
        <ActivityPanel playerId={player.id} />
        <SupportPanel storeId={player.store_id} />
      </div>
    </div>
  );
}
