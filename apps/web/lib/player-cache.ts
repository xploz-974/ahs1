"use client";

// Cache local du player web — utilise la Cache Storage API directement
// depuis la page (pas besoin d'enregistrer un Service Worker : `caches` est
// accessible à tout script client). Clé stable = l'id du fichier, jamais
// l'URL signée (qui change à chaque sync et expire au bout d'1h) — c'est ce
// qui permet de continuer à lire un titre déjà mis en cache une fois hors
// connexion, même après le renouvellement de l'URL signée.

const CACHE_NAME = "ahs1-audio-v1";

function cacheKey(fileId: string): string {
  return `/ahs1-cache/${fileId}`;
}

export function isCacheSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

export async function isCached(fileId: string): Promise<boolean> {
  if (!isCacheSupported()) return false;
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(cacheKey(fileId));
  return !!match;
}

export async function cacheFile(fileId: string, remoteUrl: string): Promise<boolean> {
  if (!isCacheSupported()) return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const existing = await cache.match(cacheKey(fileId));
    if (existing) return true;
    const res = await fetch(remoteUrl);
    if (!res.ok) return false;
    await cache.put(cacheKey(fileId), res);
    return true;
  } catch {
    return false;
  }
}

// Renvoie une URL lisible par <audio> : depuis le cache si disponible (marche
// hors connexion), sinon télécharge depuis remoteUrl et met en cache au
// passage. Renvoie null si ni l'un ni l'autre n'est possible (hors connexion
// + jamais mis en cache).
export async function getPlayableUrl(fileId: string, remoteUrl: string | null): Promise<string | null> {
  if (isCacheSupported()) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(cacheKey(fileId));
    if (cached) {
      const blob = await cached.blob();
      return URL.createObjectURL(blob);
    }
  }

  if (!remoteUrl) return null;
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return null;
    if (isCacheSupported()) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(cacheKey(fileId), res.clone());
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// Purge les fichiers qui ne sont plus dans la playlist synchronisée (§25 —
// éviter que le cache grossisse indéfiniment avec des titres retirés).
export async function pruneCache(keepFileIds: string[]): Promise<void> {
  if (!isCacheSupported()) return;
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  const keepSet = new Set(keepFileIds.map(cacheKey));
  for (const request of keys) {
    if (!keepSet.has(new URL(request.url).pathname)) {
      await cache.delete(request);
    }
  }
}

export async function countCached(fileIds: string[]): Promise<number> {
  if (!isCacheSupported()) return 0;
  const cache = await caches.open(CACHE_NAME);
  let count = 0;
  for (const id of fileIds) {
    if (await cache.match(cacheKey(id))) count++;
  }
  return count;
}
