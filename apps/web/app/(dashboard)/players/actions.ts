"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";

export type ActionState = { error: string | null; success: string | null };

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans caractères ambigus (0/O, 1/I)

function generateActivationCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (const b of bytes) raw += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `AHS1-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export async function createPlayer(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const name = String(formData.get("name") ?? "").trim();
  const storeId = String(formData.get("store_id") ?? "");
  const type = String(formData.get("type") ?? "ANDROID");

  if (!name || !storeId) {
    return { error: "Nom et magasin sont obligatoires.", success: null };
  }

  const activationCode = generateActivationCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("players").insert({
    organization_id: organizationId,
    store_id: storeId,
    name,
    type,
    status: "PENDING",
    activation_code: activationCode,
    activation_code_expires_at: expiresAt,
  });

  if (error) {
    return { error: `Échec de la création : ${error.message}`, success: null };
  }

  revalidatePath("/players");
  return { error: null, success: `Player créé — code : ${activationCode}` };
}

export async function regeneratePlayerCode(playerId: string): Promise<ActionState> {
  const supabase = createClient();
  const activationCode = generateActivationCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("players")
    .update({
      activation_code: activationCode,
      activation_code_expires_at: expiresAt,
      status: "PENDING",
      activated_at: null,
    })
    .eq("id", playerId);

  if (error) {
    return { error: `Échec : ${error.message}`, success: null };
  }

  revalidatePath("/players");
  return { error: null, success: `Nouveau code : ${activationCode}` };
}

export async function deletePlayer(playerId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("players").delete().eq("id", playerId);
  revalidatePath("/players");
}
