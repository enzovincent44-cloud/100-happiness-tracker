// ============================================================
// Moteur de calcul du "Happiness Score"
// ============================================================

import {
  FAVORITES,
  RIVALS,
  TROPHY_BONUS_PERCENT,
  HAPPINESS_PER_CONDITION,
  HAPPINESS_WINDOW_DAYS,
  STORAGE_KEYS,
} from "./config.js";
import {
  resolveTeamId,
  resolvePlayerId,
  getLastFixtures,
  getFixtureEvents,
} from "./api.js";

const ACTIVE_BONUS_WINDOW_DAYS = 30; // fenêtre pendant laquelle un trophée "compte" sur le dashboard
const TIMELINE_FIXTURES_PER_TEAM = 12;

// ---------------------------------------------------------
// Résolution de tous les IDs nécessaires (une seule fois,
// puis mise en cache par api.js)
// ---------------------------------------------------------
export async function resolveAllIds() {
  const [realId, nantesId, liverpoolId, alNassrId, barcaId, manuId] = await Promise.all([
    resolveTeamId(FAVORITES.real.searchName, FAVORITES.real.fallbackTeamId),
    resolveTeamId(FAVORITES.nantes.searchName, FAVORITES.nantes.fallbackTeamId),
    resolveTeamId(FAVORITES.liverpool.searchName, FAVORITES.liverpool.fallbackTeamId),
    resolveTeamId(FAVORITES.ronaldo.teamSearchName, FAVORITES.ronaldo.fallbackTeamId),
    resolveTeamId(RIVALS.barcelona.searchName, RIVALS.barcelona.fallbackTeamId),
    resolveTeamId(RIVALS.manUnited.searchName, RIVALS.manUnited.fallbackTeamId),
  ]);
  const ronaldoId = await resolvePlayerId(
    FAVORITES.ronaldo.searchName,
    alNassrId,
    FAVORITES.ronaldo.fallbackPlayerId
  );

  return {
    real: realId,
    nantes: nantesId,
    liverpool: liverpoolId,
    alNassr: alNassrId,
    barcelona: barcaId,
    manUnited: manuId,
    ronaldo: ronaldoId,
  };
}

function isFinished(fixture) {
  return ["FT", "AET", "PEN"].includes(fixture?.fixture?.status?.short);
}

function sideOf(fixture, teamId) {
  if (fixture.teams.home.id === teamId) return "home";
  if (fixture.teams.away.id === teamId) return "away";
  return null;
}

function teamWon(fixture, teamId) {
  const side = sideOf(fixture, teamId);
  if (!side) return null;
  return fixture.teams[side].winner === true;
}

function resultLabel(fixture, teamId) {
  const side = sideOf(fixture, teamId);
  if (!side) return "?";
  const winner = fixture.teams[side].winner;
  if (winner === true) return "Victoire";
  if (winner === false) return "Défaite";
  return "Nul";
}

function isFinalRound(round) {
  if (!round) return false;
  return /(^|[\s-])final(e)?([\s-]|$)/i.test(round) && !/(semi|demi|quart|preliminary|qualif)/i.test(round);
}

function daysBetween(dateA, dateB) {
  return Math.abs(new Date(dateA) - new Date(dateB)) / 86400000;
}

// ---------------------------------------------------------
// Trophées manuels (localStorage)
// ---------------------------------------------------------
export function getManualTrophies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.manualTrophies);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addManualTrophy({ teamKey, label, date }) {
  const list = getManualTrophies();
  list.push({ id: `manual-${Date.now()}`, teamKey, label, date });
  localStorage.setItem(STORAGE_KEYS.manualTrophies, JSON.stringify(list));
  return list;
}

export function removeManualTrophy(id) {
  const list = getManualTrophies().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEYS.manualTrophies, JSON.stringify(list));
  return list;
}

