"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";

export interface SupportMessageRow {
  id: string;
  sender: "store" | "admin";
  body: string;
  created_at: string;
}

export async function getSupportMessages(storeId: string): Promise<SupportMessageRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("support_messages")
    .select("id, sender, body, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: true })
    .limit(200);
  return data ?? [];
}

export async function sendAdminSupportMessage(storeId: string, body: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) return { error: "Aucune organisation associée à ce compte." };

  const text = body.trim();
  if (!text) return { error: "Message vide." };

  const { error } = await supabase.from("support_messages").insert({
    organization_id: organizationId,
    store_id: storeId,
    sender: "admin",
    body: text,
  });

  if (error) return { error: error.message };
  revalidatePath("/support");
  return { error: null };
}
