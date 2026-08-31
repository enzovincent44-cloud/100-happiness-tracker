import { FAVORITES, RIVALS } from "./config.js";
import { emojiForScore } from "./happiness.js";

const CIRCUMFERENCE = 2 * Math.PI * 96; // r=96, cf. index.html

let lastRenderedScore = null;

export function renderDashboard(state) {
  renderGauge(state.totalScore);
  renderConditions(state.conditions);
  renderBonuses(state.bonuses);

  if (state.totalScore >= 100 && lastRenderedScore !== null && lastRenderedScore < 100) {
    triggerCelebration();
  }
  if (state.totalScore >= 100) {
    document.querySelector(".gauge-card").classList.add("is-100");
  } else {
    document.querySelector(".gauge-card").classList.remove("is-100");
  }
  lastRenderedScore = state.totalScore;
}

function renderGauge(score) {
  const clamped = Math.max(0, Math.min(100, score));
  const progress = document.getElementById("gauge-progress");
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  progress.style.strokeDashoffset = offset;

  let color = "var(--bad)";
  if (score >= 100) color = "var(--warn)";
  else if (score >= 75) color = "var(--good)";
  else if (score >= 50) color = "#7fd99a";
  else if (score >= 25) color = "#c9c95a";
  progress.style.stroke = color;

  document.getElementById("gauge-value").textContent = Math.round(score);
  document.getElementById("gauge-emoji").textContent = emojiForScore(score);

  const label = document.getElementById("gauge-label");
  label.textContent = score >= 100 ? "100% Happiness 🔥" : "Happiness";
}

function renderConditions(conditions) {
  const grid = document.getElementById("conditions-grid");
  grid.innerHTML = "";

  for (const key of ["ronaldo", "real", "nantes", "liverpool"]) {
    const fav = FAVORITES[key];
    const cond = conditions[key];
    const card = document.createElement("div");
    card.className = `cond-card${cond.met ? " is-met" : ""}`;
    card.style.setProperty("--club-color", fav.color);
    card.innerHTML = `
      <div class="cond-card-head">
        <span class="cond-flag">${fav.flag}</span>
        <span class="cond-name">${fav.label}</span>
      </div>
      <div class="cond-status">
        <span>${fav.conditionLabel}</span>
        <span class="cond-badge ${cond.met ? "is-yes" : "is-no"}">${cond.met ? "✅" : "❌"}</span>
      </div>
      <div class="cond-detail">${cond.detail}</div>
    `;
    grid.appendChild(card);
  }
}

function renderBonuses(bonuses) {
  const chipsRow = document.getElementById("gauge-bonus-row");
  chipsRow.innerHTML = "";
  if (bonuses.barca.active) {
    chipsRow.appendChild(makeChip(`🚫🔵🔴 Barça +${bonuses.barca.amount}%`, "is-bonus"));
  }
  if (bonuses.manu.active) {
    chipsRow.appendChild(makeChip(`🚫🔴 Man Utd +${bonuses.manu.amount}%`, "is-bonus-alt"));
  }
  if (bonuses.trophies.length > 0) {
    chipsRow.appendChild(makeChip(`🏆 x${bonuses.trophies.length} +${bonuses.trophyAmount}%`, "is-bonus"));
  }

  const list = document.getElementById("bonus-list");
  list.innerHTML = "";
  list.appendChild(
    bonusRow("🚫🔵🔴 FC Barcelone ne gagne pas", `+${RIVALS.barcelona.bonusPercent}%`, bonuses.barca.active)
  );
  list.appendChild(
    bonusRow("🚫🔴 Man United ne gagne pas", `+${RIVALS.manUnited.bonusPercent}%`, bonuses.manu.active)
  );
  list.appendChild(
    bonusRow(
      "🏆 Trophée(s) récents (30j)",
      bonuses.trophies.length ? `+${bonuses.trophyAmount}% (${bonuses.trophies.length})` : "+0%",
      bonuses.trophies.length > 0
    )
  );
}

function bonusRow(label, amount, active) {
  const row = document.createElement("div");
  row.className = `bonus-row${active ? " is-active" : ""}`;
  row.innerHTML = `<span>${label}</span><span class="bonus-amount">${amount}</span>`;
  return row;
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
