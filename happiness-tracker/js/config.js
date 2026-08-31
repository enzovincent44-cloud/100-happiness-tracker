// ============================================================
// Configuration de l'application
// Toutes les valeurs "fallbackId" sont des secours utilisés
// UNIQUEMENT si la résolution dynamique par nom (via l'API)
// échoue. En temps normal, les IDs sont récupérés en direct
// depuis l'API-Football et mis en cache — rien n'est figé.
// ============================================================

export const STORAGE_KEYS = {
  settings: "hft_settings",
  idCache: "hft_id_cache",
  manualTrophies: "hft_manual_trophies",
  fixturesCachePrefix: "hft_cache_fixtures_",
  eventsCachePrefix: "hft_cache_events_",
};

// Les 4 favoris qui déterminent le score de 100%
export const FAVORITES = {
  ronaldo: {
    key: "ronaldo",
    kind: "player",
    label: "Ronaldo",
    flag: "🇵🇹",
    searchName: "Cristiano Ronaldo",
    teamSearchName: "Al-Nassr",
    fallbackPlayerId: 874,
    fallbackTeamId: 2939,
    color: "var(--c-ronaldo)",
    conditionLabel: "A marqué",
  },
  real: {
    key: "real",
    kind: "team",
    label: "Real Madrid",
    flag: "🤍",
    searchName: "Real Madrid",
    fallbackTeamId: 541,
    color: "var(--c-real)",
    conditionLabel: "Victoire",
  },
  nantes: {
    key: "nantes",
    kind: "team",
    label: "FC Nantes",
    flag: "🟡",
    searchName: "FC Nantes",
    fallbackTeamId: 83,
    color: "var(--c-nantes)",
    conditionLabel: "Victoire",
  },
  liverpool: {
    key: "liverpool",
    kind: "team",
    label: "Liverpool",
    flag: "🔴",
    searchName: "Liverpool",
    fallbackTeamId: 40,
    color: "var(--c-liverpool)",
    conditionLabel: "Victoire",
  },
};

// Équipes "bonus / malus" (Vincent est Real + déteste le Barça,
// se fiche un peu de Man United)
export const RIVALS = {
  barcelona: {
    key: "barcelona",
    label: "FC Barcelone",
    searchName: "Barcelona",
    fallbackTeamId: 529,
    bonusPercent: 5,
    // bonus si le Barça NE gagne PAS (nul ou défaite)
    conditionLabel: "Ne gagne pas",
  },
  manUnited: {
    key: "manUnited",
    label: "Manchester United",
    searchName: "Manchester United",
    fallbackTeamId: 33,
    bonusPercent: 2,
    conditionLabel: "Ne gagne pas",
  },
};

export const TROPHY_BONUS_PERCENT = 50;

export const HAPPINESS_PER_CONDITION = 25;

// fenêtre (en jours) utilisée pour regrouper les 4 conditions
// lors de la recherche du "dernier 100% Happiness"
export const HAPPINESS_WINDOW_DAYS = 7;

// combien de temps garder les données en cache avant de
// retaper l'API (en millisecondes)
export const CACHE_TTL = {
  nextFixtures: 30 * 60 * 1000, // 30 min
  lastFixtures: 6 * 60 * 60 * 1000, // 6h
  events: 24 * 60 * 60 * 1000, // 24h
  idResolution: 30 * 24 * 60 * 60 * 1000, // 30 jours
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    return raw ? JSON.parse(raw) : { proxyUrl: "", apiKey: "" };
  } catch {
    return { proxyUrl: "", apiKey: "" };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}
