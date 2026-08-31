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
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return blankDraft();
}

function blankDraft() {
  return {
    ronaldo: false,
    real: false,
    nantes: false,
    liverpool: false,
    barcaNoWin: false,
    manuNoWin: false,
    trophies: 0,
    date: new Date().toISOString().slice(0, 10),
  };
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
  const conditionsMet = FAVORITES.filter((f) => d[f.key]).length;
  const base = conditionsMet * 25;
  const barca = d.barcaNoWin ? 5 : 0;
  const manu = d.manuNoWin ? 2 : 0;
  const trophy = (d.trophies || 0) * 50;
  return { conditionsMet, total: base + barca + manu + trophy, barca, manu, trophy };
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
    const met = draft[fav.key];
    const card = document.createElement("button");
    card.type = "button";
    card.className = `cond-card${met ? " is-met" : ""}`;
    card.style.setProperty("--club-color", fav.color);
    card.innerHTML = `
      <div class="cond-card-head">
        <span class="cond-flag">${fav.flag}</span>
        <span class="cond-name">${fav.label}</span>
      </div>
      <div class="cond-status">
        <span>${fav.condition}</span>
        <span class="cond-badge ${met ? "is-yes" : "is-no"}">${met ? "✅" : "❌"}</span>
      </div>
      <div class="cond-hint">Touche pour ${met ? "annuler" : "valider"}</div>
    `;
    card.addEventListener("click", () => {
      draft[fav.key] = !draft[fav.key];
      saveDraft(draft);
      renderDashboard();
    });
    grid.appendChild(card);
  }

  // toggles bonus
  updateToggle("barcaNoWin");
  updateToggle("manuNoWin");
  document.getElementById("trophy-count").textContent = draft.trophies;
  document.getElementById("period-date").value = draft.date;
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

  const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = "";
  for (const entry of sorted) {
    const { conditionsMet, total } = computeScore(entry);
    const div = document.createElement("div");
    div.className = `day-entry${conditionsMet === 4 ? " is-full" : ""}`;
    const metLabels = FAVORITES.filter((f) => entry[f.key]).map((f) => `${f.flag} ${f.label}`);
    const bonusLabels = [];
    if (entry.barcaNoWin) bonusLabels.push("🚫 Barça");
    if (entry.manuNoWin) bonusLabels.push("🚫 Man Utd");
    if (entry.trophies) bonusLabels.push(`🏆 x${entry.trophies}`);
    const detail = [...metLabels, ...bonusLabels].join(" · ") || "Rien coché";

    div.innerHTML = `
      <div class="day-score">${total}%</div>
      <div class="day-info">
        <div class="day-date">${formatDate(entry.date)}</div>
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
    .filter((e) => computeScore(e).conditionsMet === 4)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  if (!full) {
    el.innerHTML = "Aucune période à 4/4 enregistrée pour le moment.";
    return;
  }
  el.innerHTML = `<strong>${formatDate(full.date)}</strong> — les 4 conditions étaient réunies 🔥`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
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

  document.getElementById("period-date").addEventListener("change", (e) => {
    draft.date = e.target.value;
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
