import { FAVORITES } from "./config.js";
import { getNextFixtures } from "./api.js";
import { formatDateTime } from "./happiness.js";

export async function renderCalendar(ids) {
  const container = document.getElementById("calendar-list");
  container.innerHTML = `<div class="empty-state">Chargement des prochains matchs…</div>`;

  const entries = [
    { key: "real", teamId: ids.real, label: FAVORITES.real.label, flag: FAVORITES.real.flag, color: FAVORITES.real.color },
    { key: "nantes", teamId: ids.nantes, label: FAVORITES.nantes.label, flag: FAVORITES.nantes.flag, color: FAVORITES.nantes.color },
    { key: "liverpool", teamId: ids.liverpool, label: FAVORITES.liverpool.label, flag: FAVORITES.liverpool.flag, color: FAVORITES.liverpool.color },
    { key: "ronaldo", teamId: ids.alNassr, label: "Al-Nassr (Ronaldo 🇵🇹)", flag: FAVORITES.ronaldo.flag, color: FAVORITES.ronaldo.color },
  ];

  const results = await Promise.allSettled(entries.map((e) => getNextFixtures(e.teamId, 4)));

  const allMatches = [];
  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      for (const fx of res.value) {
        allMatches.push({ ...entries[i], fixture: fx });
      }
    }
  });

  if (allMatches.length === 0) {
    container.innerHTML = `<div class="empty-state">Aucun match à venir trouvé pour le moment.</div>`;
    return;
  }

  allMatches.sort((a, b) => new Date(a.fixture.fixture.date) - new Date(b.fixture.fixture.date));

  container.innerHTML = "";
  for (const m of allMatches) {
    container.appendChild(renderCalendarCard(m));
  }
}

function renderCalendarCard({ teamId, label, flag, color, fixture }) {
  const isHome = fixture.teams.home.id === teamId;
  const opponent = isHome ? fixture.teams.away.name : fixture.teams.home.name;
  const venue = isHome ? "🏠 Domicile" : "✈️ Extérieur";
  const status = fixture.fixture.status.short;

  const card = document.createElement("div");
  card.className = "match-card";
  card.style.setProperty("--club-color", color);
  card.innerHTML = `
    <div class="match-card-top">
      <div class="match-teams">${flag} ${label} <span class="vs">vs</span> ${opponent}</div>
    </div>
    <div class="match-meta">
      <span>📅 ${formatDateTime(fixture.fixture.date)}</span>
      <span>🏆 ${fixture.league.name}</span>
      <span>${venue}</span>
      <span class="match-status">${statusLabel(status)}</span>
    </div>
  `;
  return card;
}

function statusLabel(short) {
  const map = {
    NS: "À venir",
    TBD: "Horaire à confirmer",
    PST: "Reporté",
    CANC: "Annulé",
  };
  return map[short] || short;
}
