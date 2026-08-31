// ============================================================
// 100% Happiness Tracker — version manuelle (sans API)
// Tout est stocké dans le navigateur (localStorage).
// ============================================================

const STORAGE = {
  draft: "hft_draft",
  history: "hft_history_manual",
};

const FAVORITES = [
  { key: "ronaldo", flag: "🇵🇹", label: "Ronaldo", color: "var(--c-ronaldo)", condition: "A marqué" },
  { key: "real", flag: "🤍", label: "Real Madrid", color: "var(--c-real)", condition: "Victoire" },
  { key: "nantes", flag: "🟡", label: "FC Nantes", color: "var(--c-nantes)", condition: "Victoire" },
  { key: "liverpool", flag: "🔴", label: "Liverpool", color: "var(--c-liverpool)", condition: "Victoire" },
];

const CIRCUMFERENCE = 2 * Math.PI * 96;

// ---------------------------------------------------------
// État (le "brouillon" en cours, avant d'être enregistré)
// ---------------------------------------------------------
function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE.draft);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.conditions) return parsed;
    }
  } catch {
    /* ignore */
  }
  return blankDraft();
}

function blankDraft() {
  const { start, end } = currentWeekRange();
  const conditions = {};
  FAVORITES.forEach((f) => {
    conditions[f.key] = { met: false, played: true };
  });
  return {
    conditions,
    barcaNoWin: false,
    manuNoWin: false,
    trophies: 0,
    startDate: start,
    endDate: end,
  };
}

/** Lundi -> dimanche de la semaine en cours (au format YYYY-MM-DD) */
function currentWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche, 1 = lundi, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toIsoDate(monday), end: toIsoDate(sunday) };
}

function toIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

function saveDraft(draft) {
  localStorage.setItem(STORAGE.draft, JSON.stringify(draft));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE.history);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  localStorage.setItem(STORAGE.history, JSON.stringify(list));
}

// ---------------------------------------------------------
// Calcul du score
// ---------------------------------------------------------
function computeScore(d) {
  const conditions = d.conditions || {};
  const playedFavs = FAVORITES.filter((f) => (conditions[f.key]?.played ?? true));
  const metCount = playedFavs.filter((f) => conditions[f.key]?.met).length;
  const base = playedFavs.length > 0 ? Math.round((metCount / playedFavs.length) * 100) : 0;
  const barca = d.barcaNoWin ? 5 : 0;
  const manu = d.manuNoWin ? 2 : 0;
  const trophy = (d.trophies || 0) * 50;
  return {
    conditionsMet: metCount,
    conditionsPlayed: playedFavs.length,
    total: base + barca + manu + trophy,
    barca,
    manu,
    trophy,
  };
}

function emojiForScore(score) {
  if (score >= 100) return "🗿🔥";
  if (score >= 75) return "😎";
  if (score >= 50) return "🙂";
  if (score >= 25) return "😐";
  return "😭";
}

// ---------------------------------------------------------
// Rendu — Dashboard
// ---------------------------------------------------------
let draft = loadDraft();
let lastScoreSeen = null;

