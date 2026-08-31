// ============================================================
// Client API-Football
//
// Deux modes :
//  1) "proxy" (recommandé) : les requêtes partent vers un
//     Cloudflare Worker (voir /worker) qui ajoute la clé API
//     secrète côté serveur. La clé n'est jamais visible dans
//     le navigateur.
//  2) "direct" (mode démo / dev local uniquement) : la clé
//     est envoyée directement depuis le navigateur. Elle est
//     alors visible par n'importe qui — à éviter en prod.
// ============================================================

import { STORAGE_KEYS, CACHE_TTL, loadSettings } from "./config.js";

const DIRECT_API_BASE = "https://v3.football.api-sports.io";

export class ApiError extends Error {
  constructor(message, { offline = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.offline = offline;
  }
}

function getMode() {
  const settings = loadSettings();
  if (settings.proxyUrl && settings.proxyUrl.trim()) {
    return { mode: "proxy", base: settings.proxyUrl.trim().replace(/\/$/, "") };
  }
  if (settings.apiKey && settings.apiKey.trim()) {
    return { mode: "direct", base: DIRECT_API_BASE, key: settings.apiKey.trim() };
  }
  return { mode: "none" };
}

export function isConfigured() {
  return getMode().mode !== "none";
}

function cacheGet(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.t > ttl) return null;
    return parsed.v;
  } catch {
    return null;
  }
}

function cacheSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    /* quota dépassé, on ignore silencieusement */
  }
}

async function rawGet(endpoint, params = {}) {
  const { mode, base, key } = getMode();
  if (mode === "none") {
    throw new ApiError(
      "Aucune source de données configurée. Ouvre les réglages (⚙️) pour renseigner une URL de proxy ou une clé API."
    );
  }

  if (!navigator.onLine) {
    throw new ApiError("Tu sembles hors-ligne. Vérifie ta connexion internet.", { offline: true });
  }

  const qs = new URLSearchParams(params).toString();
  const url = mode === "proxy"
    ? `${base}/${endpoint}${qs ? `?${qs}` : ""}`
    : `${base}/${endpoint}${qs ? `?${qs}` : ""}`;

  let response;
  try {
    response = await fetch(url, {
      headers: mode === "direct" ? { "x-apisports-key": key } : {},
    });
  } catch (err) {
    throw new ApiError("Impossible de contacter le serveur de données. Réessaie plus tard.");
  }

  if (response.status === 429) {
    throw new ApiError("Limite de requêtes API atteinte pour aujourd'hui. Réessaie plus tard.");
  }
  if (!response.ok) {
    throw new ApiError(`Erreur de l'API (${response.status}). Réessaie plus tard.`);
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new ApiError("Réponse invalide reçue de l'API.");
  }

  if (json.errors && Array.isArray(json.errors) ? json.errors.length : Object.keys(json.errors || {}).length) {
    const msg = typeof json.errors === "object" ? JSON.stringify(json.errors) : String(json.errors);
    throw new ApiError(`L'API a renvoyé une erreur : ${msg}`);
  }

  return json.response ?? [];
}

async function cachedGet(cacheKey, ttl, endpoint, params) {
  const cached = cacheGet(cacheKey, ttl);
  if (cached) return cached;
  const data = await rawGet(endpoint, params);
  cacheSet(cacheKey, data);
  return data;
}

// ---------------------------------------------------------
// Résolution dynamique des IDs (équipes & joueur)
// ---------------------------------------------------------
function loadIdCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.idCache);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveIdCache(cache) {
  localStorage.setItem(STORAGE_KEYS.idCache, JSON.stringify(cache));
}

export async function resolveTeamId(searchName, fallbackId) {
  const cache = loadIdCache();
  const entry = cache[`team:${searchName}`];
  if (entry && Date.now() - entry.t < CACHE_TTL.idResolution) return entry.id;

  try {
    const results = await rawGet("teams", { search: searchName });
    const best = results?.[0]?.team?.id;
    const id = best || fallbackId;
    cache[`team:${searchName}`] = { id, t: Date.now() };
    saveIdCache(cache);
    return id;
  } catch {
    return fallbackId;
  }
}

export async function resolvePlayerId(searchName, teamId, fallbackId) {
  const cache = loadIdCache();
  const entry = cache[`player:${searchName}`];
  if (entry && Date.now() - entry.t < CACHE_TTL.idResolution) return entry.id;

  try {
    const results = await rawGet("players", { search: searchName, team: teamId });
    const best = results?.[0]?.player?.id;
    const id = best || fallbackId;
    cache[`player:${searchName}`] = { id, t: Date.now() };
    saveIdCache(cache);
    return id;
  } catch {
    return fallbackId;
  }
}

// ---------------------------------------------------------
// Fixtures (matchs)
// ---------------------------------------------------------

/** Prochains matchs d'une équipe */
export async function getNextFixtures(teamId, count = 5) {
  const cacheKey = `${STORAGE_KEYS.fixturesCachePrefix}next_${teamId}_${count}`;
  return cachedGet(cacheKey, CACHE_TTL.nextFixtures, "fixtures", {
    team: teamId,
    next: count,
  });
}

/** Derniers matchs terminés d'une équipe */
export async function getLastFixtures(teamId, count = 10) {
  const cacheKey = `${STORAGE_KEYS.fixturesCachePrefix}last_${teamId}_${count}`;
  return cachedGet(cacheKey, CACHE_TTL.lastFixtures, "fixtures", {
    team: teamId,
    last: count,
  });
}

/** Événements (buts, cartons...) d'un match précis */
export async function getFixtureEvents(fixtureId) {
  const cacheKey = `${STORAGE_KEYS.eventsCachePrefix}${fixtureId}`;
  return cachedGet(cacheKey, CACHE_TTL.events, "fixtures/events", {
    fixture: fixtureId,
  });
}

export function clearAllCache() {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (
      k.startsWith(STORAGE_KEYS.fixturesCachePrefix) ||
      k.startsWith(STORAGE_KEYS.eventsCachePrefix)
    ) {
      toRemove.push(k);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}
