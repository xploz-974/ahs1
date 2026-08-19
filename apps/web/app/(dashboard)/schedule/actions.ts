"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/org";
import { bumpStoreManifest } from "@/lib/manifest";
import {
  resolvePlayback,
  isScheduleItemActiveAt,
  DEFAULT_AUTODJ_RULES,
  type AutoDjRules,
  type ResolvedSlot,
} from "@ahs1/core";

export type ActionState = { error: string | null; success: string | null };

async function getOrCreateSchedule(
  supabase: ReturnType<typeof createClient>,
  storeId: string,
  organizationId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("schedules")
    .select("id")
    .eq("store_id", storeId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("schedules")
    .insert({ organization_id: organizationId, store_id: storeId, name: "Programmation", is_active: true })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export async function addScheduleItem(input: {
  storeId: string;
  startTime: string;
  endTime: string;
  playlistId: string;
  daysOfWeek: number[];
}): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }
  if (input.daysOfWeek.length === 0) {
    return { error: "Sélectionne au moins un jour.", success: null };
  }

  let scheduleId: string;
  try {
    scheduleId = await getOrCreateSchedule(supabase, input.storeId, organizationId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec de la création du planning.", success: null };
  }

  const { error } = await supabase.from("schedule_items").insert({
    schedule_id: scheduleId,
    start_time: input.startTime,
    end_time: input.endTime,
    playlist_id: input.playlistId,
    days_of_week: input.daysOfWeek,
  });

  if (error) {
    return { error: `Échec de l'ajout du créneau : ${error.message}`, success: null };
  }

  await bumpStoreManifest(supabase, input.storeId, organizationId, ["playlist_version"]);
  revalidatePath("/schedule");
  return { error: null, success: "Créneau ajouté." };
}

export async function removeScheduleItem(itemId: string, storeId: string): Promise<void> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  await supabase.from("schedule_items").delete().eq("id", itemId);
  if (organizationId) {
    await bumpStoreManifest(supabase, storeId, organizationId, ["playlist_version"]);
  }
  revalidatePath("/schedule");
}

export async function getAutoDjRules(): Promise<AutoDjRules> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) return DEFAULT_AUTODJ_RULES;

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("organization_id", organizationId)
    .eq("key", "autodj_rules")
    .maybeSingle();

  if (!data) return DEFAULT_AUTODJ_RULES;
  return { ...DEFAULT_AUTODJ_RULES, ...(data.value as Partial<AutoDjRules>) };
}

export async function updateAutoDjRules(rules: AutoDjRules): Promise<ActionState> {
  const supabase = createClient();
  const organizationId = await getCurrentOrganizationId(supabase);
  if (!organizationId) {
    return { error: "Aucune organisation associée à ce compte.", success: null };
  }

  const { error } = await supabase
    .from("settings")
    .upsert(
      { organization_id: organizationId, key: "autodj_rules", value: rules },
      { onConflict: "organization_id,key" }
    );

  if (error) {
    return { error: `Échec de l'enregistrement : ${error.message}`, success: null };
  }

  revalidatePath("/schedule");
  return { error: null, success: "Règles AutoDJ enregistrées." };
}

export interface PreviewResult {
  error: string | null;
  slots: ResolvedSlot[];
  scheduleItemLabel: string | null;
}

const PREVIEW_WINDOW_MS = 2 * 60 * 60 * 1000; // 2h

export async function resolveStorePreview(storeId: string): Promise<PreviewResult> {
  const supabase = createClient();

  const { data: schedule } = await supabase.from("schedules").select("id").eq("store_id", storeId).maybeSingle();

  if (!schedule) {
    return { error: "Aucun planning défini pour ce magasin.", slots: [], scheduleItemLabel: null };
  }

  type ScheduleItemWithPlaylist = {
    id: string;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    playlist_id: string | null;
    playlists: { name: string } | null;
  };

  const { data: items } = await supabase
    .from("schedule_items")
    .select("id, start_time, end_time, days_of_week, playlist_id, playlists(name)")
    .eq("schedule_id", schedule.id)
    .returns<ScheduleItemWithPlaylist[]>();

  const now = new Date();
  const active = (items ?? []).find((it) =>
    isScheduleItemActiveAt(
      { start_time: it.start_time, end_time: it.end_time, days_of_week: it.days_of_week },
      now
    )
  );

  if (!active || !active.playlist_id) {
    return { error: "Aucun créneau actif en ce moment pour ce magasin.", slots: [], scheduleItemLabel: null };
  }

  type PlaylistItemAudio = {
    audio_files: { id: string; title: string; duration_ms: number; artists: { name: string } | null } | null;
  };

  const { data: playlistItems } = await supabase
    .from("playlist_items")
    .select("audio_files(id, title, duration_ms, artists(name))")
    .eq("playlist_id", active.playlist_id)
    .order("position", { ascending: true })
    .returns<PlaylistItemAudio[]>();

  const tracks = (playlistItems ?? [])
    .map((pi) => pi.audio_files)
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .map((f) => ({
      id: f.id,
      title: f.title,
      artistName: f.artists?.name ?? null,
      durationMs: f.duration_ms,
    }));

  type JingleWithAudio = {
    id: string;
    frequency_every_n_tracks: number;
    audio_files: { title: string; duration_ms: number } | null;
  };

  const { data: jingleRows } = await supabase
    .from("jingles")
    .select("id, frequency_every_n_tracks, audio_files(title, duration_ms)")
    .eq("store_id", storeId)
    .eq("status", "ACTIVE")
    .returns<JingleWithAudio[]>();

  const jingles = (jingleRows ?? [])
    .filter((j) => j.audio_files)
    .map((j) => ({
      id: j.id,
      title: j.audio_files!.title,
      durationMs: j.audio_files!.duration_ms,
      frequencyEveryNTracks: j.frequency_every_n_tracks,
    }));

  type CampaignWithAssets = {
    advertisement_campaigns: {
      id: string;
      name: string;
      status: string;
      start_date: string;
      end_date: string;
      advertisement_assets: { audio_files: { title: string; duration_ms: number } | null }[];
    } | null;
  };

  const today = now.toISOString().slice(0, 10);
  const { data: campaignRows } = await supabase
    .from("campaign_stores")
    .select(
      "advertisement_campaigns(id, name, status, start_date, end_date, advertisement_assets(audio_files(title, duration_ms)))"
    )
    .eq("store_id", storeId)
    .returns<CampaignWithAssets[]>();

  const ads = (campaignRows ?? [])
    .map((c) => c.advertisement_campaigns)
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .filter((c) => c.status === "ACTIVE" && c.start_date <= today && c.end_date >= today)
    .flatMap((c) =>
      (c.advertisement_assets ?? [])
        .filter((a) => a.audio_files)
        .map((a) => ({
          id: c.id,
          campaignName: c.name,
          title: a.audio_files!.title,
          durationMs: a.audio_files!.duration_ms,
        }))
    );

  const rules = await getAutoDjRules();

  const slots = resolvePlayback({ tracks, jingles, ads, rules, windowMs: PREVIEW_WINDOW_MS });

  return {
    error: null,
    slots,
    scheduleItemLabel: `${active.playlists?.name ?? "Playlist"} · ${active.start_time.slice(0, 5)}–${active.end_time.slice(0, 5)}`,
  };
}