// ---------------------------------------------------------
// États des 4 conditions + bonus, pour le dashboard
// ---------------------------------------------------------
export async function computeCurrentState(ids) {
  const [realFx, nantesFx, liverpoolFx, alNassrFx, barcaFx, manuFx] = await Promise.all([
    getLastFixtures(ids.real, 5),
    getLastFixtures(ids.nantes, 5),
    getLastFixtures(ids.liverpool, 5),
    getLastFixtures(ids.alNassr, 5),
    getLastFixtures(ids.barcelona, 5),
    getLastFixtures(ids.manUnited, 5),
  ]);

  const lastFinished = (list) => list.find(isFinished) || null;

  const realLast = lastFinished(realFx);
  const nantesLast = lastFinished(nantesFx);
  const liverpoolLast = lastFinished(liverpoolFx);
  const alNassrLast = lastFinished(alNassrFx);
  const barcaLast = lastFinished(barcaFx);
  const manuLast = lastFinished(manuFx);

  let ronaldoGoals = 0;
  let ronaldoAssists = 0;
  if (alNassrLast) {
    try {
      const events = await getFixtureEvents(alNassrLast.fixture.id);
      for (const ev of events) {
        if (ev.player?.id === ids.ronaldo && ev.type === "Goal" && ev.detail !== "Missed Penalty") {
          ronaldoGoals += 1;
        }
        if (ev.assist?.id === ids.ronaldo) {
          ronaldoAssists += 1;
        }
      }
    } catch {
      // si les events échouent, on affiche l'état sans le détail des buts
    }
  }

  const conditions = {
    ronaldo: {
      met: ronaldoGoals > 0,
      detail: alNassrLast
        ? `${ronaldoGoals} but(s)${ronaldoAssists ? `, ${ronaldoAssists} passe(s) déc.` : ""} vs ${opponentName(alNassrLast, ids.alNassr)} (${formatShortDate(alNassrLast.fixture.date)})`
        : "Pas de match récent trouvé",
      fixture: alNassrLast,
    },
    real: {
      met: realLast ? teamWon(realLast, ids.real) : false,
      detail: realLast
        ? `${resultLabel(realLast, ids.real)} vs ${opponentName(realLast, ids.real)} (${scoreLine(realLast)}) — ${formatShortDate(realLast.fixture.date)}`
        : "Pas de match récent trouvé",
      fixture: realLast,
    },
    nantes: {
      met: nantesLast ? teamWon(nantesLast, ids.nantes) : false,
      detail: nantesLast
        ? `${resultLabel(nantesLast, ids.nantes)} vs ${opponentName(nantesLast, ids.nantes)} (${scoreLine(nantesLast)}) — ${formatShortDate(nantesLast.fixture.date)}`
        : "Pas de match récent trouvé",
      fixture: nantesLast,
    },
    liverpool: {
      met: liverpoolLast ? teamWon(liverpoolLast, ids.liverpool) : false,
      detail: liverpoolLast
        ? `${resultLabel(liverpoolLast, ids.liverpool)} vs ${opponentName(liverpoolLast, ids.liverpool)} (${scoreLine(liverpoolLast)}) — ${formatShortDate(liverpoolLast.fixture.date)}`
        : "Pas de match récent trouvé",
      fixture: liverpoolLast,
    },
  };

  const barcaNoWin = barcaLast ? teamWon(barcaLast, ids.barcelona) === false : false;
  const manuNoWin = manuLast ? teamWon(manuLast, ids.manUnited) === false : false;

  // trophées auto (finale gagnée) parmi les derniers matchs, encore "récents"
  const autoTrophies = [];
  const finalsCandidates = [
    { key: "real", fixture: realLast, id: ids.real, label: FAVORITES.real.label },
    { key: "nantes", fixture: nantesLast, id: ids.nantes, label: FAVORITES.nantes.label },
    { key: "liverpool", fixture: liverpoolLast, id: ids.liverpool, label: FAVORITES.liverpool.label },
    { key: "ronaldo", fixture: alNassrLast, id: ids.alNassr, label: "Al-Nassr (Ronaldo)" },
  ];
  for (const c of finalsCandidates) {
    if (c.fixture && isFinalRound(c.fixture.league?.round) && teamWon(c.fixture, c.id)) {
      autoTrophies.push({
        id: `auto-${c.fixture.fixture.id}`,
        teamKey: c.key,
        label: `${c.fixture.league.name} — ${c.fixture.league.round}`,
        date: c.fixture.fixture.date,
        auto: true,
      });
    }
  }

  const manualTrophies = getManualTrophies().map((t) => ({ ...t, auto: false }));
  const allTrophies = [...autoTrophies, ...manualTrophies];
  const activeTrophies = allTrophies.filter(
    (t) => daysBetween(t.date, new Date()) <= ACTIVE_BONUS_WINDOW_DAYS
  );

  const conditionsMetCount = Object.values(conditions).filter((c) => c.met).length;
  const baseScore = conditionsMetCount * HAPPINESS_PER_CONDITION;
  const barcaBonus = barcaNoWin ? RIVALS.barcelona.bonusPercent : 0;
  const manuBonus = manuNoWin ? RIVALS.manUnited.bonusPercent : 0;
  const trophyBonus = activeTrophies.length * TROPHY_BONUS_PERCENT;

  const totalScore = baseScore + barcaBonus + manuBonus + trophyBonus;

  return {
    conditions,
    conditionsMetCount,
    baseScore,
    bonuses: {
      barca: { active: barcaNoWin, amount: RIVALS.barcelona.bonusPercent, fixture: barcaLast },
      manu: { active: manuNoWin, amount: RIVALS.manUnited.bonusPercent, fixture: manuLast },
      trophies: activeTrophies,
      trophyAmount: trophyBonus,
    },
    totalScore,
    allTrophies,
  };
}

