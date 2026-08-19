"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const CATEGORY_OPTIONS = [
  { value: "", label: "Toutes catégories" },
  { value: "music", label: "Musique" },
  { value: "jingle", label: "Jingle" },
  { value: "advertisement", label: "Publicité" },
];

const SORT_OPTIONS = [
  { value: "created_at:desc", label: "Plus récent" },
  { value: "created_at:asc", label: "Plus ancien" },
  { value: "title:asc", label: "Titre A→Z" },
  { value: "title:desc", label: "Titre Z→A" },
  { value: "duration_ms:asc", label: "Durée croissante" },
  { value: "duration_ms:desc", label: "Durée décroissante" },
];

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const inputClass =
    "rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        defaultValue={searchParams.get("category") ?? ""}
        onChange={(e) => updateParam("category", e.target.value)}
        className={inputClass}
      >
        {CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        defaultValue={searchParams.get("sort") ?? "created_at:desc"}
        onChange={(e) => updateParam("sort", e.target.value)}
        className={inputClass}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Filtrer par artiste…"
        defaultValue={searchParams.get("artist") ?? ""}
        onBlur={(e) => updateParam("artist", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") updateParam("artist", e.currentTarget.value);
        }}
        className={inputClass}
      />
    </div>
  );
}
