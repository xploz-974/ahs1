import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlayerAuth } from "@/lib/api-auth";

type SecurityEvent = { event: "tamper" } | { event: "location"; lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

// Distance en mètres entre deux points GPS (formule de Haversine) — suffisant
// pour un rayon de quelques dizaines/centaines de mètres, pas besoin de plus
// précis qu'un GPS grand public de toute façon.
function haversineDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export async function POST(request: Request) {
  const auth = await requirePlayerAuth(request);
  if ("error" in auth) return auth.error;
  const { claims } = auth;

  let body: SecurityEvent;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (body.event === "tamper") {
    // Pas de déduplication par fenêtre de temps ici : chaque déclenchement
    // physique mérite sa propre alerte (contrairement à PLAYER_OFFLINE qui
    // est un état continu, un mouvement est un événement ponctuel).
    const { error } = await supabase.from("player_alerts").insert({
      organization_id: claims.organizationId,
      player_id: claims.playerId,
      type: "DEVICE_MOVED",
      severity: "CRITICAL",
      message: "Mouvement détecté par l'accéléromètre de l'appareil.",
    });
    if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.event === "location") {
    const { lat, lng } = body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
    }

    const { data: player } = await supabase
      .from("players")
      .select("home_lat, home_lng, geofence_radius_m")
      .eq("id", claims.playerId)
      .maybeSingle();

    const update: Record<string, unknown> = {
      last_lat: lat,
      last_lng: lng,
      last_location_at: new Date().toISOString(),
    };

    // Première position reçue : devient la référence tant qu'un admin ne l'a
    // pas explicitement réinitialisée depuis le dashboard.
    if (player && player.home_lat == null && player.home_lng == null) {
      update.home_lat = lat;
      update.home_lng = lng;
    }

    await supabase.from("players").update(update).eq("id", claims.playerId);

    if (player?.home_lat != null && player.home_lng != null) {
      const distance = haversineDistanceM(lat, lng, player.home_lat, player.home_lng);
      if (distance > (player.geofence_radius_m ?? 100)) {
        const { data: existing } = await supabase
          .from("player_alerts")
          .select("id")
          .eq("player_id", claims.playerId)
          .eq("type", "DEVICE_OUT_OF_ZONE")
          .is("acknowledged_at", null)
          .maybeSingle();

        if (!existing) {
          await supabase.from("player_alerts").insert({
            organization_id: claims.organizationId,
            player_id: claims.playerId,
            type: "DEVICE_OUT_OF_ZONE",
            severity: "CRITICAL",
            message: `Appareil à ${Math.round(distance)}m de sa position de référence.`,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_event" }, { status: 400 });
}
