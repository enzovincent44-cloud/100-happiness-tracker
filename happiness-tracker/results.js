import { FAVORITES } from "./config.js";
import { getLastFixtures, getFixtureEvents } from "./api.js";
import { formatDateTime } from "./happiness.js";

export async function renderResults(ids) {
  const container = document.getElementById("results-list");
  container.innerHTML = `<div class="empty-state">Chargement des derniers résultats…</div>`;

  const entries = [
    { key: "real", teamId: ids.real, label: FAVORITES.real.label, flag: FAVORITES.real.flag, color: FAVORITES.real.color },
    { key: "nantes", teamId: ids.nantes, label: FAVORITES.nantes.label, flag: FAVORITES.nantes.flag, color: FAVORITES.nantes.color },
    { key: "liverpool", teamId: ids.liverpool, label: FAVORITES.liverpool.label, flag: FAVORITES.liverpool.flag, color: FAVORITES.liverpool.color },
    { key: "ronaldo", teamId: ids.alNassr, label: "Al-Nassr (Ronaldo 🇵🇹)", flag: FAVORITES.ronaldo.flag, color: FAVORITES.ronaldo.color, isRonaldo: true },
  ];

  const results = await Promise.allSettled(entries.map((e) => getLastFixtures(e.teamId, 4)));

  const allMatches = [];
  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      for (const fx of res.value) {
        if (fx.fixture.status.short === "FT" || fx.fixture.status.short === "AET" || fx.fixture.status.short === "PEN") {
          allMatches.push({ ...entries[i], fixture: fx });
        }
      }
    }
  });

  if (allMatches.length === 0) {
    container.innerHTML = `<div class="empty-state">Aucun résultat récent trouvé pour le moment.</div>`;
    return;
  }

  allMatches.sort((a, b) => new Date(b.fixture.fixture.date) - new Date(a.fixture.fixture.date));

  container.innerHTML = "";
  for (const m of allMatches) {
    const card = renderResultCard(m, ids);
    container.appendChild(card);
    if (m.isRonaldo) {
      attachGoalDetail(card, m, ids.ronaldo);
    }
  }
}

function renderResultCard({ teamId, label, flag, color, fixture }) {
  const isHome = fixture.teams.home.id === teamId;
  const opponent = isHome ? fixture.teams.away.name : fixture.teams.home.name;
  const side = isHome ? "home" : "away";
  const winner = fixture.teams[side].winner;
  const resultClass = winner === true ? "is-win" : winner === false ? "is-loss" : "is-draw";
  const resultText = winner === true ? "Victoire" : winner === false ? "Défaite" : "Nul";

  const card = document.createElement("div");
  card.className = "match-card";
  card.style.setProperty("--club-color", color);
  card.innerHTML = `
    <div class="match-card-top">
      <div class="match-teams">${flag} ${label} <span class="vs">vs</span> ${opponent}</div>
      <div class="match-score">${fixture.goals.home} - ${fixture.goals.away}</div>
    </div>
    <div class="match-meta">
      <span>📅 ${formatDateTime(fixture.fixture.date)}</span>
      <span>🏆 ${fixture.league.name}</span>
      <span class="match-status ${resultClass}">${resultText}</span>
    </div>
    <div class="match-goal-line" hidden></div>
  `;
  return card;
}

async function attachGoalDetail(card, { fixture }, ronaldoId) {
  const line = card.querySelector(".match-goal-line");
  try {
    const events = await getFixtureEvents(fixture.fixture.id);
    const goals = events.filter((e) => e.player?.id === ronaldoId && e.type === "Goal");
    const assists = events.filter((e) => e.assist?.id === ronaldoId);
    if (goals.length || assists.length) {
      line.hidden = false;
      const parts = [];
      if (goals.length) parts.push(`⚽ Ronaldo a marqué ${goals.length} but(s)${goals.some(g => g.detail === "Penalty") ? " (dont pénalty)" : ""}`);
      if (assists.length) parts.push(`🎯 ${assists.length} passe(s) décisive(s)`);
      line.textContent = parts.join(" · ");
    } else {
      line.hidden = false;
      line.textContent = "⚽ Ronaldo n'a pas marqué sur ce match";
    }
  } catch {
    // pas grave, on laisse la ligne masquée
  }
}
