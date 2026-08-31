/**
 * 100% Happiness Tracker — proxy API-Football
 * ---------------------------------------------------------
 * Ce Worker Cloudflare fait office de backend minimal : il
 * reçoit les requêtes du frontend GitHub Pages, ajoute la
 * clé API-Football secrète (jamais exposée au navigateur),
 * puis relaie la réponse.
 *
 * Déploiement : voir le README.md à la racine du projet.
 *
 * Variable d'environnement attendue (secret Worker) :
 *   API_FOOTBALL_KEY
 *
 * Variable optionnelle :
 *   ALLOWED_ORIGIN  (ex: "https://tonpseudo.github.io")
 *   Si absente, l'accès est ouvert (utile en développement).
 */

const UPSTREAM_BASE = "https://v3.football.api-sports.io";

// Endpoints autorisés à traverser le proxy (liste blanche).
const ALLOWED_ENDPOINTS = new Set([
  "teams",
  "players",
  "fixtures",
  "fixtures/events",
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    const corsHeaders = {
      "Access-Control-Allow-Origin":
        allowedOrigin === "*" ? "*" : allowedOrigin === origin ? origin : "null",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Méthode non autorisée" }, 405, corsHeaders);
    }

    const endpoint = url.pathname.replace(/^\/+/, "");
    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      return jsonResponse({ error: "Endpoint non autorisé" }, 404, corsHeaders);
    }

    if (!env.API_FOOTBALL_KEY) {
      return jsonResponse(
        { error: "Clé API manquante côté serveur (secret API_FOOTBALL_KEY non configuré)." },
        500,
        corsHeaders
      );
    }

    const upstreamUrl = `${UPSTREAM_BASE}/${endpoint}${url.search}`;

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        headers: { "x-apisports-key": env.API_FOOTBALL_KEY },
        cf: { cacheTtl: 300, cacheEverything: true },
      });
    } catch (err) {
      return jsonResponse({ error: "Impossible de contacter API-Football." }, 502, corsHeaders);
    }

    const body = await upstreamResponse.text();
    return new Response(body, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  },
};

function jsonResponse(obj, status, corsHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
