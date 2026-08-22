"use client";

import { useTransition } from "react";
import { removeMember, updateMemberRole } from "./actions";

export type MemberRow = {
  id: string;
  role: string;
  user_id: string;
  users: { email: string; full_name: string | null } | null;
};

const ROLES = ["owner", "admin", "manager", "viewer"] as const;

export function MembersTable({ members, currentUserId }: { members: MemberRow[]; currentUserId: string | null }) {
  const [pending, startAction] = useTransition();

  return (
    <div className="overflow-hidden rounded-lg border border-ink-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink-900 text-xs uppercase tracking-wide text-ink-400">
          <tr>
            <th className="px-4 py-3 font-medium">Membre</th>
            <th className="px-4 py-3 font-medium">Rôle</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700 bg-ink-950">
          {members.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-3 text-sm text-ink-400">
                Aucun membre.
              </td>
            </tr>
          )}
          {members.map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-3 text-ink-100">
                {m.users?.full_name ?? m.users?.email ?? "—"}
                {m.user_id === currentUserId && <span className="ml-2 text-xs text-ink-500">(toi)</span>}
              </td>
              <td className="px-4 py-3">
                <select
                  defaultValue={m.role}
                  disabled={pending}
                  onChange={(e) => {
                    const role = e.target.value as (typeof ROLES)[number];
                    startAction(async () => {
                      await updateMemberRole(m.id, role);
                    });
                  }}
                  className="rounded border border-ink-600 bg-ink-800 px-2 py-1 text-xs text-ink-100 outline-none focus:border-signal"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Retirer ${m.users?.email ?? "ce membre"} de l'organisation ?`)) {
                      startAction(async () => {
                        await removeMember(m.id);
                      });
                    }
                  }}
                  className="rounded-md border border-status-critical/40 px-2.5 py-1 text-xs text-status-critical transition hover:bg-status-critical/10"
                >
                  Retirer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
