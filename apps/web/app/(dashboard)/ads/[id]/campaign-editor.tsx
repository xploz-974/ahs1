"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  addAssetToCampaign,
  deleteCampaign,
  removeAssetFromCampaign,
  setCampaignStores,
  updateCampaignMeta,
} from "../actions";

export type AssetRow = { id: string; audio_files: { id: string; title: string; duration_ms: number } | null };
export type StoreOption = { id: string; name: string };
export type TrackOption = { id: string; title: string; artists: { name: string } | null };

export type Campaign = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  passes_per_day: number | null;
  priority: number;
  status: string;
  version: number;
  advertisers: { name: string } | null;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function CampaignEditor({
  campaign,
  assets,
  stores,
  assignedStoreIds,
  availableAssets,
}: {
  campaign: Campaign;
  assets: AssetRow[];
  stores: StoreOption[];
  assignedStoreIds: string[];
  availableAssets: TrackOption[];
}) {
  const [name, setName] = useState(campaign.name);
  const [advertiserName, setAdvertiserName] = useState(campaign.advertisers?.name ?? "");
  const [startDate, setStartDate] = useState(campaign.start_date);
  const [endDate, setEndDate] = useState(campaign.end_date);
  const [startTime, setStartTime] = useState(campaign.start_time ?? "");
  const [endTime, setEndTime] = useState(campaign.end_time ?? "");
  const [passesPerDay, setPassesPerDay] = useState(campaign.passes_per_day ?? 0);
  const [priority, setPriority] = useState(campaign.priority);
  const [status, setStatus] = useState(campaign.status);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaSaving, startMetaSave] = useTransition();

  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set(assignedStoreIds));
  const [storesSaving, startStoresSave] = useTransition();

  const [assetSearch, setAssetSearch] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [assetPending, startAssetAction] = useTransition();

  const usedAssetAudioIds = useMemo(
    () => new Set(assets.map((a) => a.audio_files?.id).filter(Boolean)),
    [assets]
  );
  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    return availableAssets
      .filter((t) => !usedAssetAudioIds.has(t.id))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.artists?.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [availableAssets, usedAssetAudioIds, assetSearch]);

  function saveMeta() {
    setMetaError(null);
    startMetaSave(async () => {
      const result = await updateCampaignMeta({
        id: campaign.id,
        name,
        advertiserName,
        startDate,
        endDate,
        startTime,
        endTime,
        passesPerDay: passesPerDay || null,
        priority,
        status,
      });
      if (result.error) setMetaError(result.error);
    });
  }

  function saveStores() {
    startStoresSave(async () => {
      await setCampaignStores(campaign.id, Array.from(selectedStores));
    });
  }

  function toggleStore(storeId: string) {
    setSelectedStores((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  }

  const inputClass =
    "rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal";

  return (
    <div className="max-w-3xl">
      <Link href="/ads" className="text-xs text-ink-400 hover:text-signal">
        ← Publicités
      </Link>

      <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Campagne</label>
            <input className={`w-full ${inputClass}`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Client</label>
            <input
              className={`w-full ${inputClass}`}
              value={advertiserName}
              onChange={(e) => setAdvertiserName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Début</label>
            <input
              type="date"
              className={`w-full ${inputClass}`}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Fin</label>
            <input
              type="date"
              className={`w-full ${inputClass}`}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Heure début</label>
            <input
              type="time"
              className={`w-full ${inputClass}`}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Heure fin</label>
            <input
              type="time"
              className={`w-full ${inputClass}`}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Passages / jour</label>
            <input
              type="number"
              min={0}
              className={`w-full ${inputClass}`}
              value={passesPerDay}
              onChange={(e) => setPassesPerDay(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Priorité</label>
            <input
              type="number"
              className={`w-full ${inputClass}`}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">Statut</label>
            <select className={`w-full ${inputClass}`} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">En pause</option>
              <option value="ENDED">Terminée</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={saveMeta}
            disabled={metaSaving}
            className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
          >
            {metaSaving ? "…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Supprimer la campagne « ${campaign.name} » ?`)) {
                startAssetAction(() => deleteCampaign(campaign.id));
              }
            }}
            className="rounded-md border border-status-critical/40 px-3 py-2 text-xs text-status-critical transition hover:bg-status-critical/10"
          >
            Supprimer
          </button>
        </div>
        {metaError && <p className="mt-2 text-xs text-status-critical">{metaError}</p>}
        <p className="mt-2 text-[11px] text-ink-600">version {campaign.version}</p>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-medium text-ink-200">Fichiers publicitaires ({assets.length})</h2>
      <div className="overflow-hidden rounded-lg border border-ink-700">
        {assets.length === 0 ? (
          <div className="bg-ink-900 px-4 py-3 text-sm text-ink-400">Aucun fichier — ajoute-en un ci-dessous.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-ink-700 bg-ink-950">
              {assets.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 text-ink-100">{a.audio_files?.title ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-400">
                    {a.audio_files ? formatDuration(a.audio_files.duration_ms) : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={assetPending}
                      onClick={() =>
                        startAssetAction(async () => {
                          await removeAssetFromCampaign(campaign.id, a.id);
                        })
                      }
                      className="rounded border border-status-critical/40 px-2 py-0.5 text-xs text-status-critical transition hover:bg-status-critical/10"
                    >
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3">
        <input
          type="text"
          placeholder="Chercher un fichier publicitaire à ajouter (catégorie « Publicité » dans la bibliothèque)…"
          value={assetSearch}
          onChange={(e) => setAssetSearch(e.target.value)}
          className={`w-full ${inputClass}`}
        />
        {assetSearch && filteredAssets.length > 0 && (
          <div className="mt-1.5 space-y-1 rounded-md border border-ink-700 bg-ink-900 p-1.5">
            {filteredAssets.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={addingId === t.id}
                onClick={() => {
                  setAddingId(t.id);
                  startAssetAction(async () => {
                    await addAssetToCampaign(campaign.id, t.id);
                    setAddingId(null);
                    setAssetSearch("");
                  });
                }}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-ink-200 transition hover:bg-ink-800 disabled:opacity-50"
              >
                <span>{t.title}</span>
                <span className="text-xs text-signal">Ajouter</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-medium text-ink-200">Magasins ciblés</h2>
      <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
        {stores.length === 0 ? (
          <p className="text-sm text-ink-400">Aucun magasin créé pour l&apos;instant.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stores.map((s) => {
              const checked = selectedStores.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStore(s.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    checked
                      ? "border-signal bg-signal/10 text-signal"
                      : "border-ink-600 text-ink-300 hover:bg-ink-800"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={saveStores}
          disabled={storesSaving}
          className="mt-3 rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-signal-dim disabled:opacity-60"
        >
          {storesSaving ? "…" : "Enregistrer les magasins"}
        </button>
      </div>
    </div>
  );
}
