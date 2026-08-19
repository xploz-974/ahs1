import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", enabled: true },
  { label: "Bibliothèque", href: "/library", enabled: true },
  { label: "Playlists", href: "/playlists", enabled: true },
  { label: "Jingles", href: "/jingles", enabled: false },
  { label: "Publicités", href: "/ads", enabled: true },
  { label: "Programmation", href: "/schedule", enabled: false },
  { label: "Magasins", href: "/stores", enabled: false },
  { label: "Players", href: "/players", enabled: false },
  { label: "Statistiques", href: "/stats", enabled: false },
  { label: "Historique", href: "/history", enabled: false },
  { label: "Alertes", href: "/alerts", enabled: false },
  { label: "Paramètres", href: "/settings", enabled: false },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-5 py-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">AHS1</p>
          <p className="mt-0.5 text-sm text-ink-200">Audio Hub Stream</p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) =>
            item.enabled ? (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm text-ink-200 transition hover:bg-ink-800 hover:text-ink-100"
              >
                {item.label}
              </Link>
            ) : (
              <div
                key={item.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-ink-600"
              >
                <span>{item.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-600">
                  bientôt
                </span>
              </div>
            )
          )}
        </nav>

        <div className="border-t border-ink-700 px-3 py-4">
          <p className="truncate px-3 text-xs text-ink-400">{user?.email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-1 w-full rounded-md px-3 py-1.5 text-left text-sm text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