function renderDashboard() {
  const { conditionsMet, total, barca, manu, trophy } = computeScore(draft);

  // jauge
  const clamped = Math.max(0, Math.min(100, total));
  const progress = document.getElementById("gauge-progress");
  progress.style.strokeDashoffset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  let color = "var(--bad)";
  if (total >= 100) color = "var(--warn)";
  else if (total >= 75) color = "var(--good)";
  else if (total >= 50) color = "#7fd99a";
  else if (total >= 25) color = "#c9c95a";
  progress.style.stroke = color;

  document.getElementById("gauge-value").textContent = total;
  document.getElementById("gauge-emoji").textContent = emojiForScore(total);
  document.getElementById("gauge-label").textContent = total >= 100 ? "100% Happiness 🔥" : "Happiness";

  const gaugeCard = document.querySelector(".gauge-card");
  if (total >= 100 && lastScoreSeen !== null && lastScoreSeen < 100) {
    triggerCelebration();
  }
  gaugeCard.classList.toggle("is-100", total >= 100);
  lastScoreSeen = total;

  // chips bonus
  const chipsRow = document.getElementById("gauge-bonus-row");
  chipsRow.innerHTML = "";
  if (barca) chipsRow.appendChild(makeChip(`🚫🔵🔴 Barça +${barca}%`, "is-bonus"));
  if (manu) chipsRow.appendChild(makeChip(`🚫🔴 Man Utd +${manu}%`, "is-bonus-alt"));
  if (trophy) chipsRow.appendChild(makeChip(`🏆 x${draft.trophies} +${trophy}%`, "is-bonus"));

  // cartes conditions
  const grid = document.getElementById("conditions-grid");
  grid.innerHTML = "";
  for (const fav of FAVORITES) {
    const state = draft.conditions[fav.key];
    const met = state.met;
    const played = state.played;
    const card = document.createElement("div");
    card.className = `cond-card${met && played ? " is-met" : ""}${played ? "" : " is-not-played"}`;
    card.style.setProperty("--club-color", fav.color);
    card.innerHTML = `
      <div class="cond-card-head">
        <span class="cond-flag">${fav.flag}</span>
        <span class="cond-name">${fav.label}</span>
      </div>
      <div class="cond-status">
        <span>${played ? fav.condition : "N'a pas joué"}</span>
        <span class="cond-badge ${met && played ? "is-yes" : "is-no"}">${played ? (met ? "✅" : "❌") : "—"}</span>
      </div>
      <div class="cond-hint">${played ? `Touche pour ${met ? "annuler" : "valider"}` : "Exclue du calcul cette période"}</div>
      <button type="button" class="cond-not-played-btn" data-key="${fav.key}">
        ${played ? "🚫 Marquer : pas de match" : "↩️ A joué cette semaine"}
      </button>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".cond-not-played-btn")) return; // géré par son propre listener
      if (!draft.conditions[fav.key].played) return; // rien à cocher si exclue
      draft.conditions[fav.key].met = !draft.conditions[fav.key].met;
      saveDraft(draft);
      renderDashboard();
    });
    card.querySelector(".cond-not-played-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const s = draft.conditions[fav.key];
      s.played = !s.played;
      if (!s.played) s.met = false;
      saveDraft(draft);
      renderDashboard();
    });
    grid.appendChild(card);
  }

  // toggles bonus
  updateToggle("barcaNoWin");
  updateToggle("manuNoWin");
  document.getElementById("trophy-count").textContent = draft.trophies;
  document.getElementById("period-start").value = draft.startDate;
  document.getElementById("period-end").value = draft.endDate;
}

function updateToggle(key) {
  const btn = document.querySelector(`.toggle-switch[data-key="${key}"]`);
  btn.classList.toggle("is-on", !!draft[key]);
}

function makeChip(text, cls) {
  const chip = document.createElement("span");
  chip.className = `chip ${cls}`;
  chip.textContent = text;
  return chip;
}

function triggerCelebration() {
  const layer = document.getElementById("celebration-layer");
  layer.hidden = false;
  layer.innerHTML = "";
  const colors = ["#39d98a", "#fdd835", "#c8102e", "#7c5cff", "#ffb020", "#ffffff"];
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!prefersReduced) {
    for (let i = 0; i < 80; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = `${2 + Math.random() * 1.8}s`;
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      layer.appendChild(piece);
    }
  }

  setTimeout(() => {
    layer.hidden = true;
    layer.innerHTML = "";
  }, 4200);
}

// ---------------------------------------------------------
// Rendu — Historique
// ---------------------------------------------------------
function renderHistory() {
  const history = loadHistory();
  renderLast100(history);

  const list = document.getElementById("history-list");
  if (history.length === 0) {
    list.innerHTML = `<div class="empty-state">Aucune période enregistrée pour le moment. Coche tes conditions sur le Dashboard puis enregistre.</div>`;
    return;
  }

  const sorted = [...history].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  list.innerHTML = "";
  for (const entry of sorted) {
    const { conditionsMet, conditionsPlayed, total } = computeScore(entry);
    const conditions = entry.conditions || {};
    const div = document.createElement("div");
    const isCoreFull = conditionsPlayed > 0 && conditionsMet === conditionsPlayed;
    div.className = `day-entry${isCoreFull ? " is-full" : ""}`;

    const metLabels = FAVORITES.filter((f) => conditions[f.key]?.played && conditions[f.key]?.met)
      .map((f) => `${f.flag} ${f.label}`);
    const notPlayedLabels = FAVORITES.filter((f) => !(conditions[f.key]?.played ?? true))
      .map((f) => `${f.flag} n'a pas joué`);
    const bonusLabels = [];
    if (entry.barcaNoWin) bonusLabels.push("🚫 Barça");
    if (entry.manuNoWin) bonusLabels.push("🚫 Man Utd");
    if (entry.trophies) bonusLabels.push(`🏆 x${entry.trophies}`);
    const detail = [...metLabels, ...bonusLabels, ...notPlayedLabels].join(" · ") || "Rien coché";
    const scoreSub = conditionsPlayed < 4 ? `${conditionsMet}/${conditionsPlayed} ont joué` : "";

    div.innerHTML = `
      <div class="day-score">${total}%${scoreSub ? `<div class="day-score-sub">${scoreSub}</div>` : ""}</div>
      <div class="day-info">
        <div class="day-date">${formatRange(entry.startDate, entry.endDate)}</div>
        <div class="day-conditions">${detail}</div>
      </div>
      <button class="day-delete" aria-label="Supprimer" data-id="${entry.id}">🗑️</button>
    `;
    list.appendChild(div);
  }

  list.querySelectorAll(".day-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const updated = loadHistory().filter((e) => e.id !== id);
      saveHistory(updated);
      renderHistory();
    });
  });
}

