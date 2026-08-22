"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrganizationId } from "@/lib/org";

export type ActionState = { error: string | null; success: string | null };

const ROLES = ["owner", "admin", "manager", "viewer"] as const;
type Role = (typeof ROLES)[number];

export async function updateOrganizationName(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Le nom de l'organisation est obligatoire.", success: null };
  }

  const { error } = await supabase.from("organizations").update({ name }).eq("id", organizationId);
  if (error) {
    return { error: `Échec : ${error.message}`, success: null };
  }

  revalidatePath("/settings");
  return { error: null, success: "Organisation mise à jour." };
}

export async function inviteMember(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "viewer") as Role;
  if (!email || !ROLES.includes(role)) {
    return { error: "Email et rôle valides sont obligatoires.", success: null };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin.from("users").select("id").eq("email", email).maybeSingle();

  let userId = existing?.id ?? null;

  if (!userId) {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invited.user) {
      return {
        error: `Échec de l'invitation : ${inviteError?.message ?? "utilisateur non créé"}. Vérifie la configuration email (SMTP) du projet Supabase.`,
        success: null,
      };
    }
    userId = invited.user.id;
    await admin.from("users").insert({ id: userId, email });
  }

  const { error: memberError } = await admin
    .from("organization_members")
    .upsert({ organization_id: organizationId, user_id: userId, role }, { onConflict: "organization_id,user_id" });

  if (memberError) {
    return { error: `Échec : ${memberError.message}`, success: null };
  }

  revalidatePath("/settings");
  return { error: null, success: `Invitation envoyée à ${email}.` };
}

// organization_members n'a qu'une policy RLS SELECT (pas de write) : on
// passe par le client admin pour update/delete, en revérifiant nous-mêmes
// que l'appelant est bien membre de la même organisation que la cible.
export async function updateMemberRole(memberId: string, role: Role): Promise<ActionState> {
  if (!ROLES.includes(role)) {
    return { error: "Rôle invalide.", success: null };
  }
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organization_members")
    .update({ role })
    .eq("id", memberId)
    .eq("organization_id", organizationId);

  if (error) {
    return { error: `Échec : ${error.message}`, success: null };
  }
  revalidatePath("/settings");
  return { error: null, success: "Rôle mis à jour." };
}

export async function setNotificationRule(
  alertType: string,
  fields: { soundEnabled?: boolean; browserPushEnabled?: boolean }
): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const { data: existing } = await supabase
    .from("notification_rules")
    .select("sound_enabled, browser_push_enabled")
    .eq("organization_id", organizationId)
    .eq("alert_type", alertType)
    .maybeSingle();

  const { error } = await supabase.from("notification_rules").upsert(
    {
      organization_id: organizationId,
      alert_type: alertType,
      sound_enabled: fields.soundEnabled ?? existing?.sound_enabled ?? true,
      browser_push_enabled: fields.browserPushEnabled ?? existing?.browser_push_enabled ?? false,
    },
    { onConflict: "organization_id,alert_type" }
  );

  if (error) {
    return { error: `Échec : ${error.message}`, success: null };
  }
  revalidatePath("/settings");
  return { error: null, success: null };
}

export async function removeMember(memberId: string): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", organizationId);

  if (error) {
    return { error: `Échec : ${error.message}`, success: null };
  }
  revalidatePath("/settings");
  return { error: null, success: "Membre retiré." };
}