function opponentName(fixture, teamId) {
  const side = sideOf(fixture, teamId);
  const otherSide = side === "home" ? "away" : "home";
  return fixture.teams[otherSide]?.name ?? "?";
}

function scoreLine(fixture) {
  return `${fixture.goals.home}-${fixture.goals.away}`;
}

export function formatShortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }) + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function emojiForScore(score) {
  if (score >= 100) return "🗿🔥";
  if (score >= 75) return "😎";
  if (score >= 50) return "🙂";
  if (score >= 25) return "😐";
  return "😭";
}

// ---------------------------------------------------------
// Timeline (historique jour par jour) + recherche du dernier 100%
// ---------------------------------------------------------
export async function buildEventPool(ids) {
  const [realFx, nantesFx, liverpoolFx, alNassrFx, barcaFx, manuFx] = await Promise.all([
    getLastFixtures(ids.real, TIMELINE_FIXTURES_PER_TEAM),
    getLastFixtures(ids.nantes, TIMELINE_FIXTURES_PER_TEAM),
    getLastFixtures(ids.liverpool, TIMELINE_FIXTURES_PER_TEAM),
    getLastFixtures(ids.alNassr, TIMELINE_FIXTURES_PER_TEAM),
    getLastFixtures(ids.barcelona, TIMELINE_FIXTURES_PER_TEAM),
    getLastFixtures(ids.manUnited, TIMELINE_FIXTURES_PER_TEAM),
  ]);

  const events = [];

  const pushWinEvents = (list, teamId, type, label) => {
    for (const fx of list.filter(isFinished)) {
      if (teamWon(fx, teamId)) {
        events.push({
          type,
          date: fx.fixture.date,
          label: `${label} bat ${opponentName(fx, teamId)} (${scoreLine(fx)})`,
        });
      }
    }
  };

  pushWinEvents(realFx, ids.real, "real_win", FAVORITES.real.label);
  pushWinEvents(nantesFx, ids.nantes, "nantes_win", FAVORITES.nantes.label);
  pushWinEvents(liverpoolFx, ids.liverpool, "liverpool_win", FAVORITES.liverpool.label);

  for (const fx of barcaFx.filter(isFinished)) {
    if (teamWon(fx, ids.barcelona) === false) {
      events.push({
        type: "barca_no_win",
        date: fx.fixture.date,
        label: `Barça ne gagne pas vs ${opponentName(fx, ids.barcelona)} (${scoreLine(fx)})`,
      });
    }
  }
  for (const fx of manuFx.filter(isFinished)) {
    if (teamWon(fx, ids.manUnited) === false) {
      events.push({
        type: "manu_no_win",
        date: fx.fixture.date,
        label: `Man United ne gagne pas vs ${opponentName(fx, ids.manUnited)} (${scoreLine(fx)})`,
      });
    }
  }

  // buts de Ronaldo : on ne scanne que les derniers matchs finis d'Al-Nassr
  const alNassrFinished = alNassrFx.filter(isFinished).slice(0, 8);
  for (const fx of alNassrFinished) {
    try {
      const evs = await getFixtureEvents(fx.fixture.id);
      const goals = evs.filter((e) => e.player?.id === ids.ronaldo && e.type === "Goal" && e.detail !== "Missed Penalty");
      if (goals.length > 0) {
        events.push({
          type: "ronaldo_goal",
          date: fx.fixture.date,
          label: `Ronaldo marque (${goals.length}) vs ${opponentName(fx, ids.alNassr)}`,
        });
      }
    } catch {
      /* on ignore ce match si les events ne répondent pas */
    }
    if (isFinalRound(fx.league?.round) && teamWon(fx, ids.alNassr)) {
      events.push({
        type: "trophy",
        date: fx.fixture.date,
        label: `🏆 Al-Nassr remporte ${fx.league.name}`,
      });
    }
  }

  for (const fx of [...realFx, ...nantesFx, ...liverpoolFx].filter(isFinished)) {
    const id = realFx.includes(fx) ? ids.real : nantesFx.includes(fx) ? ids.nantes : ids.liverpool;
    if (isFinalRound(fx.league?.round) && teamWon(fx, id)) {
      events.push({
        type: "trophy",
        date: fx.fixture.date,
        label: `🏆 ${fx.teams.home.id === id ? fx.teams.home.name : fx.teams.away.name} remporte ${fx.league.name}`,
      });
    }
  }

  for (const t of getManualTrophies()) {
    events.push({ type: "trophy", date: t.date, label: `🏆 ${t.label} (${t.teamKey})` });
  }

  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  return events;
}

