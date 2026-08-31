import {
  buildEventPool,
  groupEventsByDay,
  findLastFullHappiness,
  addManualTrophy,
} from "./happiness.js";

let cachedEvents = null;

export async function renderHistory(ids, { force = false } = {}) {
  const timelineEl = document.getElementById("history-timeline");
  const last100El = document.getElementById("last100-content");

  if (force || !cachedEvents) {
    timelineEl.innerHTML = `<div class="empty-state">Analyse de l'historique en cours…</div>`;
    last100El.textContent = "Recherche en cours…";
    cachedEvents = await buildEventPool(ids);
  }

  renderLast100(cachedEvents);
  renderTimeline(cachedEvents);
}

function renderLast100(events) {
  const el = document.getElementById("last100-content");
  const result = findLastFullHappiness(events);

  if (!result) {
    el.innerHTML = `Aucune période de 7 jours avec les 4 conditions réunies n'a été trouvée dans l'historique récent.`;
    return;
  }

  const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const list = result.events
    .map((e) => `<div>• ${e.label} — ${new Date(e.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>`)
    .join("");

  el.innerHTML = `
    <div><strong>Du ${fmt(result.from)} au ${fmt(result.to)}</strong></div>
    <div style="margin-top:8px; display:flex; flex-direction:column; gap:4px;">${list}</div>
  `;
}

function renderTimeline(events) {
  const el = document.getElementById("history-timeline");
  const days = groupEventsByDay(events).slice(0, 30);

  if (days.length === 0) {
    el.innerHTML = `<div class="empty-state">Pas encore assez de données pour construire l'historique.</div>`;
    return;
  }

  el.innerHTML = "";
  for (const d of days) {
    const entry = document.createElement("div");
    entry.className = `day-entry${d.score === 4 ? " is-full" : ""}`;
    const dateLabel = new Date(d.day).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    const eventLabels = d.events.map((e) => e.label).join(" · ");
    entry.innerHTML = `
      <div class="day-score">${d.score}/4${d.score === 4 ? " 🔥" : ""}</div>
      <div class="day-info">
        <div class="day-date">${dateLabel}</div>
        <div class="day-conditions">${eventLabels}</div>
      </div>
    `;
    el.appendChild(entry);
  }
}

export function setupTrophyForm(onAdded) {
  const form = document.getElementById("trophy-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const teamKey = document.getElementById("trophy-team").value;
    const label = document.getElementById("trophy-label").value.trim();
    const date = document.getElementById("trophy-date").value;
    if (!label || !date) return;

    addManualTrophy({ teamKey, label, date: new Date(date).toISOString() });
    form.reset();
    cachedEvents = null; // force un recalcul incluant le nouveau trophée
    onAdded?.();
  });
}

export function invalidateHistoryCache() {
  cachedEvents = null;
}
