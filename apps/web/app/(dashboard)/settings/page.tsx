import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { OrgNameForm } from "./org-name-form";
import { InviteForm } from "./invite-form";
import { MembersTable, type MemberRow } from "./members-table";
import { NotificationRulesPanel, type NotificationRuleRow } from "./notification-rules-panel";

export default async function SettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const organizationId = await getCurrentOrganizationId(supabase);

  const { data: organization } = organizationId
    ? await supabase.from("organizations").select("id, name").eq("id", organizationId).maybeSingle()
    : { data: null };

  const { data: members, error } = organizationId
    ? await supabase
        .from("organization_members")
        .select("id, role, user_id, users(email, full_name)")
        .eq("organization_id", organizationId)
        .order("created_at")
        .returns<MemberRow[]>()
    : { data: [], error: null };

  const { data: notificationRules } = organizationId
    ? await supabase
        .from("notification_rules")
        .select("alert_type, sound_enabled, browser_push_enabled")
        .eq("organization_id", organizationId)
        .returns<NotificationRuleRow[]>()
    : { data: [] };

  return (
    <div className="p-8">
      <h1 className="text-lg font-medium text-ink-100">Paramètres</h1>
      <p className="mt-1 text-sm text-ink-400">Organisation et équipe.</p>

      <h2 className="mb-2 mt-6 text-sm font-medium text-ink-200">Organisation</h2>
      <OrgNameForm initialName={organization?.name ?? ""} />

      <h2 className="mb-2 mt-8 text-sm font-medium text-ink-200">Inviter un membre</h2>
      <InviteForm />

      <h2 className="mb-2 mt-8 text-sm font-medium text-ink-200">Équipe</h2>
      {error && (
        <div className="rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
          Erreur : {error.message}
        </div>
      )}
      {!error && <MembersTable members={members ?? []} currentUserId={user?.id ?? null} />}

      <h2 className="mb-2 mt-8 text-sm font-medium text-ink-200">Notifications</h2>
      <NotificationRulesPanel rules={notificationRules ?? []} />
    </div>
  );
}