/** Regroupe les événements par jour calendaire pour l'historique 0/4..4/4 */
export function groupEventsByDay(events) {
  const coreTypes = ["ronaldo_goal", "real_win", "nantes_win", "liverpool_win"];
  const byDay = new Map();

  for (const ev of events) {
    const day = ev.date.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(ev);
  }

  const days = [...byDay.entries()]
    .map(([day, evs]) => {
      const coreHit = new Set(evs.filter((e) => coreTypes.includes(e.type)).map((e) => e.type));
      return {
        day,
        score: coreHit.size,
        events: evs,
      };
    })
    .sort((a, b) => new Date(b.day) - new Date(a.day));

  return days;
}

/** Cherche la période de 7 jours la plus récente où les 4 conditions sont réunies */
export function findLastFullHappiness(events) {
  const coreTypes = ["ronaldo_goal", "real_win", "nantes_win", "liverpool_win"];
  const coreEvents = events.filter((e) => coreTypes.includes(e.type));
  if (coreEvents.length === 0) return null;

  // on part du plus récent et on recule
  const sorted = [...coreEvents].sort((a, b) => new Date(b.date) - new Date(a.date));

  for (let i = 0; i < sorted.length; i++) {
    const anchor = sorted[i];
    const windowEvents = sorted.filter(
      (e) => daysBetween(e.date, anchor.date) <= HAPPINESS_WINDOW_DAYS
    );
    const typesFound = new Set(windowEvents.map((e) => e.type));
    if (coreTypes.every((t) => typesFound.has(t))) {
      const relevant = coreTypes.map((t) => windowEvents.find((e) => e.type === t));
      const dates = relevant.map((e) => new Date(e.date));
      return {
        from: new Date(Math.min(...dates)),
        to: new Date(Math.max(...dates)),
        events: relevant,
      };
    }
  }
  return null;
}
