# 🗿🔥 100% Happiness Tracker

Un tracker personnel qui calcule ton "taux de bonheur" en fonction des résultats
de tes 4 favoris :

| Favori | Condition | Poids |
|---|---|---|
| 🇵🇹 Cristiano Ronaldo (Al-Nassr) | A marqué un but | +25% |
| 🤍 Real Madrid | Gagne son match | +25% |
| 🟡 FC Nantes | Gagne son match | +25% |
| 🔴 Liverpool FC | Gagne son match | +25% |

**Bonus/malus additionnels :**
- 🚫🔵🔴 Le FC Barcelone **ne gagne pas** → +5%
- 🚫🔴 Manchester United **ne gagne pas** → +2%
- 🏆 Un trophée gagné par l'un des favoris → +50% (cumulable)

Le score peut donc dépasser 100% — la jauge se remplit à fond et l'appli
passe en mode célébration (🗿🔥 + confettis) dès que les 4 conditions
principales sont réunies.

---

## Sommaire

1. [Architecture](#architecture)
2. [Installation locale](#installation-locale)
3. [Configuration de l'API football](#configuration-de-lapi-football)
4. [Déployer le proxy (Cloudflare Worker)](#déployer-le-proxy-cloudflare-worker)
5. [Déployer le site sur GitHub Pages](#déployer-le-site-sur-github-pages)
6. [Structure des fichiers](#structure-des-fichiers)
7. [Gestion des erreurs](#gestion-des-erreurs)
8. [Limites connues](#limites-connues)

---

## Architecture

GitHub Pages n'héberge que des fichiers statiques (HTML/CSS/JS) : **il est
impossible d'y cacher une clé API**, tout ce qui est envoyé au navigateur est
public. Ce projet utilise donc une architecture en deux parties :

```
┌────────────────────┐        ┌──────────────────────┐        ┌───────────────────┐
│  GitHub Pages       │  GET   │  Cloudflare Worker    │  GET   │  API-Football      │
│  (frontend statique)│ ─────► │  (proxy, clé secrète) │ ─────► │  v3.football.api-  │
│  index.html + JS    │ ◄───── │  worker/worker.js     │ ◄───── │  sports.io         │
└────────────────────┘        └──────────────────────┘        └───────────────────┘
```

- Le **frontend** (racine du repo) ne contient aucune clé API. Il appelle
  l'URL de ton Worker, stockée dans `localStorage` via la modale de réglages
  (⚙️ en haut à droite).
- Le **Worker** (dossier `/worker`) tourne gratuitement sur Cloudflare
  (100 000 requêtes/jour offertes) et ajoute la clé API-Football en en-tête
  avant de relayer la requête vers l'API. La clé n'est jamais visible côté
  client.
- Une liste blanche d'endpoints (`teams`, `players`, `fixtures`,
  `fixtures/events`) limite ce que le proxy peut faire, et `ALLOWED_ORIGIN`
  permet de restreindre l'accès à ton propre site si tu le souhaites.

> Tu peux aussi utiliser un **mode "clé directe"** (sans Worker) pour tester
> en local : la clé API est alors saisie directement dans les réglages de
> l'appli et part depuis ton navigateur. Pratique pour du dev rapide, mais
> **la clé est alors visible par n'importe qui inspectant le trafic réseau** —
> à ne jamais utiliser en production publique.

Aucune donnée (calendrier, résultats, buteurs) n'est codée en dur : tout est
récupéré en direct depuis l'API-Football, avec un cache léger en
`localStorage` pour limiter le nombre de requêtes (30 min pour les prochains
matchs, 6h pour les résultats, 24h pour les événements de match).

Les IDs des équipes et du joueur sont **résolus dynamiquement** par
recherche de nom auprès de l'API (`/teams?search=`, `/players?search=`), pas
figés dans le code : si l'API change ses identifiants ou si tu changes de
club préféré, il suffit de modifier `js/config.js`.

---

## Installation locale

Le site est en JavaScript "vanilla" (aucun build) : tu peux l'ouvrir
directement, mais un petit serveur local évite les soucis de CORS avec les
modules ES :

```bash
git clone https://github.com/TON-PSEUDO/100-happiness-tracker.git
cd 100-happiness-tracker

# N'importe quel serveur statique fonctionne, par exemple :
npx serve .
# ou
python3 -m http.server 8080
```

Ouvre ensuite `http://localhost:8080`, clique sur ⚙️ et renseigne l'URL de
ton proxy (voir section suivante).

---

## Configuration de l'API football

Ce projet utilise **[API-Football](https://www.api-football.com/)** (plan
gratuit : 100 requêtes/jour), qui couvre la Liga, la Ligue 1, la Premier
League et la Saudi Pro League (Al-Nassr) — tout ce qu'il faut pour les 4
favoris.

1. Crée un compte gratuit sur [api-football.com](https://www.api-football.com/)
   ou via [RapidAPI](https://rapidapi.com/api-sports/api/api-football).
2. Récupère ta clé API dans ton tableau de bord.
3. Garde cette clé secrète — elle ira dans le Worker (jamais dans le repo).

---

## Déployer le proxy (Cloudflare Worker)

Le plan gratuit de Cloudflare Workers (100 000 requêtes/jour) suffit très
largement pour un usage personnel.

```bash
cd worker
npm install -g wrangler   # si ce n'est pas déjà fait
wrangler login

# Configure la clé API en secret (jamais dans un fichier versionné)
wrangler secret put API_FOOTBALL_KEY
# → colle ta clé API-Football quand demandé

# (optionnel) édite wrangler.toml pour fixer ALLOWED_ORIGIN
# sur l'URL de ton site GitHub Pages

wrangler deploy
```

Wrangler affiche à la fin une URL du type :
`https://happiness-tracker-proxy.TON-COMPTE.workers.dev`

C'est cette URL que tu colles dans les réglages (⚙️) de l'application, dans
le champ **"URL du proxy"**.

---

## Déployer le site sur GitHub Pages

1. Crée un dépôt GitHub et pousse le contenu de ce projet (racine du repo =
   racine du site, donc `index.html` doit être à la racine).

   ```bash
   git init
   git add .
   git commit -m "Initial commit — 100% Happiness Tracker"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/100-happiness-tracker.git
   git push -u origin main
   ```

2. Dans GitHub : **Settings → Pages → Build and deployment → Source**,
   choisis **"GitHub Actions"**.

3. Le workflow fourni (`.github/workflows/deploy.yml`) se déclenche
   automatiquement à chaque `push` sur `main` et publie le site — aucune
   configuration supplémentaire n'est nécessaire.

4. Après quelques dizaines de secondes, ton site est disponible sur
   `https://TON-PSEUDO.github.io/100-happiness-tracker/`.

5. Ouvre le site, clique sur ⚙️, colle l'URL de ton Worker → c'est prêt.

---

## Structure des fichiers

```
100-happiness-tracker/
├── index.html                  # page unique (dashboard, calendrier, résultats, historique)
├── css/
│   └── style.css                # thème sombre "scoreboard de stade"
├── js/
│   ├── config.js                 # favoris, rivaux, clés de cache, constantes
│   ├── api.js                    # client API-Football (proxy ou clé directe) + cache
│   ├── happiness.js               # calcul du score, timeline, recherche du dernier 100%
│   ├── dashboard.js               # rendu de la jauge, des cartes, des bonus, célébration
│   ├── calendar.js                # rendu de l'onglet Calendrier
│   ├── results.js                 # rendu de l'onglet Résultats
│   ├── history.js                 # rendu de l'onglet Historique + trophées manuels
│   └── app.js                     # navigation, réglages, orchestration générale
├── worker/
│   ├── worker.js                  # proxy Cloudflare Worker (protège la clé API)
│   └── wrangler.toml              # configuration de déploiement du Worker
├── .github/workflows/deploy.yml   # déploiement automatique sur GitHub Pages
├── .env.example
├── .gitignore
└── README.md
```

---

## Gestion des erreurs

L'application est conçue pour ne jamais planter silencieusement :

- Si aucune source de données n'est configurée → bandeau rouge invitant à
  ouvrir les réglages.
- Si le navigateur est hors-ligne → message explicite ("Tu sembles
  hors-ligne").
- Si l'API renvoie une erreur ou dépasse le quota (`429`) → message dédié
  ("Limite de requêtes atteinte, réessaie plus tard").
- Si un match ou un événement précis manque de données → l'appli affiche
  "Pas de match récent trouvé" au lieu de planter, et continue d'afficher le
  reste du dashboard normalement.
- Le bouton **"🔄 Actualiser les données"** vide le cache local et relance
  tous les appels.

---

## Limites connues

- **Trophées automatiques** : la détection est heuristique (elle repose sur
  le libellé du round de la compétition contenant "Finale"/"Final"). Elle
  couvre bien les finales de coupe, mais **pas** les titres de championnat
  (pas de "match de la finale" à proprement parler). Utilise le formulaire
  "Ajouter un trophée manuellement" dans l'onglet Historique pour ces cas-là.
- **Quota gratuit API-Football** : 100 requêtes/jour. Le cache local limite
  fortement la consommation, mais des rafraîchissements manuels très
  fréquents peuvent l'épuiser.
- **Historique limité** : la timeline se base sur les ~12 derniers matchs de
  chaque équipe (limite du plan gratuit et volonté de ne pas exploser le
  quota), pas sur l'intégralité de la saison.
