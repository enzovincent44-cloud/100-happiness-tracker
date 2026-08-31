import { loadSettings, saveSettings } from "./config.js";
import { isConfigured, ApiError, clearAllCache } from "./api.js";
import { resolveAllIds, computeCurrentState } from "./happiness.js";
import { renderDashboard } from "./dashboard.js";
import { renderCalendar } from "./calendar.js";
import { renderResults } from "./results.js";
import { renderHistory, setupTrophyForm, invalidateHistoryCache } from "./history.js";

let resolvedIds = null;
let loadedTabs = new Set();

// ---------------------------------------------------------
// Navigation par onglets
// ---------------------------------------------------------
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.dataset.view !== name));

  if (!resolvedIds) return; // pas encore prêt / pas configuré

  if (name === "calendar" && !loadedTabs.has("calendar")) {
    loadedTabs.add("calendar");
    renderCalendar(resolvedIds).catch(showError);
  }
  if (name === "results" && !loadedTabs.has("results")) {
    loadedTabs.add("results");
    renderResults(resolvedIds).catch(showError);
  }
  if (name === "history" && !loadedTabs.has("history")) {
    loadedTabs.add("history");
    renderHistory(resolvedIds).catch(showError);
  }
}

// ---------------------------------------------------------
// Gestion des erreurs
// ---------------------------------------------------------
function showError(err) {
  console.error(err);
  const banner = document.getElementById("error-banner");
  const text = document.getElementById("error-banner-text");
  text.textContent = err instanceof ApiError ? err.message : "Une erreur inattendue est survenue.";
  banner.hidden = false;
}

function hideError() {
  document.getElementById("error-banner").hidden = true;
}

// ---------------------------------------------------------
// Réglages (modale)
// ---------------------------------------------------------
function setupSettings(onSaved) {
  const modal = document.getElementById("settings-modal");
  const openBtn = document.getElementById("settings-btn");
  const cancelBtn = document.getElementById("settings-cancel");
  const saveBtn = document.getElementById("settings-save");
  const proxyInput = document.getElementById("setting-proxy-url");
  const keyInput = document.getElementById("setting-api-key");

  openBtn.addEventListener("click", () => {
    const s = loadSettings();
    proxyInput.value = s.proxyUrl || "";
    keyInput.value = s.apiKey || "";
    modal.hidden = false;
  });

  cancelBtn.addEventListener("click", () => (modal.hidden = true));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });

  saveBtn.addEventListener("click", () => {
    saveSettings({ proxyUrl: proxyInput.value.trim(), apiKey: keyInput.value.trim() });
    modal.hidden = true;
    onSaved();
  });
}

// ---------------------------------------------------------
// Chargement principal
// ---------------------------------------------------------
async function bootstrapData({ force = false } = {}) {
  hideError();

  if (!isConfigured()) {
    showError(new ApiError("Aucune source de données configurée. Ouvre les réglages (⚙️) pour commencer."));
    return;
  }

  if (force) {
    clearAllCache();
    invalidateHistoryCache();
  }

  try {
    resolvedIds = await resolveAllIds();
    const state = await computeCurrentState(resolvedIds);
    renderDashboard(state);

    // recharge les onglets déjà visités
    loadedTabs.forEach((tab) => {
      if (tab === "calendar") renderCalendar(resolvedIds).catch(showError);
      if (tab === "results") renderResults(resolvedIds).catch(showError);
      if (tab === "history") renderHistory(resolvedIds, { force }).catch(showError);
    });
  } catch (err) {
    showError(err);
  }
}

function setupRefresh() {
  document.getElementById("refresh-btn").addEventListener("click", () => {
    bootstrapData({ force: true });
  });
}

function setupErrorBanner() {
  document.getElementById("error-banner-close").addEventListener("click", hideError);
}

function setupTrophies() {
  setupTrophyForm(() => {
    if (resolvedIds) renderHistory(resolvedIds).catch(showError);
  });
  // date par défaut = aujourd'hui
  const dateInput = document.getElementById("trophy-date");
  dateInput.value = new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------
// Init
// ---------------------------------------------------------
function init() {
  setupTabs();
  setupErrorBanner();
  setupRefresh();
  setupTrophies();
  setupSettings(() => bootstrapData({ force: true }));

  window.addEventListener("offline", () => showError(new ApiError("Connexion internet perdue.", { offline: true })));

  bootstrapData();
}

init();