function renderLast100(history) {
  const el = document.getElementById("last100-content");
  const full = history
    .filter((e) => {
      const { conditionsMet, conditionsPlayed } = computeScore(e);
      return conditionsPlayed > 0 && conditionsMet === conditionsPlayed;
    })
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];

  if (!full) {
    el.innerHTML = "Aucune période à 100% enregistrée pour le moment.";
    return;
  }
  el.innerHTML = `<strong>${formatRange(full.startDate, full.endDate)}</strong> — toutes les équipes qui ont joué ont assuré 🔥`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function formatShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatRange(startIso, endIso) {
  if (!startIso) return "Date inconnue";
  if (!endIso || startIso === endIso) return formatDate(startIso);
  return `${formatShort(startIso)} → ${formatShort(endIso)}`;
}

// ---------------------------------------------------------
// Navigation par onglets
// ---------------------------------------------------------
function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.dataset.view !== name));
  if (name === "history") renderHistory();
}

// ---------------------------------------------------------
// Init
// ---------------------------------------------------------
function init() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll(".toggle-switch").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      draft[key] = !draft[key];
      saveDraft(draft);
      renderDashboard();
    });
  });

  document.getElementById("trophy-plus").addEventListener("click", () => {
    draft.trophies = (draft.trophies || 0) + 1;
    saveDraft(draft);
    renderDashboard();
  });
  document.getElementById("trophy-minus").addEventListener("click", () => {
    draft.trophies = Math.max(0, (draft.trophies || 0) - 1);
    saveDraft(draft);
    renderDashboard();
  });

  document.getElementById("period-start").addEventListener("change", (e) => {
    draft.startDate = e.target.value;
    saveDraft(draft);
  });
  document.getElementById("period-end").addEventListener("change", (e) => {
    draft.endDate = e.target.value;
    saveDraft(draft);
  });

  document.getElementById("save-btn").addEventListener("click", () => {
    const history = loadHistory();
    history.push({ ...draft, id: `entry-${Date.now()}` });
    saveHistory(history);

    draft = blankDraft();
    saveDraft(draft);
    renderDashboard();
    alert("Période enregistrée dans l'historique ✅");
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    if (!confirm("Réinitialiser les cases cochées sans les enregistrer ?")) return;
    draft = blankDraft();
    saveDraft(draft);
    renderDashboard();
  });

  renderDashboard();
}

init();
