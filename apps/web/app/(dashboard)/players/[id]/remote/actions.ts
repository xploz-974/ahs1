"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";

export interface SupportMessageRow {
  id: string;
  sender: "store" | "admin";
  sender_name: string | null;
  body: string;
  created_at: string;
}

export async function getSupportMessages(storeId: string): Promise<SupportMessageRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("support_messages")
    .select("id, sender, sender_name, body, created_at")
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

export interface StoreContactRow {
  id: string;
  name: string;
}

const MAX_CONTACTS = 3;

export async function getStoreContacts(storeId: string): Promise<StoreContactRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("store_contacts")
    .select("id, name")
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function addStoreContact(storeId: string, name: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) return { error: "Aucune organisation associée à ce compte." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Nom vide." };

  const { count } = await supabase
    .from("store_contacts")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);
  if ((count ?? 0) >= MAX_CONTACTS) {
    return { error: `Maximum ${MAX_CONTACTS} contacts par magasin.` };
  }

  const { error } = await supabase
    .from("store_contacts")
    .insert({ organization_id: organizationId, store_id: storeId, name: trimmed });

  if (error) return { error: error.message };
  return { error: null };
}

export async function removeStoreContact(contactId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("store_contacts").delete().eq("id", contactId);
}

export interface ActivityEntry {
  id: string;
  type: "MUSIC" | "ADVERTISEMENT" | "JINGLE";
  played_at: string;
}

export async function getRecentActivity(storeId: string): Promise<ActivityEntry[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("playback_history")
    .select("id, type, played_at")
    .eq("store_id", storeId)
    .order("played_at", { ascending: false })
    .limit(15);
  return data ?? [];
}
