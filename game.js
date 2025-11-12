"use strict";

// Jeu 2D HTML5 Canvas – Rourn Duo Catch
// - Aucune librairie externe, fonctionne en ouvrant index.html
// - Espace virtuel: 1280x720 (16:9). L'affichage est mis à l'échelle.
// - Contrôles: J1 = ZQSD, J2 = Flèches. P = Pause, Espace = Démarrer, R = Rejouer, Échap = Menu, M = Son.

// -----------------------------
// Titre de l'onglet avec version
// -----------------------------
function setVersionTitle() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ver = params.get("v");
    if (ver) {
      document.title = `RouRn-${ver}`;
      return;
    }
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const ts = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    document.title = `RouRn-${ts}`;
  } catch (_) {
    document.title = "RouRn";
  }
}
setVersionTitle();

// -----------------------------
// Constantes (réglages rapides)
// -----------------------------
const VW = 1280;              // Largeur virtuelle (16:9)
const VH = 720;               // Hauteur virtuelle (16:9)
const GAME_DURATION = 130;    // Durée en secondes (2 min 10 s)
const PLAYER_SPEED = 300;     // Vitesse des joueurs (px/s)
const MAX_ITEMS = 60;         // Limite d'items simultanés

// Tailles d'affichage (mise à l'échelle des sprites)
const PLAYER_BASE_W = 80;     // largeur cible des joueurs, hauteur auto selon ratio
const ITEM_BASE_W = 56;       // largeur cible des items, hauteur auto selon ratio
const BASELINE_MARGIN = 12;   // marge par rapport au bas pour la ligne de base
const CHICKEN_FREE_SEC = 5;   // durée du mouvement libre après poulet
const CHICKEN_SCALE = 1.25;   // taille pendant l'effet poulet (un peu plus grand)
const BOMB_SHRINK_SEC = 5;    // durée de rétrécissement après bombe
const BOMB_SHRINK_SCALE = 0.5;  // taille pendant l'effet bombe (beaucoup plus petit)
const FALL_SPEED = 900;       // vitesse de chute vers la baseline (px/s)
const POULE_GROWTH_STEP = 0.05; // grossit de +5% à chaque poulet après transformation poule
// Note: plus de cap de grossissement pour la poule (croît sans limite)
const HOP_AMP = 22;           // amplitude de saut (tacos)
const HOP_FREQ = 8;           // fréquence des sauts (tacos)
const BURGER_SCALE = 1.0;     // burger: taille standard (pouvoir modifié en tirs)
const POULE_MAX_SCALE = 2.5;  // taille maximale de la poule
const EDGE_TOL = 2;           // tolérance pour coller aux bords (pizza)
const TACO_SHOT_INTERVAL = 1.0; // tir manuel: 1 tir/s (tacos/burger)
const TACO_SHOT_SPEED = 180;    // vitesse des projectiles tacos/burger (px/s)
const MAX_SHOTS = 24;           // sécurité de projectiles simultanés
const PIZZA_SHOT_INTERVAL = 1.0; // pizza: un tir/s
const PIZZA_SHOT_SPEED = 180;    // vitesse des peperoni (px/s)
const FEED_ICON_W = 32;       // largeur icône du feed (derniers items)
const FEED_ICON_GAP = 6;      // espacement entre icônes du feed
const FEED_MAX = 3;           // nombre d'items à afficher dans l'historique

// Apparition et difficulté progressive
const SPAWN_BASE_RATE = 1.2;        // items/sec au début
const DIFFICULTY_INTERVAL = 20;     // toutes les 20 s
const SPAWN_RATE_INCREMENT = 0.15;  // +0.15 items/sec par palier
const SPEED_MULT_INC = 0.05;        // +5% vitesse de chute par palier
const MAX_SPAWN_RATE = 3.5;         // cap du taux de spawn
const MAX_SPEED_MULT = 2.0;         // cap vitesse chute

// Petites marges pour collisions (AABB plus tolérant)
const COLLISION_PAD = 4; // px retranchés à chaque bord

// -----------------------------
// Canvas + Contexte + Échelle
// -----------------------------
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // limiter l'overdraw
let renderScale = 1; // facteur de mise à l'échelle pour passer de l'espace virtuel → pixels

function resizeCanvas() {
  // Calcul du plus grand rectangle 4:3 qui tient dans la fenêtre
  const ww = Math.max(1, window.innerWidth);
  const wh = Math.max(1, window.innerHeight);
  const scale = Math.min(ww / VW, wh / VH);

  const cssW = Math.floor(VW * scale);
  const cssH = Math.floor(VH * scale);

  // Taille CSS (affichée)
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";

  // Taille réelle en pixels (pour HiDPI)
  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.max(1, Math.floor(cssW * dpr));
  canvas.height = Math.max(1, Math.floor(cssH * dpr));

  // Facteur final pour dessiner l'espace virtuel
  renderScale = canvas.width / VW; // identique sur X et Y par construction
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// -----------------------------
// Gestion des assets (images)
// -----------------------------
const DEBUG_ASSETS = true; // Activer des logs détaillés pour le chargement d'images
// Astuce: si une image ne charge pas, on génère un placeholder (canvas) coloré.
function loadImage(name, src, placeholderColor = "#888") {
  return new Promise((resolve) => {
    const attempt = (pathList) => {
      if (pathList.length === 0) {
        // Fallback: canvas avec le nom de l'asset
        const ph = document.createElement("canvas");
        ph.width = 96;
        ph.height = 96;
        const pctx = ph.getContext("2d");
        pctx.fillStyle = placeholderColor;
        pctx.fillRect(0, 0, ph.width, ph.height);
        pctx.fillStyle = "#111";
        pctx.fillRect(3, 3, ph.width - 6, ph.height - 6);
        pctx.fillStyle = "#fff";
        pctx.font = "12px Arial";
        pctx.textAlign = "center";
        pctx.textBaseline = "middle";
        pctx.fillText(name, ph.width / 2, ph.height / 2);
        try { ph.__placeholder = true; } catch (_) {}
        console.warn(`[assets] Échec de chargement image '${name}' via toutes les tentatives`);
        return resolve(ph);
      }
      const url = pathList.shift();
      const img = new Image();
      img.onload = () => { try { if (DEBUG_ASSETS) console.info(`[assets] OK '${name}' from ${url}`); } catch(_){} resolve(img); };
      img.onerror = () => {
        // Essayer variante 'asset/' si on a 'assets/'
        attempt(pathList);
      };
      img.src = url;
    };
    const toList = (s) => Array.isArray(s) ? s.slice() : [s];
    attempt(toList(src));
  });
}

// Utilitaire de chemin d'assets (relatif depuis index.html)
const ASSET = (p) => `./assets/${p}`;

// Liste des assets attendus (fichiers dans assets/)
const ASSET_LIST = [
  { key: "fond", file: "fond.png", color: "#1b2a41" },
  { key: "rourn1", file: "rourn1.png", color: "#4461cf" },
  { key: "rourn2", file: "rourn2.png", color: "#cf4444" },
  // Transformations visuelles des joueurs
  { key: "rourntacos", file: "rourntacos.png", color: "#b56576" },
  { key: "rournpizza", file: "rournpizza.png", color: "#d4a373" },
  { key: "rournbrocolis", file: "rournbrocolis.png", color: "#5aa469" },
  { key: "rournburger", file: "rournburger.png", color: "#c9a227" },
  // Variantes/monde
  { key: "rourn-enfer", file: "rourn-enfer.png", color: "#8b0000" },
  { key: "tacostomato", file: "Tomato.png", color: "#c0392b" },
  { key: "tacossalad", file: "Salad.png", color: "#27ae60" },
  { key: "cheese", file: "cheese.png", color: "#ffd166" },
  { key: "pepperoni", file: "peperoni.png", color: "#b33f2a" },
  { key: "rourn1ailes", file: "rourn1ailes.png", color: "#8fb9ff" },
  { key: "rourn2ailes", file: "rourn2ailes.png", color: "#ff8fb9" },
  { key: "rournpoule", file: "rournpoule.png", color: "#deb887" },
  { key: "pizza", file: "pizza.png", color: "#d4a373" },
  { key: "burger", file: "burger.png", color: "#c9a227" },
  { key: "tacos", file: "Tacos.png", color: "#b56576" },
  { key: "brocolis", file: "brocolis.png", color: "#5aa469" },
  { key: "poulet", file: "poulet.png", color: "#ce9461" },
  { key: "bombe", file: "bombe.png", color: "#555" },
  // Monde ciel / couteau
  { key: "angepoulet", file: "angepoulet.png", color: "#f1e9ff" },
  { key: "etoile", file: "etoile.png", color: "#f5e663" },
  { key: "couteau", file: "couteau.png", color: "#999" },
  { key: "braise", file: "braise.png", color: "#ff6b35" },
  { key: "sucette", file: "sucette.png", color: "#ff77aa" },
  { key: "plateau", file: "plateau.png", color: "#cccccc" },
];

const ASSETS = Object.create(null); // key -> CanvasImageSource
let assetsLoaded = false;
let assetLoad = { total: 0, loaded: 0, current: "", errors: [] };
let audioLoad = { total: 0, loaded: 0, current: "", errors: [] };
// Chargement des fonds (fond-*.png) pour affichage de progression
let bgLoad = { total: 0, loaded: 0, current: "" };

// Variantes de casse utiles (dir conservé, variantes sur le nom)
function caseVariants(file) {
  const prefix = ASSET(""); // './assets/'
  const parts = file.split("/");
  const name = parts.pop() || "";
  const dot = name.lastIndexOf(".");
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : "";
  const dir = parts.length ? parts.join("/") + "/" : "";
  const out = new Set();
  const addPref = (pref, n) => out.add(pref + dir + n);
  const add = (n) => { addPref(prefix, n); addPref("assets/", n); addPref("./assets/", n); };
  add(name);
  add(name.toLowerCase());
  add(name.toUpperCase());
  const cap = (base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()) + ext.toLowerCase();
  add(cap);
  return Array.from(out);
}

function preloadAssets() {
  try { if (DEBUG_ASSETS) console.info('[assets] Preload start'); } catch(_){}
  assetLoad.total = ASSET_LIST.length;
  assetLoad.loaded = 0;
  assetLoad.current = "";
  assetLoad.errors = [];
  const promises = ASSET_LIST.map(({ key, file, color }) =>
    loadImage(key, caseVariants(file), color).then((img) => {
      ASSETS[key] = img;
      assetLoad.loaded += 1;
      assetLoad.current = file;
      if (img && img.__placeholder) { assetLoad.errors.push(file); try { if (DEBUG_ASSETS) console.warn('[assets] placeholder for', file); } catch(_){} }
      else { try { if (DEBUG_ASSETS) console.debug('[assets] loaded', file, 'as', key, img && (img.naturalWidth||img.width), 'x', img && (img.naturalHeight||img.height)); } catch(_){} }
    })
  );
  return Promise.all(promises).then(() => { assetsLoaded = true; try { if (DEBUG_ASSETS) console.info('[assets] Preload done. errors=', assetLoad.errors); } catch(_){} });
}

// -----------------------------
// Fonds dynamiques (fond*.png)
// -----------------------------
// On cherche automatiquement des fichiers dans assets/ qui commencent par
// "fond" (ex: fond.png, fond2.png, fond 2.png, ...). On ne peut pas lister
// le répertoire depuis le navigateur, donc on tente des noms probables.

// Chaque entrée: { img: Image, id: 'classique'|'couteau'|'ciel'|'enfer'|'espace'|null }
let bgImages = [];      // commence par fond.png si présent
let bgIndex = 0;        // index courant dans bgImages

// Propriétés du monde courant (dérivées du fond)
let worldId = 'classique';
let worldPlayerSpeedMult = 1.0;
let worldPlayerScaleMult = 1.0;
let worldFallMult = 1.0; // chute des items
let worldAllowAllDirs = false; // autoriser déplacements verticaux hors poulet
let worldOverridePlayerImgKey = null; // ex: 'rourn-enfer'
let worldKnifeSpawnRate = 0; // couteaux / sec additionnels
let worldBraiseSpawnRate = 0; // braises / sec additionnelles (enfer)

// Sélection de monde par le joueur (menu)
// 'multi' = comportement actuel (alternance sur bombe)
let fixedWorldMode = 'multi';
const WORLD_OPTIONS = ['multi','enfer','ciel','espace','cuisine','palmier'];
function cycleFixedWorld() {
  const i = WORLD_OPTIONS.indexOf(fixedWorldMode);
  fixedWorldMode = WORLD_OPTIONS[(i + 1) % WORLD_OPTIONS.length];
}

function setWorldFromId(id) {
  // Nettoyer les objets spécifiques de monde lors du changement
  try {
    const SPEC = new Set(['couteau','braise','angepoulet','etoile']);
    items = items.filter(it => !SPEC.has(it.type));
  } catch (_) {}
  worldId = id || 'classique';
  worldPlayerSpeedMult = 1.0;
  worldPlayerScaleMult = 1.0;
  worldFallMult = 1.0;
  worldAllowAllDirs = false;
  worldOverridePlayerImgKey = null;
  worldKnifeSpawnRate = 0;
  worldBraiseSpawnRate = 0;
  // Réinitialiser les accumulateurs de spawns spéciaux pour éviter des à-coups
  try { update.knifeAcc = 0; } catch (_) {}
  try { update.braiseAcc = 0; } catch (_) {}
  if (worldId === 'enfer') {
    worldPlayerScaleMult = 1.25;
    worldOverridePlayerImgKey = 'rourn-enfer';
    worldBraiseSpawnRate = 1.0;
  } else if (worldId === 'espace') {
    worldAllowAllDirs = true;
    worldPlayerSpeedMult = 0.75;
    worldFallMult = 0.8;
  } else if (worldId === 'ciel') {
    // remapping poulet -> angepoulet géré au spawn, chute normale
  } else if (worldId === 'couteau') {
    worldKnifeSpawnRate = 1.0; // moins de couteaux (jouable)
  }
}

function inferWorldIdFromName(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('fond-couteau')) return 'couteau';
  if (n.includes('fond-ciel')) return 'ciel';
  if (n.includes('fond-enfer')) return 'enfer';
  if (n.includes('fond-espace')) return 'espace';
  if (n.includes('fond-cuisine')) return 'cuisine';
  if (n.includes('fond-palmier')) return 'palmier';
  if (n.includes('fond-classique')) return 'classique';
  return 'classique';
}

function tryLoadExact(urls) {
  return new Promise((resolve) => {
    const list = Array.isArray(urls) ? urls : [urls];
    let i = 0;
    const attempt = () => {
      if (i >= list.length) { resolve(null); return; }
      const img = new Image();
      const u = list[i];
      img.onload = () => { try { if (DEBUG_ASSETS) console.info(`[assets] BG OK from ${u}`); } catch(_){} resolve(img); };
      img.onerror = () => { try { if (DEBUG_ASSETS) console.warn(`[assets] BG FAIL on ${u}`); } catch(_){} i++; attempt(); };
      img.src = u;
    };
    attempt();
  });
}

async function discoverBackgrounds(maxN = 50) {
  const candidates = [
    'fond.png',
    // variantes par numéro
    ...Array.from({ length: maxN - 1 }, (_, i) => `fond${i + 2}.png`),
    ...Array.from({ length: maxN - 1 }, (_, i) => `fond ${i + 2}.png`),
    // variantes par thème
    'fond-classique.png','fond-couteau.png','fond-ciel.png','fond-enfer.png','fond-espace.png','fond-cuisine.png','fond-palmier.png'
  ];
  // Initialiser la progression
  bgLoad.total = candidates.length;
  bgLoad.loaded = 0;
  bgLoad.current = '';
  const found = [];
  for (const name of candidates) {
    bgLoad.current = name;
    const urls = caseVariants(name);
    const img = await tryLoadExact(urls);
    if (img) {
      found.push({ img, id: inferWorldIdFromName(name) });
    }
    bgLoad.loaded += 1;
  }
  try { if (DEBUG_ASSETS) console.info('[assets] BG found:', found.map(f=>f.id)); } catch(_){}
  if (found.length === 0 && ASSETS['fond']) {
    bgImages = [{ img: ASSETS['fond'], id: 'classique' }];
  } else {
    bgImages = found;
  }
  // Choisir le fond initial selon le mode fixé
  if (fixedWorldMode !== 'multi') {
    const idx = Math.max(0, bgImages.findIndex(e => e.id === fixedWorldMode));
    bgIndex = idx >= 0 ? idx : 0;
    setWorldFromId(bgImages[bgIndex]?.id || 'classique');
  } else {
    bgIndex = 0;
    setWorldFromId(bgImages[0]?.id || 'classique');
  }
}

function nextBackground() {
  if (!bgImages || bgImages.length <= 1) return;
  bgIndex = (bgIndex + 1) % bgImages.length;
  setWorldFromId(bgImages[bgIndex]?.id || 'classique');
}

function getCurrentBackgroundImage() {
  if (bgImages && bgImages.length > 0) return bgImages[bgIndex].img;
  return ASSETS['fond']; // fallback tant que la découverte n'a pas terminé
}

// ---------------------------------
// Audio fichiers (sound2/*.wav) + musique (sound3banana/*.mp3) + modes
// ---------------------------------
const SOUND_MODE = { SFX: "sfx", MUSIC: "music", MUTE: "mute" };
let soundMode = SOUND_MODE.SFX; // sélection utilisateur (menu): SFX (défaut), MUSIC, MUTE
let audioEnabled = true;       // dérivé de soundMode != MUTE
let audioPreloaded = false;    // évite de bloquer le chargement initial
const AUDIO_LIST = [
  { key: "pbtb", file: "sound/pbtb.mp3" },
  { key: "pbtb2", file: "sound/pbtprourn2.mp3" },
  { key: "bombe", file: "sound/bombe.mp3" },
  { key: "poulet", file: "sound/poulet.mp3" },
  { key: "banana", file: "sound/chickenbanana.mp3" },
  { key: "fartprout", file: "sound/fartprout.mp3" },
];
const AUDIO = Object.create(null); // inutilisé désormais, conservé pour compat
const AUDIO_SOURCES = Object.create(null); // key -> array d'URLs candidates
const AUDIO_CACHE = Object.create(null);   // key -> préchargé (Audio) si disponible
const activeSounds = new Set();

function loadAudio(key, src) {
  // Prépare les variantes de casse et stocke les URLs candidates
  const variants = caseVariants(src);
  AUDIO_SOURCES[key] = variants;
  // Tente de précharger en amont (sans lecture) la première variante valide
  return new Promise((resolve) => {
    let idx = 0;
    const a = new Audio();
    a.preload = 'auto';
    const tryNext = () => {
      if (idx >= variants.length) { resolve(null); return; }
      a.src = variants[idx++];
      a.load();
      const done = () => { AUDIO_CACHE[key] = a; cleanup(); resolve(a); };
      const fail = () => { cleanup(); tryNext(); };
      const cleanup = () => {
        a.removeEventListener('canplaythrough', done);
        a.removeEventListener('loadeddata', done);
        a.removeEventListener('error', fail);
      };
      a.addEventListener('canplaythrough', done, { once: true });
      a.addEventListener('loadeddata', done, { once: true });
      a.addEventListener('error', fail, { once: true });
    };
    tryNext();
  });
}

function preloadAudio() {
  if (audioPreloaded) return Promise.resolve();
  audioLoad.total = AUDIO_LIST.length;
  audioLoad.loaded = 0;
  audioLoad.current = "";
  audioLoad.errors = [];
  const promises = AUDIO_LIST.map(({ key, file }) =>
    loadAudio(key, file).then((aud) => {
      AUDIO[key] = aud;
      audioLoad.loaded += 1;
      audioLoad.current = file;
      if (!aud) audioLoad.errors.push(file);
    })
  );
  return Promise.all(promises).then(() => { audioPreloaded = true; });
}

function playSound(key, { loop = false, durationSec = null, volume = 0.6 } = {}) {
  if (!audioEnabled) return null;
  let sources = AUDIO_SOURCES[key] || [];
  if ((!sources || sources.length === 0) && key === 'fartprout' && AUDIO_SOURCES['pbtb']) {
    console.warn('[audio] fartprout.mp3 introuvable, fallback vers pbtb.mp3');
    sources = AUDIO_SOURCES['pbtb'];
  }
  const a = new Audio();
  a.preload = 'none';
  a.loop = loop;
  a.volume = volume;
  let timer = null;
  const handle = {
    stop() {
      try { a.pause(); a.currentTime = 0; } catch (_) {}
      if (timer) clearTimeout(timer);
      activeSounds.delete(handle);
      a.src = '';
    }
  };
  const cached = AUDIO_CACHE[key] || (key==='fartprout' ? AUDIO_CACHE['pbtb'] : null);
  if (cached && (cached.currentSrc || cached.src)) {
    a.src = cached.currentSrc || cached.src;
    a.play().catch(() => {});
    if (durationSec && durationSec > 0) timer = setTimeout(() => handle.stop(), Math.floor(durationSec * 1000));
    activeSounds.add(handle);
    return handle;
  }
  let idx = 0;
  const tryPlay = () => {
    if (idx >= sources.length) { return; }
    a.src = sources[idx++];
    a.play().then(() => {
      if (durationSec && durationSec > 0) timer = setTimeout(() => handle.stop(), Math.floor(durationSec * 1000));
    }).catch(() => { tryPlay(); });
  };
  if (sources.length > 0) tryPlay();
  activeSounds.add(handle);
  return handle;
}

function stopAllSounds() {
  for (const h of Array.from(activeSounds)) h.stop();
  activeSounds.clear();
  if (typeof exclusiveSfxHandle !== 'undefined' && exclusiveSfxHandle && exclusiveSfxHandle.stop) {
    exclusiveSfxHandle.stop();
  }
  exclusiveSfxHandle = null;
  if (bgMusicHandle && bgMusicHandle.stop) bgMusicHandle.stop();
  bgMusicHandle = null;
}

let bgMusicHandle = null;
let exclusiveSfxHandle = null; // exclusif pour poulet/bombe en SFX
function playExclusiveSfx(key, opts) {
  if (soundMode !== SOUND_MODE.SFX) return null;
  if (exclusiveSfxHandle && exclusiveSfxHandle.stop) exclusiveSfxHandle.stop();
  exclusiveSfxHandle = playSound(key, opts);
  return exclusiveSfxHandle;
}
function setSoundMode(mode) {
  soundMode = mode;
  audioEnabled = (mode !== SOUND_MODE.MUTE);
  // Stopper tout, puis relancer si besoin
  stopAllSounds();
  if (mode === SOUND_MODE.MUSIC) {
    bgMusicHandle = playSound("banana", { loop: true, durationSec: null, volume: 0.6 });
  } else {
    bgMusicHandle = null;
  }
}

// -----------------------------
// -----------------------------
// Input clavier (keydown/keyup)
// -----------------------------
const keys = Object.create(null); // état des touches pressées
const pressedOnce = Object.create(null); // événements one-shot sur keydown

const PREVENT_KEYS = new Set([
  "ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","Spacebar","Space",
  "PageUp","PageDown","Home","End",
  // On ajoute nos touches de jeu pour éviter des effets de scroll sur certains OS
  "z","q","s","d","a","A","Z","Q","S","D","p","P","r","R","m","M","e","E","Enter","Escape"
]);

function onKeyDown(e) {
  const key = e.key;
  if (PREVENT_KEYS.has(key)) e.preventDefault();
  if (e.repeat) return; // éviter répétition auto pour les toggles
  keys[key] = true;
  pressedOnce[key] = true;
  // Déclenche le préchargement audio lors de la première interaction
  if (!audioPreloaded) preloadAudio();
}

function onKeyUp(e) {
  const key = e.key;
  if (PREVENT_KEYS.has(key)) e.preventDefault();
  keys[key] = false;
}

window.addEventListener("keydown", onKeyDown, { passive: false });
window.addEventListener("keyup", onKeyUp, { passive: false });

// -----------------------------
// Entités: Player et Item
// -----------------------------
class Player {
  constructor(imgKey, x, y) {
    this.imgKey = imgKey;
    this.defaultImgKey = imgKey; // clé par défaut (avatar de base)
    this.x = x;
    this.y = y;
    this.speed = PLAYER_SPEED;
    this.freeTime = 0;        // temps restant de mouvement libre (s)
    this.shrinkTime = 0;      // temps restant de rétrécissement (s)
    this.baseScale = 1;       // scale de base (persiste), modifiée par la poule
    this.scale = 1;           // scale final courant (avec effets)
    this.baselineY = y;       // sera ajusté après création
    this.isPoule = false;     // a été transformé en poule ?
    this.hasTransformed = false; // a déjà subi une transformation persistante ?
    this.chickenStreak = 0;   // nombre de poulets consécutifs attrapés
    this.angle = 0;           // rotation (pizza)
    this.hopPhase = 0;        // phase de saut (tacos)
    this.perimT = null;       // position le long du périmètre (pizza)
    this.tacoTimer = 0;       // accumulateur pour tirs auto (tacos/burger)
    this.tacoCycleIndex = 0;  // 0: tomato, 1: salad, 2: cheese
    this.pizzaTimer = 0;      // accumulateur pour tirs auto (pizza)
    this.forms = new Set();   // formes actives (pizza, burger, tacos, brocolis)
    this.lastForm = null;     // dernière forme attrapée (visuel en dev)
    // Effet poulet: apparence et déplacement doux vers le centre
    this.wingsKey = null;     // 'rourn1ailes' ou 'rourn2ailes'
    this.moveToCenterElapsed = 0;
    this.moveToCenterDur = 0;
    this.moveStartX = 0;
    this.moveStartY = 0;
    this.moveTargetX = 0;
    this.moveTargetY = 0;
    // Boost de vitesse temporaire (étoile)
    this.speedBoostTime = 0;  // secondes restantes
    this.starTime = 0;        // effet étoile: mouvement libre
  }
  get img() { return ASSETS[this.imgKey]; }
  get w() { return Math.round(PLAYER_BASE_W * this.scale); }
  get h() {
    const i = this.img;
    const baseH = (i && i.width && i.height)
      ? Math.round(PLAYER_BASE_W * (i.height / i.width))
      : PLAYER_BASE_W; // fallback carré
    return Math.max(1, Math.round(baseH * this.scale));
  }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dx, dy, dt) {
    // Ajuster la vitesse selon transformation (brocolis +35%)
    let sp = this.speed;
    if (hasForm(this, 'brocolis')) sp *= 1.35;
    // Modificateur de monde (ex: espace plus lent)
    sp *= (typeof worldPlayerSpeedMult === 'number' ? worldPlayerSpeedMult : 1);
    // Boost étoile
    if ((this.speedBoostTime || 0) > 0) sp *= 3;
    this.x += dx * sp * dt;
    this.y += dy * sp * dt;
    // Pizza: rotation; si hors poulet on utilisera la distance périmètre (gérée après),
    // sinon on utilise la composante dominante de vitesse
    if (hasForm(this, 'pizza') && this.freeTime > 0) {
      const rotVel = (Math.abs(dx) >= Math.abs(dy) ? dx : dy) * sp;
      this.angle += rotVel * dt * 0.12;
    }
    // Tacos: avance de phase (rythme plus marqué si on bouge)
    if (hasForm(this, 'tacos')) {
      const moveFactor = Math.max(0.4, Math.min(1.5, Math.abs(dx) * 1.2));
      this.hopPhase += dt * HOP_FREQ * moveFactor;
    } else {
      // décroissance douce de la phase si pas tacos
      this.hopPhase += dt * HOP_FREQ * 0.5;
    }
    // Confinement à l'écran virtuel
    if (this.x < 0) this.x = 0;
    if (this.y < 0) this.y = 0;
    if (this.x + this.w > VW) this.x = VW - this.w;
    if (this.y + this.h > VH) this.y = VH - this.h;
  }
  draw(g) {
    // Image: si effet poulet actif, dessiner la version "ailes" si disponible
    let baseImg = this.img;
    if (worldOverridePlayerImgKey && ASSETS[worldOverridePlayerImgKey]) baseImg = ASSETS[worldOverridePlayerImgKey];
    const img = (this.freeTime > 0 && this.wingsKey && ASSETS[this.wingsKey]) ? ASSETS[this.wingsKey] : baseImg;
    if (!img) return;
    const tf = getPlayerTransform(this);
    if (tf === "pizza") {
      // Dessin avec rotation autour du centre
      g.save();
      let jitterX = 0, jitterY = 0;
      if ((this.paralyzeTime||0) > 0) {
        const t = (typeof elapsed === 'number' ? elapsed : performance.now()/1000);
        jitterX = Math.sin(t * 40) * 2;
        jitterY = Math.cos(t * 50) * 2;
      }
      const cx = this.x + this.w / 2 + jitterX;
      const cy = this.y + this.h / 2 + jitterY;
      g.translate(cx, cy);
      g.rotate(this.angle);
      g.drawImage(img, -this.w / 2, -this.h / 2, this.w, this.h);
      g.restore();
    } else {
      g.save();
      if ((this.paralyzeTime||0) > 0) {
        const t = (typeof elapsed === 'number' ? elapsed : performance.now()/1000);
        g.translate(Math.sin(t * 40) * 2, Math.cos(t * 50) * 2);
      }
      g.drawImage(img, this.x, this.y, this.w, this.h);
      g.restore();
    }
  }
}

// Transformation visuelle selon l'aliment (après 10 captures d'un même type)
const TRANSFORM_MAP = {
  tacos: "rourntacos",
  pizza: "rournpizza",
  brocolis: "rournbrocolis",
  burger: "rournburger",
};

function maybeTransformPlayer(player, stats, type) {
  // Seuls ces 4 types déclenchent la transformation
  if (!(type in TRANSFORM_MAP)) return;
  if (player.isPoule || player.hasTransformed) return; // ne pas écraser une transformation existante
  const count = stats && type in stats ? stats[type] : 0;
  // Transformer lorsque le compteur atteint exactement 10
  if (count === 10) {
    const newKey = TRANSFORM_MAP[type];
    if (ASSETS[newKey]) {
      player.imgKey = newKey;
      player.hasTransformed = true;
      if (newKey === 'rournpizza') {
        // initialiser la position périmètre pour le mouvement pizza
        player.perimT = projectPerimeterT(player);
      }
    }
  }
}

// Table des items: type → sprite, points, vitesse de base
// Astuce (visible): ajuster baseSpeed / points ici.
const ITEM_TYPES = [
  { key: "pizza",    points:  3, baseSpeed: 140, baseW: 56 },
  { key: "burger",   points:  3, baseSpeed: 140, baseW: 56 },
  { key: "tacos",    points:  2, baseSpeed: 130, baseW: 56 },
  { key: "brocolis", points:  1, baseSpeed: 110, baseW: 50 },
  { key: "poulet",   points:  0, baseSpeed: 200, baseW: 60 }, // bonus un peu plus grand
  { key: "angepoulet", points: 5, baseSpeed: 120, baseW: 90 }, // poulet céleste, plus grand, chute douce
  { key: "etoile",  points:  1, baseSpeed: 160, baseW: 48 }, // bonus vitesse temporaire
  { key: "braise",  points:  0, baseSpeed: 200, baseW: 52 }, // braise (enfer), chute verticale
  { key: "sucette", points:  0, baseSpeed: 140, baseW: 44 }, // déclenche un plateau
  { key: "bombe",    points: -5, baseSpeed: 220, baseW: 64 }, // piège (légèrement plus grande)
  { key: "couteau",  points:  0, baseSpeed: 260, baseW: 54 }, // dangereux, mouvement diagonal
];

function getItemPoints(key) {
  const d = ITEM_TYPES.find(t => t.key === key);
  return d ? d.points : 0;
}

class Item {
  constructor(typeKey, x) {
    const def = ITEM_TYPES.find(t => t.key === typeKey);
    this.type = def.key;
    this.points = def.points;
    this.baseSpeed = def.baseSpeed;
    this.baseW = def.baseW || ITEM_BASE_W;
    this.x = x;
    this.y = -this.h; // démarre juste au-dessus
    this.variation = 0.9 + Math.random() * 0.2; // petite variation de vitesse
    // Vitesse personnalisée (utilisée pour le monde espace ou certains items)
    this.vx = 0;
    this.vy = 0;
    this.customVel = false;
    // Spécificités par type
    this.angle = 0;
    this.angVel = 0;
    if (this.type === 'couteau') {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.vx = dir * (this.baseSpeed * 0.6);
      this.angVel = dir * (3 + Math.random() * 2); // rad/s
    }
  }
  get img() { return ASSETS[this.type]; }
  get w() { return this.baseW; }
  get h() {
    const i = this.img;
    if (i && i.width && i.height) return Math.max(1, Math.round(this.baseW * (i.height / i.width)));
    return this.baseW;
  }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dt, speedMult) {
    if (this.customVel) {
      this.x += this.vx * speedMult * dt;
      this.y += this.vy * speedMult * dt;
    } else {
      const vy = this.baseSpeed * this.variation * speedMult;
      this.y += vy * dt;
      this.x += this.vx * dt;
    }
    // Gestion couteau planté au sol (monde couteau)
    if (!this.stuck && this.type === 'couteau' && worldId === 'couteau') {
      if (this.stickCandidate && (this.y + this.h >= VH - 2)) {
        // Planter dans le sol
        this.stuck = true;
        this.blocking = true;
        this.stuckTime = 5.0;
        this.vx = 0; this.vy = 0; this.customVel = false;
        this.angVel = 0;
        this.angle = Math.PI; // lame vers le bas
        this.y = VH - this.h;
      }
    }
    if (this.stuck) {
      this.stuckTime -= dt;
      if (this.stuckTime <= 0) this.dead = true;
    }
    if (this.angVel) this.angle += this.angVel * dt;
  }
  draw(g) {
    const img = this.img;
    if (!img) return;
    if (this.angVel || Math.abs(this.angle||0) > 1e-3) {
      // Dessin avec rotation (couteau)
      g.save();
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      g.translate(cx, cy);
      g.rotate(this.angle);
      g.drawImage(img, -this.w / 2, -this.h / 2, this.w, this.h);
      g.restore();
    } else {
      g.drawImage(img, this.x, this.y, this.w, this.h);
    }
  }
}

// Sélection pondérée des types qui tombent
// Poulet ~5%, Bombe ~15% (augmenté), le reste se partagent 80% à parts égales (~20% chacun)
const SPAWN_DISTRIBUTION = [
  { key: 'poulet',   weight: 0.05 },
  { key: 'bombe',    weight: 0.15 },
  { key: 'pizza',    weight: 0.20 },
  { key: 'burger',   weight: 0.20 },
  { key: 'tacos',    weight: 0.20 },
  { key: 'brocolis', weight: 0.20 },
];

function itemDefByKey(key) {
  return ITEM_TYPES.find(t => t.key === key);
}

function selectSpawnKey() {
  let r = Math.random();
  let acc = 0;
  for (const e of SPAWN_DISTRIBUTION) {
    acc += e.weight;
    if (r < acc) return e.key;
  }
  return SPAWN_DISTRIBUTION[SPAWN_DISTRIBUTION.length - 1].key;
}

// Projectiles envoyés par le tacos
class Projectile {
  constructor(ownerId, kind, x, y, w, h, vx = 0, vy = -TACO_SHOT_SPEED) {
    this.ownerId = ownerId;     // 1 ou 2
    this.kind = kind;           // 'salad' | 'tomato'
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.vx = vx; this.vy = vy;
  }
  get img() {
    if (this.kind === 'salad') return ASSETS['tacossalad'];
    if (this.kind === 'tomato') return ASSETS['tacostomato'];
    if (this.kind === 'cheese') return ASSETS['cheese'];
    if (this.kind === 'pepperoni') return ASSETS['pepperoni'];
    return null;
  }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; }
  draw(g) {
    const img = this.img;
    if (img) g.drawImage(img, this.x, this.y, this.w, this.h);
    else {
      g.fillStyle = this.kind === 'salad' ? '#27ae60' : '#c0392b';
      g.fillRect(this.x, this.y, this.w, this.h);
    }
  }
}

// -----------------------------
// Utilitaires
// -----------------------------
function intersects(a, b, pad = COLLISION_PAD) {
  return (
    a.x + pad < b.x + b.w - pad &&
    a.x + a.w - pad > b.x + pad &&
    a.y + pad < b.y + b.h - pad &&
    a.y + a.h - pad > b.y + pad
  );
}

function resolveBlockingCollisions(pl) {
  for (const it of items) {
    if (!it || !it.blocking) continue;
    let pr = pl.rect();
    const r = { x: it.x, y: it.y, w: it.w, h: it.h };
    if (intersects(pr, r, 0)) {
      const dxLeft = (pr.x + pr.w) - r.x;
      const dxRight = (r.x + r.w) - pr.x;
      const dyTop = (pr.y + pr.h) - r.y;
      const dyBottom = (r.y + r.h) - pr.y;
      const minX = Math.min(dxLeft, dxRight);
      const minY = Math.min(dyTop, dyBottom);
      if (minX < minY) {
        if (dxLeft < dxRight) pl.x -= dxLeft; else pl.x += dxRight;
      } else {
        if (dyTop < dyBottom) pl.y -= dyTop; else pl.y += dyBottom;
        if (pr.y < r.y && Math.abs((pr.y + pr.h) - r.y) <= minY + 0.5) { pl.vy = 0; pl.onGround = true; }
      }
    }
  }
}

function inflateRect(r, amount) {
  return { x: r.x - amount / 2, y: r.y - amount / 2, w: r.w + amount, h: r.h + amount };
}

function getPlayerTransform(pl) {
  // Retourne 'brocolis' | 'tacos' | 'pizza' | 'burger' | null
  switch (pl.imgKey) {
    case 'rournbrocolis': return 'brocolis';
    case 'rourntacos': return 'tacos';
    case 'rournpizza': return 'pizza';
    case 'rournburger': return 'burger';
    default: return null;
  }
}

function hasForm(pl, key) {
  if (pl && pl.forms && pl.forms.has(key)) return true;
  return getPlayerTransform(pl) === key;
}

function addForm(pl, key) {
  if (!pl || !key) return;
  if (!pl.forms) pl.forms = new Set();
  pl.forms.add(key);
  pl.lastForm = key;
  const mapped = TRANSFORM_MAP[key];
  if (mapped && ASSETS[mapped]) pl.imgKey = mapped;
}

function setSingleForm(pl, key) {
  if (!pl || !key) return;
  pl.forms = new Set([key]);
  pl.lastForm = key;
  const mapped = TRANSFORM_MAP[key];
  if (mapped && ASSETS[mapped]) pl.imgKey = mapped;
}

function perimeterLength(pl) {
  const w = Math.max(1, VW - pl.w);
  const h = Math.max(1, VH - pl.h);
  return 2 * (w + h);
}

function projectPerimeterT(pl) {
  const wspan = Math.max(0, VW - pl.w);
  const hspan = Math.max(0, VH - pl.h);
  // déterminer bord le plus proche
  const dTop = pl.y;
  const dBottom = Math.abs(hspan - pl.y);
  const dLeft = pl.x;
  const dRight = Math.abs(wspan - pl.x);
  const minD = Math.min(dTop, dBottom, dLeft, dRight);
  if (minD === dTop) {
    // top: t = bottomSpan + hspan + (wspan - x)
    return wspan + hspan + (wspan - Math.min(wspan, Math.max(0, pl.x)));
  } else if (minD === dBottom) {
    // bottom: t = x
    return Math.min(wspan, Math.max(0, pl.x));
  } else if (minD === dLeft) {
    // left: t = wspan + hspan + wspan + y
    return wspan + hspan + wspan + Math.min(hspan, Math.max(0, pl.y));
  } else {
    // right: t = wspan + (hspan - y)
    return wspan + (hspan - Math.min(hspan, Math.max(0, pl.y)));
  }
}

function setPosFromPerimeterT(pl, t) {
  const wspan = Math.max(0, VW - pl.w);
  const hspan = Math.max(0, VH - pl.h);
  const L = 2 * (wspan + hspan);
  t = ((t % L) + L) % L;
  if (t <= wspan) {
    // bottom: x=t, y=hspan
    pl.x = t; pl.y = hspan;
  } else if (t <= wspan + hspan) {
    // right: x=wspan, y=hspan - (t - wspan)
    const tt = t - wspan; pl.x = wspan; pl.y = hspan - tt;
  } else if (t <= wspan + hspan + wspan) {
    // top: x=wspan - (t - (wspan + hspan)), y=0
    const tt = t - (wspan + hspan); pl.x = wspan - tt; pl.y = 0;
  } else {
    // left: x=0, y= t - (wspan + hspan + wspan)
    const tt = t - (wspan + hspan + wspan); pl.x = 0; pl.y = tt;
  }
}
function holdOnEdge(pl) {
  const edge = pl.perimeterEdge;
  if (!edge) return;
  if (edge === 'bottom') {
    pl.y = VH - pl.h;
    if (pl.x < 0) pl.x = 0;
    if (pl.x + pl.w > VW) pl.x = VW - pl.w;
  } else if (edge === 'top') {
    pl.y = 0;
    if (pl.x < 0) pl.x = 0;
    if (pl.x + pl.w > VW) pl.x = VW - pl.w;
  } else if (edge === 'left') {
    pl.x = 0;
    if (pl.y < 0) pl.y = 0;
    if (pl.y + pl.h > VH) pl.y = VH - pl.h;
  } else if (edge === 'right') {
    pl.x = VW - pl.w;
    if (pl.y < 0) pl.y = 0;
    if (pl.y + pl.h > VH) pl.y = VH - pl.h;
  }
}

function transitionEdge(pl, s) {
  // s > 0 sens horaire, s < 0 anti-horaire
  const edge = pl.perimeterEdge;
  if (!edge || s === 0) return;
  const tol = EDGE_TOL;
  if (edge === 'bottom') {
    if (s > 0 && pl.x >= VW - pl.w - tol) pl.perimeterEdge = 'right';
    else if (s < 0 && pl.x <= tol) pl.perimeterEdge = 'left';
  } else if (edge === 'right') {
    if (s > 0 && pl.y <= tol) pl.perimeterEdge = 'top';
    else if (s < 0 && pl.y >= VH - pl.h - tol) pl.perimeterEdge = 'bottom';
  } else if (edge === 'top') {
    if (s > 0 && pl.x <= tol) pl.perimeterEdge = 'left';
    else if (s < 0 && pl.x >= VW - pl.w - tol) pl.perimeterEdge = 'right';
  } else if (edge === 'left') {
    if (s > 0 && pl.y >= VH - pl.h - tol) pl.perimeterEdge = 'bottom';
    else if (s < 0 && pl.y <= tol) pl.perimeterEdge = 'top';
  }
}

function snapToNearestEdge(pl) {
  const dTop = pl.y;
  const dBottom = Math.abs((VH - pl.h) - pl.y);
  const dLeft = pl.x;
  const dRight = Math.abs((VW - pl.w) - pl.x);
  const minD = Math.min(dTop, dBottom, dLeft, dRight);
  if (minD === dTop) { pl.y = 0; return 'top'; }
  if (minD === dBottom) { pl.y = VH - pl.h; return 'bottom'; }
  if (minD === dLeft) { pl.x = 0; return 'left'; }
  pl.x = VW - pl.w; return 'right';
}

function edgeTangent(edge) {
  switch (edge) {
    case 'bottom': return [1, 0];
    case 'top': return [-1, 0];
    case 'left': return [0, 1];
    case 'right': return [0, -1];
    default: return [1, 0];
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// -----------------------------
// État du jeu
// -----------------------------
const STATE = { MENU: "menu", PLAYING: "playing", PAUSED: "paused", OVER: "over" };
let gameState = STATE.MENU;

let p1, p2; // joueurs
let items = [];
let shots = [];
let plateaus = [];
let score1 = 0, score2 = 0;
let timeLeft = GAME_DURATION; // s
let spawnRate = SPAWN_BASE_RATE; // items/sec
let speedMult = 1.0;            // multiplicateur vitesse chute
let spawnAcc = 0;               // accumulateur de spawn
let elapsed = 0;                // temps écoulé depuis start
let lastDiffStep = 0;           // paliers appliqués
let feed1 = []; // derniers items pris par J1 (types)
let feed2 = []; // derniers items pris par J2 (types)
let stats1 = null; // compteur par type pour J1
let stats2 = null; // compteur par type pour J2
const ALL_ITEM_KEYS = ITEM_TYPES.map(t => t.key);
let sucetteTimer = 0;

// Mode développeur (off par défaut)
let developerMode = false;
let devToggleRect = { x: 0, y: 0, w: 0, h: 0 };

function makeEmptyStats() {
  const o = Object.create(null);
  for (const k of ALL_ITEM_KEYS) o[k] = 0;
  return o;
}

// -----------------------------
// Gestion du jeu
// -----------------------------
function resetGame() {
  p1 = new Player("rourn1", Math.round(VW * 0.25), 0);
  p2 = new Player("rourn2", Math.round(VW * 0.75), 0);
  p1.wingsKey = 'rourn1ailes';
  p2.wingsKey = 'rourn2ailes';
  // Placer fermement sur la ligne de base au bas de l'écran
  p1.baseScale = 1; p2.baseScale = 1;
  p1.scale = 1; p2.scale = 1;
  p1.freeTime = 0; p2.freeTime = 0;
  p1.shrinkTime = 0; p2.shrinkTime = 0;
  p1.isPoule = false; p2.isPoule = false;
  p1.hasTransformed = false; p2.hasTransformed = false;
  p1.chickenStreak = 0; p2.chickenStreak = 0;
  p1.imgKey = p1.defaultImgKey; p2.imgKey = p2.defaultImgKey;
  p1.angle = 0; p2.angle = 0;
  p1.hopPhase = 0; p2.hopPhase = 0;
  p1.baselineY = Math.round(VH - p1.h - BASELINE_MARGIN);
  p2.baselineY = Math.round(VH - p2.h - BASELINE_MARGIN);
  p1.y = p1.baselineY;
  p2.y = p2.baselineY;
  p1.x = Math.max(0, Math.min(VW - p1.w, p1.x));
  p2.x = Math.max(0, Math.min(VW - p2.w, p2.x));
  items = [];
  shots = [];
  plateaus = [];
  score1 = 0;
  score2 = 0;
  timeLeft = GAME_DURATION;
  spawnRate = SPAWN_BASE_RATE;
  speedMult = 1.0;
  spawnAcc = 0;
  elapsed = 0;
  lastDiffStep = 0;
  feed1 = [];
  feed2 = [];
  stats1 = makeEmptyStats();
  stats2 = makeEmptyStats();
  sucetteTimer = 12 + Math.random() * 16;
}

function startGame() {
  resetGame();
  // Si un monde est fixé, appliquer le fond et les règles correspondantes
  if (fixedWorldMode !== 'multi') {
    const idx = Math.max(0, bgImages.findIndex(e => e.id === fixedWorldMode));
    if (idx >= 0) { bgIndex = idx; setWorldFromId(bgImages[bgIndex]?.id); }
    else { setWorldFromId(fixedWorldMode); }
  }
  gameState = STATE.PLAYING;
}

function toMenu() {
  gameState = STATE.MENU;
}

function gameOver() {
  gameState = STATE.OVER;
}

// ---------------------------------
// Boucle jeu: update + render (RAF)
// ---------------------------------
let lastTs = performance.now();

function update(dt) {
  if (gameState !== STATE.PLAYING) return;

  // Temps et difficulté
  elapsed += dt;
  timeLeft -= dt;
  if (timeLeft <= 0) {
    timeLeft = 0;
    gameOver();
  }

  const step = Math.floor(elapsed / DIFFICULTY_INTERVAL);
  if (step > lastDiffStep) {
    // Difficulty ramp (toutes les 20s)
    lastDiffStep = step;
    spawnRate = clamp(spawnRate + SPAWN_RATE_INCREMENT, 0, MAX_SPAWN_RATE);
    speedMult = clamp(speedMult * (1 + SPEED_MULT_INC), 0, MAX_SPEED_MULT);
  }

  // Input joueurs
  // J1: ZQSD
  let dx1 = 0, dy1 = 0;
  if (keys["z"] || keys["Z"]) dy1 -= 1;
  if (keys["s"] || keys["S"]) dy1 += 1;
  if (keys["q"] || keys["Q"]) dx1 -= 1;
  if (keys["d"] || keys["D"]) dx1 += 1;
  // J2: flèches
  let dx2 = 0, dy2 = 0;
  if (keys["ArrowUp"]) dy2 -= 1;
  if (keys["ArrowDown"]) dy2 += 1;
  if (keys["ArrowLeft"]) dx2 -= 1;
  if (keys["ArrowRight"]) dx2 += 1;

  // Normaliser diagonales (vitesse constante)
  function normalize(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    return [dx / len, dy / len];
  }
  // Saut (one-shot)
  const j1 = !!(pressedOnce[' '] || pressedOnce['Spacebar'] || pressedOnce['Space']);
  const j2 = !!(pressedOnce['*'] || pressedOnce['NumpadMultiply']);
  pressedOnce['*'] = pressedOnce['NumpadMultiply'] = false;
  pressedOnce[' '] = pressedOnce['Spacebar'] = pressedOnce['Space'] = false;
  pressedOnce['Shift'] = pressedOnce['ShiftRight'] = false;
  // Décrémenter les timers
  p1.freeTime = Math.max(0, p1.freeTime - dt);
  p2.freeTime = Math.max(0, p2.freeTime - dt);
  p1.shrinkTime = Math.max(0, p1.shrinkTime - dt);
  p2.shrinkTime = Math.max(0, p2.shrinkTime - dt);
  p1.paralyzeTime = Math.max(0, (p1.paralyzeTime || 0) - dt);
  p2.paralyzeTime = Math.max(0, (p2.paralyzeTime || 0) - dt);
  p1.speedBoostTime = Math.max(0, (p1.speedBoostTime || 0) - dt);
  p1.starTime = Math.max(0, (p1.starTime || 0) - dt);
  p2.speedBoostTime = Math.max(0, (p2.speedBoostTime || 0) - dt);
  p2.starTime = Math.max(0, (p2.starTime || 0) - dt);
  p1.giantTime = Math.max(0, (p1.giantTime || 0) - dt);
  p2.giantTime = Math.max(0, (p2.giantTime || 0) - dt);

  // En mode normal (pas poulet): par défaut horizontal uniquement.
  // Spécial pizza: gauche/droite contrôlent le déplacement le long du bord (périmètre).
  const p1IsPizza = getPlayerTransform(p1) === 'pizza';
  const p2IsPizza = getPlayerTransform(p2) === 'pizza';
  const p1PizzaFree = (worldId === 'espace') && p1IsPizza;
  const p2PizzaFree = (worldId === 'espace') && p2IsPizza;

  let s1 = 0, s2 = 0;
  if (p1.freeTime <= 0 && !(p1IsPizza && p1PizzaFree)) {
    if (p1IsPizza && !p1PizzaFree) {
      s1 = Math.sign(dx1);
      dx1 = 0; dy1 = 0; // on gèrera le déplacement périmètre après update
    } else {
      if (!worldAllowAllDirs) dy1 = 0;
    }
  }
  if (p2.freeTime <= 0 && !(p2IsPizza && p2PizzaFree)) {
    if (p2IsPizza && !p2PizzaFree) {
      s2 = Math.sign(dx2);
      dx2 = 0; dy2 = 0;
    } else {
      if (!worldAllowAllDirs) dy2 = 0;
    }
  }

  // Paralysie: empêche les déplacements actifs (y compris pizza périmètre)
  if ((p1.paralyzeTime||0) > 0) { dx1 = 0; dy1 = 0; s1 = 0; }
  if ((p2.paralyzeTime||0) > 0) { dx2 = 0; dy2 = 0; s2 = 0; }

  [dx1, dy1] = normalize(dx1, dy1);
  [dx2, dy2] = normalize(dx2, dy2);

  // Décrémenter les cooldowns de tir
  p1.tacoTimer = Math.max(0, (p1.tacoTimer || 0) - dt);
  p2.tacoTimer = Math.max(0, (p2.tacoTimer || 0) - dt);
  p1.pizzaTimer = Math.max(0, (p1.pizzaTimer || 0) - dt);
  p2.pizzaTimer = Math.max(0, (p2.pizzaTimer || 0) - dt);

  p1.update(dx1, dy1, dt);
  p2.update(dx2, dy2, dt);

  // Physique de saut / gravité (sauf pizza libre en espace et pendant poulet)
  const JUMP_FORCE = 900;
  const GRAVITY = 1800;
  const gravMult = (worldId === 'espace') ? 0.5 : 1.0;
  function applyJumpPhysics(pl, jumpPressed) {
    if (pl.vy == null) pl.vy = 0;
    if (pl.onGround == null) pl.onGround = true;
    const isPizzaFree = (worldId === 'espace') && (getPlayerTransform(pl) === 'pizza');
    if (pl.freeTime > 0 || isPizzaFree || (pl.starTime||0) > 0) {
      // Pas de gravité durant poulet ou pizza libre en espace
      pl.vy = 0; return;
    }
    if (jumpPressed && (pl.onGround || pl.vy === 0)) {
      pl.vy = -JUMP_FORCE;
      pl.onGround = false;
    }
    pl.vy += GRAVITY * gravMult * dt;
    pl.y += pl.vy * dt;
    // Sol (baseline)
    pl.baselineY = Math.round(VH - pl.h - BASELINE_MARGIN);
    if (pl.y > pl.baselineY) { pl.y = pl.baselineY; pl.vy = 0; pl.onGround = true; }
    if (pl.y < 0) { pl.y = 0; }
  }
  applyJumpPhysics(p1, j1);
  applyJumpPhysics(p2, j2);\n  // Impulsion directionnelle pendant étoile en espace (sur saut)\n  if (worldId === 'espace') {\n    function starImpulse(pl, jumpPressed, dx, dy){\n      if (!jumpPressed) return;\n      if ((pl.starTime||0) <= 0) return;\n      let ix = dx, iy = dy;\n      if (ix === 0 && iy === 0) { ix = 0; iy = -1; }\n      const mag = Math.hypot(ix, iy) || 1; ix/=mag; iy/=mag;\n      const dist = 140;\n      pl.x = Math.max(0, Math.min(VW - pl.w, pl.x + Math.round(ix * dist)));\n      pl.y = Math.max(0, Math.min(VH - pl.h, pl.y + Math.round(iy * dist)));\n    }\n    starImpulse(p1, j1, dx1, dy1);\n    starImpulse(p2, j2, dx2, dy2);\n  }\n

  // Animation de déplacement vers le centre pendant l'effet poulet (sans téléportation)
  function applyChickenMove(pl) {
    if (pl.freeTime > 0 && pl.moveToCenterDur > 0 && pl.moveToCenterElapsed < pl.moveToCenterDur) {
      pl.moveToCenterElapsed += dt;
      let t = pl.moveToCenterElapsed / pl.moveToCenterDur;
      // easing doux (easeOutCubic)
      t = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
      pl.x = Math.round(pl.moveStartX + (pl.moveTargetX - pl.moveStartX) * t);
      pl.y = Math.round(pl.moveStartY + (pl.moveTargetY - pl.moveStartY) * t);
    }
  }
  applyChickenMove(p1);
  applyChickenMove(p2);

  // Tirs manuels selon formes actives
    function tryShootFor(player, id, fire) {
    if ((hasForm(player,'tacos') || hasForm(player,'burger')) && fire) {
      if ((player.tacoTimer || 0) <= 0 && shots.length < MAX_SHOTS) {
        player.tacoTimer = TACO_SHOT_INTERVAL;
        const cycle = ['tomato','salad','cheese'];
        const kind = cycle[player.tacoCycleIndex % cycle.length];
        player.tacoCycleIndex = (player.tacoCycleIndex + 1) % cycle.length;
        const projImg = kind === 'tomato' ? ASSETS['tacostomato'] : (kind === 'salad' ? ASSETS['tacossalad'] : ASSETS['cheese']);
        const pw = Math.max(4, Math.round(player.w / 3));
        let ph = pw;
        if (projImg && projImg.width && projImg.height) ph = Math.max(4, Math.round(pw * (projImg.height / projImg.width)));
        const sx = Math.round(player.x + player.w / 2 - pw / 2);
        const sy = Math.round(player.y - ph + 4);
        const vx = 0, vy = -TACO_SHOT_SPEED;
        shots.push(new Projectile(id, kind, sx, sy, pw, ph, vx, vy));
        if (soundMode === SOUND_MODE.SFX) playSound('fartprout', { volume: 0.6 });
      }
    }
    if (hasForm(player,'pizza') && fire) {
      if ((player.pizzaTimer || 0) <= 0 && shots.length < MAX_SHOTS) {
        player.pizzaTimer = PIZZA_SHOT_INTERVAL;
        const imgPep = ASSETS['pepperoni'];
        const pw = Math.max(4, Math.round(player.w / 3));
        let ph = pw;
        if (imgPep && imgPep.width && imgPep.height) ph = Math.max(4, Math.round(pw * (imgPep.height / imgPep.width)));
        const sx = Math.round(player.x + player.w / 2 - pw / 2);
        const sy = Math.round(player.y + player.h / 2 - ph / 2);
        const dirs = [ [0,-1], [0,1], [-1,0], [1,0] ];
        const d = dirs[Math.floor(Math.random()*dirs.length)];
        const vx = d[0] * PIZZA_SHOT_SPEED;
        const vy = d[1] * PIZZA_SHOT_SPEED;
        shots.push(new Projectile(id, 'pepperoni', sx, sy, pw, ph, vx, vy));
        if (soundMode === SOUND_MODE.SFX) playSound('fartprout', { volume: 0.6 });
      }
    }
  }

  const fire1 = !!(keys['a'] || keys['A']);
  const fire2 = !!(keys['Enter']);
  tryShootFor(p1, 1, fire1);
  tryShootFor(p2, 2, fire2);

  // Échelle visuelle en fonction des effets (baseScale appliquée d'abord)
  // Si le joueur est en poule, le poulet ne doit PAS changer la taille (pas de CHICKEN_SCALE)
  const tf1 = getPlayerTransform(p1);
  const tf2 = getPlayerTransform(p2);
  const burgerFactor1 = (tf1 === 'burger') ? BURGER_SCALE : 1;
  const burgerFactor2 = (tf2 === 'burger') ? BURGER_SCALE : 1;
  p1.scale = p1.baseScale * worldPlayerScaleMult * (p1.giantTime > 0 ? 4 : 1) * burgerFactor1 * ((p1.freeTime > 0 && !p1.isPoule) ? CHICKEN_SCALE : 1) * (p1.shrinkTime > 0 ? BOMB_SHRINK_SCALE : 1);
  p2.scale = p2.baseScale * worldPlayerScaleMult * (p2.giantTime > 0 ? 4 : 1) * burgerFactor2 * ((p2.freeTime > 0 && !p2.isPoule) ? CHICKEN_SCALE : 1) * (p2.shrinkTime > 0 ? BOMB_SHRINK_SCALE : 1);

  // Calcul dynamique de la baseline (selon la hauteur actuelle)
  p1.baselineY = Math.round(VH - p1.h - BASELINE_MARGIN);
  p2.baselineY = Math.round(VH - p2.h - BASELINE_MARGIN);

  // Forcer/faire tomber à la ligne de base si pas de mouvement libre
  if (p1.freeTime <= 0 && !((p1.starTime||0) > 0)) {
    if (!p1IsPizza) {
      if (!worldAllowAllDirs) {
        if (p1.y < p1.baselineY) p1.y = Math.min(p1.baselineY, p1.y + FALL_SPEED * dt);
        else p1.y = p1.baselineY;
      }
    } else {
      // Déplacement périmètre piloté par s1
      if (p1.perimT == null) p1.perimT = projectPerimeterT(p1);
      const dist = s1 * p1.speed * dt;
      const L = perimeterLength(p1);
      p1.perimT = ((p1.perimT + dist) % L + L) % L;
      setPosFromPerimeterT(p1, p1.perimT);
      // Rotation en fonction de la distance parcourue
      p1.angle += dist * 0.12;
    }
  }
  if (p2.freeTime <= 0 && !((p2.starTime||0) > 0)) {
    if (!p2IsPizza) {
      if (!worldAllowAllDirs) {
        if (p2.y < p2.baselineY) p2.y = Math.min(p2.baselineY, p2.y + FALL_SPEED * dt);
        else p2.y = p2.baselineY;
      }
    } else {
      if (p2.perimT == null) p2.perimT = projectPerimeterT(p2);
      const dist = s2 * p2.speed * dt;
      const L = perimeterLength(p2);
      p2.perimT = ((p2.perimT + dist) % L + L) % L;
      setPosFromPerimeterT(p2, p2.perimT);
      p2.angle += dist * 0.12;
    }
  }

  // Tacos: sautille (appliquer un offset vertical au repos de baseline)
  // tf1/tf2 déjà calculés ci-dessus
  if (p1.freeTime <= 0 && !worldAllowAllDirs && (p1.starTime||0) <= 0 && hasForm(p1, 'tacos')) {
    const hop = Math.max(0, Math.sin(p1.hopPhase)) * HOP_AMP;
    p1.y = p1.baselineY - Math.round(hop);
  }
  if (p2.freeTime <= 0 && !worldAllowAllDirs && (p2.starTime||0) <= 0 && hasForm(p2, 'tacos')) {
    const hop = Math.max(0, Math.sin(p2.hopPhase)) * HOP_AMP;
    p2.y = p2.baselineY - Math.round(hop);
  }

  // Collision contre objets bloquants (ex: couteau planté)
  resolveBlockingCollisions(p1);
  resolveBlockingCollisions(p2);

  // Spawns
  if (items.length < MAX_ITEMS) {
    spawnAcc += dt * spawnRate;
    while (spawnAcc >= 1 && items.length < MAX_ITEMS) {
      spawnAcc -= 1;
      spawnItem();
    }
  }

  // Spawns additionnels spécifiques au monde (ex: couteaux)
  if (worldKnifeSpawnRate > 0) {
    if (typeof update.knifeAcc !== 'number') update.knifeAcc = 0;
    update.knifeAcc += dt * worldKnifeSpawnRate;
    let guard = 0;
    while (update.knifeAcc >= 1 && items.length < MAX_ITEMS) {
      update.knifeAcc -= 1;
      spawnKnife();
      if (++guard > 10) { update.knifeAcc = 0; break; }
    }
  }
  // Spawns additionnels: braises (enfer)
  if (worldBraiseSpawnRate > 0) {
    if (typeof update.braiseAcc !== 'number') update.braiseAcc = 0;
    update.braiseAcc += dt * worldBraiseSpawnRate;
    let guard2 = 0;
    while (update.braiseAcc >= 1 && items.length < MAX_ITEMS) {
      update.braiseAcc -= 1;
      spawnBraise();
      if (++guard2 > 10) { update.braiseAcc = 0; break; }
    }
  }

  // Sucette: spawn périodique (~20s)
  sucetteTimer -= dt;
  if (sucetteTimer <= 0 && items.length < MAX_ITEMS) {
    spawnSucette();
    sucetteTimer = 18 + Math.random() * 8; // 18-26s
  }

  // Plateaux: diminuer TTL et nettoyer
  if (plateaus && plateaus.length) {
    for (let pi = plateaus.length - 1; pi >= 0; pi--) {
      const p = plateaus[pi];
      p.ttl -= dt;
      if (p.ttl <= 0) plateaus.splice(pi, 1);
    }
  }

  // Items update + collisions + nettoyage
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.update(dt, speedMult * worldFallMult);\n    // Aimantation vers grande sucette\n    function attractTo(pl, obj){\n      const cx = obj.x + obj.w/2, cy = obj.y + obj.h/2;\n      const tx = pl.x + pl.w/2, ty = pl.y + pl.h/2;\n      const dx = tx - cx, dy = ty - cy;\n      const dist = Math.hypot(dx, dy) || 1;\n      const strength = 600; // px/s vers le joueur\n      const ax = (dx / dist) * strength * dt;\n      const ay = (dy / dist) * strength * dt;\n      obj.x += ax; obj.y += ay;\n    }\n    if (p1 && p1.isBigLollipop) attractTo(p1, it);\n    if (p2 && p2.isBigLollipop) attractTo(p2, it);\n

    const r = it.rect();
    // Plateau: collecte automatique
    if (plateaus && plateaus.length) {
      let collected = false;
      for (const p of plateaus) {
        if (p.ttl <= 0) continue;
        const pr = { x: p.x, y: p.y, w: p.w, h: p.h };
        if (it.type !== 'couteau' && !it.blocking && intersects(r, pr)) {
          processPickup(p.ownerId, it);
          items.splice(i, 1);
          collected = true;
          break;
        }
      }
      if (collected) continue;
    }
    // Collisions avec joueurs (couteau est nocif)
    if (intersects(p1.rect(), r)) {
      if (it.type === 'couteau') {
        if (it.stuck) { /* collision bloquante gérée ailleurs */ }
        else { p1.paralyzeTime = Math.max(p1.paralyzeTime || 0, 3.0); items.splice(i, 1); }
        continue;
      }
      processPickup(1, it); items.splice(i, 1); continue;
    }
    if (intersects(p2.rect(), r)) {
      if (it.type === 'couteau') {
        if (it.stuck) { /* collision bloquante gérée ailleurs */ }
        else { p2.paralyzeTime = Math.max(p2.paralyzeTime || 0, 3.0); items.splice(i, 1); }
        continue;
      }
      processPickup(2, it); items.splice(i, 1); continue;
    }
    // Sorti de l'écran ? (toutes directions)
    if (it.dead) { items.splice(i, 1); continue; }
    const oob = (it.y > VH + 10) || (it.y + it.h < -10) || (it.x + it.w < -10) || (it.x > VW + 10);
    if (oob && !it.stuck) items.splice(i, 1);
  }

  // Projectiles update + collisions avec items
  for (let si = shots.length - 1; si >= 0; si--) {
    const s = shots[si];
    s.update(dt);
    // hors écran ? (toutes directions)
    if (s.y + s.h < -10 || s.y > VH + 10 || s.x + s.w < -10 || s.x > VW + 10) {
      shots.splice(si, 1);
      continue;
    }
    // collisions avec items
    let hit = false;
    for (let ii = items.length - 1; ii >= 0; ii--) {
      const it = items[ii];
      if (intersects(s.rect(), it.rect())) {
        processPickup(s.ownerId, it);
        items.splice(ii, 1);
        hit = true;
        break;
      }
    }
    if (hit) shots.splice(si, 1);
  }
}

function playItemSound(type, playerId = 0) {
  if (soundMode !== SOUND_MODE.SFX) return; // en mode musique ou muet, pas de SFX
  // pbtb.wav pour pizza/brocolis/burger/tacos
  if (type === "pizza" || type === "brocolis" || type === "burger" || type === "tacos") {
    const key = (playerId === 2) ? "pbtb2" : "pbtb";
    playSound(key, { loop: false, durationSec: null, volume: 0.7 });
    return;
  }
  if (type === "bombe") {
    // Bombe exclusive avec poulet pour éviter la superposition désagréable
    playExclusiveSfx("bombe", { loop: false, durationSec: null, volume: 0.7 });
    return;
  }
  // Pour le poulet, le son de 5 s est géré dans la collision (par joueur)
}

function spawnItem() {
  let key = selectSpawnKey();
  if (worldId === 'ciel' && key === 'poulet') key = 'angepoulet';
  if (worldId === 'enfer' && Math.random() < 0.20) key = 'braise';
  if (worldId === 'espace') {
    // En espace, injecter parfois une étoile à la place de l'item choisi
    if (Math.random() < 0.15) key = 'etoile';
    spawnItemSpace(key);
    return;
  }
  const def = itemDefByKey(key);
  const baseW = def?.baseW || ITEM_BASE_W;
  const x = Math.random() * (VW - baseW);
  items.push(new Item(key, x));
}

function spawnKnife() {
  const def = itemDefByKey('couteau');
  const baseW = def?.baseW || ITEM_BASE_W;
  const x = Math.random() * (VW - baseW);
  const it = new Item('couteau', x);
  if (worldId === 'couteau') {
    it.stickCandidate = (Math.random() < 0.10);
  }
  items.push(it);
}

function spawnSucette() {
  const def = itemDefByKey('sucette');
  const baseW = def?.baseW || ITEM_BASE_W;
  const x = Math.random() * (VW - baseW);
  items.push(new Item('sucette', x));
}

function spawnItemSpace(key) {
  // Crée un item qui entre depuis un bord aléatoire avec une trajectoire aléatoire vers l'intérieur
  const def = itemDefByKey(key);
  const baseW = def?.baseW || ITEM_BASE_W;
  // Position de départ provisoire (ajustée ensuite selon le bord)
  let it = new Item(key, Math.random() * (VW - baseW));
  const side = Math.floor(Math.random() * 4); // 0 top, 1 bottom, 2 left, 3 right
  const deg2rad = (d) => d * Math.PI / 180;
  let ang = 0;
  if (side === 0) {
    // Depuis le haut vers le bas
    it.x = Math.random() * (VW - it.w);
    it.y = -it.h;
    ang = deg2rad(20 + Math.random() * 140); // 20°..160° (sin>0)
  } else if (side === 1) {
    // Depuis le bas vers le haut
    it.x = Math.random() * (VW - it.w);
    it.y = VH + 2;
    ang = deg2rad(200 + Math.random() * 140); // 200°..340° (sin<0)
  } else if (side === 2) {
    // Depuis la gauche vers la droite
    it.x = -it.w;
    it.y = Math.random() * (VH - it.h);
    ang = deg2rad(-70 + Math.random() * 140); // -70°..70° (cos>0)
  } else {
    // Depuis la droite vers la gauche
    it.x = VW + 2;
    it.y = Math.random() * (VH - it.h);
    ang = deg2rad(110 + Math.random() * 140); // 110°..250° (cos<0)
  }
  const sp = (def?.baseSpeed || 120) * it.variation;
  it.vx = Math.cos(ang) * sp;
  it.vy = Math.sin(ang) * sp;
  it.customVel = true;
  items.push(it);
}

function processPickup(playerId, it) {
  const player = playerId === 1 ? p1 : p2;
  const isPoulet = (it.type === 'poulet');
  const isBombe = it.type === 'bombe';
  const other = playerId === 1 ? 2 : 1;
  // Score
  if (playerId === 1) score1 += it.points; else score2 += it.points;
  // Son
  if (!isPoulet && !isBombe) playItemSound(it.type, playerId);
  // Effets spéciaux
  if (it.type === 'poulet') {
    player.freeTime = Math.max(player.freeTime, CHICKEN_FREE_SEC);
    player.moveToCenterDur = 0.45;
    player.moveToCenterElapsed = 0;
    player.moveStartX = player.x;
    player.moveStartY = player.y;
    player.moveTargetX = Math.max(0, Math.round((VW - player.w) / 2));
    player.moveTargetY = Math.max(0, Math.round((VH - player.h) / 2));
    playExclusiveSfx('poulet', { loop: true, durationSec: CHICKEN_FREE_SEC, volume: 0.65 });
  } else if (it.type === 'angepoulet') {
    if (worldId === 'ciel') {
      player.freeTime = Math.max(player.freeTime, 10);
      player.moveToCenterDur = 0.45;
      player.moveToCenterElapsed = 0;
      player.moveStartX = player.x;
      player.moveStartY = player.y;
      player.moveTargetX = Math.max(0, Math.round((VW - player.w) / 2));
      player.moveTargetY = Math.max(0, Math.round((VH - player.h) / 2));
      playExclusiveSfx('poulet', { loop: true, durationSec: 10, volume: 0.65 });
    }
  }
  if (isBombe) {
    player.shrinkTime = Math.max(player.shrinkTime, BOMB_SHRINK_SEC);
    playExclusiveSfx('bombe', { loop: false, durationSec: null, volume: 0.7 });
    player.chickenStreak = 0;
    // Si effet poulet actif, annule immédiatement pour redevenir normal
    player.freeTime = 0;
    player.moveToCenterElapsed = player.moveToCenterDur;
    // Changer le fond à chaque bombe uniquement en mode multi
    if (fixedWorldMode === 'multi') nextBackground();
  }
  if (it.type === 'etoile') {
    // Boost vitesse x3 + mouvement libre 5s
    player.speedBoostTime = Math.max(player.speedBoostTime || 0, 5.0);
    player.starTime = Math.max(player.starTime || 0, 5.0);
  }
  if (it.type === 'sucette') {
    // Apparition d'un plateau pour ce joueur, actif 16s
    const imgP = ASSETS['plateau'];
    let pw = Math.round(VW * 0.25); // ~25% largeur écran
    let ph = 40;
    if (imgP && imgP.width && imgP.height) ph = Math.max(12, Math.round(pw * (imgP.height / imgP.width)));
    const px = Math.max(0, Math.min(VW - pw, Math.random() * (VW - pw)));
    const py = Math.max(0, Math.min(VH - ph - 60, Math.random() * (VH - ph - 60)));
    plateaus.push({ ownerId: playerId, x: Math.round(px), y: Math.round(py), w: pw, h: ph, ttl: 16 });
  }
  if (!isPoulet && !isBombe) {
    player.chickenStreak = 0;
    if (player.isPoule) {
      player.baseScale = Math.min(POULE_MAX_SCALE, player.baseScale * (1 + POULE_GROWTH_STEP));
    }
    // Transformations: dev mode instant (sans cumul), sinon règle 10x
    if (it.type === 'pizza' || it.type === 'burger' || it.type === 'tacos' || it.type === 'brocolis') {
      if (developerMode) {
        setSingleForm(player, it.type);
      } else {
        // Mode normal: appliquer règle 10x
        if (playerId === 1) maybeTransformPlayer(p1, stats1, it.type);
        else maybeTransformPlayer(p2, stats2, it.type);
      }
    }
  }
  // Effet braise: devenir 4x plus gros pendant 5 secondes
  if (it.type === 'braise') {
    player.giantTime = Math.max(player.giantTime || 0, 5.0);
  }
  // Historique & stats
  if (playerId === 1) {
    feed1.unshift(it.type); if (feed1.length > FEED_MAX) feed1.length = FEED_MAX;
    if (stats1 && it.type in stats1) stats1[it.type]++;
    if (it.type === 'sucette' && stats1 && (stats1['sucette']||0) >= 10) { p1.isBigLollipop = true; }
    maybeTransformPlayer(p1, stats1, it.type);
  } else {
    feed2.unshift(it.type); if (feed2.length > FEED_MAX) feed2.length = FEED_MAX;
    if (stats2 && it.type in stats2) stats2[it.type]++;
    if (it.type === 'sucette' && stats2 && (stats2['sucette']||0) >= 10) { p2.isBigLollipop = true; }
    maybeTransformPlayer(p2, stats2, it.type);
  }
}

function render() {
  // Préparer le contexte pour l'espace virtuel
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

  // Fond (couvre l'espace virtuel 16:9)
  const bg = getCurrentBackgroundImage();
  if (bg) {
    // Le canvas est 16:9, on peut étirer sur tout l'espace virtuel
    ctx.drawImage(bg, 0, 0, VW, VH);
  }
  else {
    ctx.fillStyle = "#101418";
    ctx.fillRect(0, 0, VW, VH);
  }

  // Items
  for (const it of items) it.draw(ctx);

  // Plateaux actifs (collecteurs)
  if (plateaus && plateaus.length) {
    const imgP = ASSETS['plateau'];
    for (const p of plateaus) {
      if (p.ttl <= 0) continue;
      if (imgP) ctx.drawImage(imgP, p.x, p.y, p.w, p.h);
      else {
        ctx.fillStyle = 'rgba(200,200,200,0.6)';
        ctx.fillRect(p.x, p.y, p.w, p.h);
      }
    }
  }

  // Projectiles
  for (const s of shots) s.draw(ctx);

  // Joueurs
  if (p1) p1.draw(ctx);
  if (p2) p2.draw(ctx);

  // HUD (scores + timer)
  drawHUD();

  // Overlays (menu, pause, game over)
  if (!assetsLoaded || (bgLoad && bgLoad.total > 0 && bgLoad.loaded < bgLoad.total)) drawLoadingOverlay();
  else if (gameState === STATE.MENU) drawMenu();
  else if (gameState === STATE.PAUSED) drawPause();
  else if (gameState === STATE.OVER) drawGameOver();
}

function drawHUD() {
  ctx.save();
  ctx.font = "28px Arial";
  ctx.textBaseline = "top";
  // Ombre légère pour lisibilité
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;

  // Scores
  ctx.fillStyle = "#e6f1ff";
  ctx.textAlign = "left";
  ctx.fillText(`Joueur 1: ${score1}`, 16, 12);

  ctx.textAlign = "right";
  ctx.fillText(`Joueur 2: ${score2}`, VW - 16, 12);

  // Timer au centre
  ctx.textAlign = "center";
  ctx.fillStyle = timeLeft <= 10 ? "#ffd166" : "#e6f1ff";
  ctx.fillText(formatTime(timeLeft), VW / 2, 12);

  // Feeds des 3 derniers items (icônes)
  drawFeedLeft();
  drawFeedRight();

  // Live stats (counts per item) under feeds
  drawLiveStatsLeft();
  drawLiveStatsRight();

  // Indicateur audio discret (coin bas-gauche)
  ctx.textAlign = "left";
  ctx.font = "16px Arial";
  ctx.fillStyle = "#cbd5e1";
  const modeLabel = soundMode === SOUND_MODE.SFX ? "SFX" : (soundMode === SOUND_MODE.MUSIC ? "Musique" : "Muet");
  ctx.fillText(`M: Mode son = ${modeLabel}`, 12, VH - 26);

  // Dev mode indicator (bottom-right)
  if (developerMode && gameState === STATE.PLAYING) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#9aa1aa";
    ctx.fillText("DEV ON", VW - 12, VH - 26);
  }

  ctx.restore();

  // Dev toggle label (bottom-right)
  ctx.save();
  const label = developerMode ? "Mode dev (D): ON" : "Mode dev (D)";
  ctx.font = "14px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#9aa1aa";
  const padding = 8;
  const metricsW = ctx.measureText(label).width;
  const w = Math.ceil(metricsW + 16);
  const h = 24;
  const x = VW - padding - w/2;
  const y = VH - padding - h/2;
  // Box background subtle
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x - w/2, y - h/2, w, h);
  ctx.strokeStyle = "#334155";
  ctx.strokeRect(x - w/2, y - h/2, w, h);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(label, VW - padding - 8, VH - padding - 6);
  ctx.restore();

  // Update clickable rect in virtual coords
  devToggleRect = { x: VW - padding - w, y: VH - padding - h, w: w, h: h };
}

function drawLiveStatsLeft() {
  if (!stats1) return;
  const icon = 18;
  let x = 16;
  let y = 110; // pushed lower to avoid overlap with feeds
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "14px Arial";
  for (const def of ITEM_TYPES) {
    const key = def.key;
    const img = ASSETS[key];
    const count = stats1[key] || 0;
    if (img) {
      const ih = Math.max(1, Math.round(icon * (img.height / img.width)));
      ctx.drawImage(img, x, y - Math.floor(ih/2), icon, ih);
    } else {
      ctx.fillStyle = "#334155";
      ctx.fillRect(x, y - Math.floor(icon/2), icon, icon);
    }
    ctx.fillStyle = "#e6f1ff";
    ctx.fillText(`x${count}`, x + icon + 6, y);
    y += 18;
  }
  ctx.restore();
}

function drawLiveStatsRight() {
  if (!stats2) return;
  const icon = 18;
  let x = VW - 16;
  let y = 110; // pushed lower to avoid overlap with feeds
  ctx.save();
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = "14px Arial";
  for (const def of ITEM_TYPES) {
    const key = def.key;
    const img = ASSETS[key];
    const count = stats2[key] || 0;
    if (img) {
      const ih = Math.max(1, Math.round(icon * (img.height / img.width)));
      ctx.drawImage(img, x - icon, y - Math.floor(ih/2), icon, ih);
    } else {
      ctx.fillStyle = "#334155";
      ctx.fillRect(x - icon, y - Math.floor(icon/2), icon, icon);
    }
    ctx.fillStyle = "#e6f1ff";
    ctx.fillText(`x${count}`, x - icon - 6, y);
    y += 18;
  }
  ctx.restore();
}

function drawFeedLeft() {
  if (!feed1 || feed1.length === 0) return;
  const y = 46; // sous le score
  let x = 16;
  for (let i = 0; i < Math.min(FEED_MAX, feed1.length); i++) {
    const key = feed1[i];
    const img = ASSETS[key];
    drawFeedIcon(img, x, y, key);
    x += FEED_ICON_W + FEED_ICON_GAP;
  }
}

function drawFeedRight() {
  if (!feed2 || feed2.length === 0) return;
  const y = 46; // sous le score
  let x = VW - 16; // partir du bord droit
  for (let i = 0; i < Math.min(FEED_MAX, feed2.length); i++) {
    const key = feed2[i];
    const img = ASSETS[key];
    const w = FEED_ICON_W;
    x -= w; // reculer de la largeur avant de dessiner
    drawFeedIcon(img, x, y, key);
    x -= FEED_ICON_GAP; // espacement vers la gauche
  }
}

function drawFeedIcon(img, x, y, keyLabel) {
  const w = FEED_ICON_W;
  let h = w;
  if (img && img.width && img.height) {
    h = Math.max(1, Math.round(w * (img.height / img.width)));
  }
  // fond
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  if (img) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    // placeholder si l'image n'est pas disponible
    ctx.fillStyle = "#334155";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(keyLabel.slice(0, 2), x + w / 2, y + h / 2);
  }
  ctx.restore();
}

function drawCenteredText(lines, yStart = VH / 2, lineH = 36, color = "#ffffff") {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "28px Arial";
  let y = yStart - ((lines.length - 1) * lineH) / 2;
  for (const line of lines) {
    ctx.fillText(line, VW / 2, y);
    y += lineH;
  }
  ctx.restore();
}

function drawLoading() {
  drawCenteredText([
    "Chargement des images...",
    "Si un asset manque, un placeholder sera utilisé.",
  ]);
}

function drawLoadingOverlay() {
  ctx.save();
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, VW, VH);

  ctx.fillStyle = "#e6f1ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "28px Arial";
  ctx.fillText("Chargement des images", VW/2, 40);

  const pct = assetLoad.total > 0 ? assetLoad.loaded / assetLoad.total : 0;
  const barW = Math.floor(VW * 0.6);
  const barH = 22;
  const barX = Math.floor((VW - barW)/2);
  const barY = 100;
  ctx.fillStyle = "#1f2a44";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = "#4cc9f0";
  ctx.fillRect(barX, barY, Math.floor(barW * pct), barH);
  ctx.strokeStyle = "#93a3b3";
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.font = "18px Arial";
  ctx.fillStyle = "#cbd5e1";
  const info = `${assetLoad.loaded}/${assetLoad.total} (${Math.round(pct*100)}%)`;
  ctx.fillText(info, VW/2, barY + barH + 12);
  if (assetLoad.current) {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#9fb3c8";
    ctx.fillText(`Fichier: ${assetLoad.current}`, VW/2, barY + barH + 36);
  }

  // Audio section
  const apct = audioLoad.total > 0 ? audioLoad.loaded / audioLoad.total : 0;
  const abarY = barY + 100;
  ctx.font = "22px Arial";
  ctx.fillStyle = "#e6f1ff";
  ctx.fillText("Chargement des sons", VW/2, abarY - 34);
  ctx.fillStyle = "#1f2a44";
  ctx.fillRect(barX, abarY, barW, barH);
  ctx.fillStyle = "#90dbf4";
  ctx.fillRect(barX, abarY, Math.floor(barW * apct), barH);
  ctx.strokeStyle = "#93a3b3";
  ctx.strokeRect(barX, abarY, barW, barH);
  ctx.font = "18px Arial";
  ctx.fillStyle = "#cbd5e1";
  const ainfo = `${audioLoad.loaded}/${audioLoad.total} (${Math.round(apct*100)}%)`;
  ctx.fillText(ainfo, VW/2, abarY + barH + 12);
  if (audioLoad.current) {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#9fb3c8";
    ctx.fillText(`Fichier: ${audioLoad.current}`, VW/2, abarY + barH + 36);
  }

  // Backgrounds (fonds) section
  const bpct = bgLoad.total > 0 ? bgLoad.loaded / bgLoad.total : 0;
  const bbarY = abarY + 100;
  ctx.font = "22px Arial";
  ctx.fillStyle = "#e6f1ff";
  ctx.fillText("Chargement des fonds", VW/2, bbarY - 34);
  ctx.fillStyle = "#1f2a44";
  ctx.fillRect(barX, bbarY, barW, barH);
  ctx.fillStyle = "#a5d8ff";
  ctx.fillRect(barX, bbarY, Math.floor(barW * bpct), barH);
  ctx.strokeStyle = "#93a3b3";
  ctx.strokeRect(barX, bbarY, barW, barH);
  ctx.font = "18px Arial";
  ctx.fillStyle = "#cbd5e1";
  const binfo = `${bgLoad.loaded}/${bgLoad.total} (${Math.round(bpct*100)}%)`;
  ctx.fillText(binfo, VW/2, bbarY + barH + 12);
  if (bgLoad.current) {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#9fb3c8";
    ctx.fillText(`Fichier: ${bgLoad.current}`, VW/2, bbarY + barH + 36);
  }

  // Erreurs en bas
  ctx.textAlign = "left";
  ctx.font = "14px monospace";
  ctx.fillStyle = "#fca5a5";
  const pad = 16;
  let y = VH - 140;
  ctx.fillText("Erreurs de chargement (images/sons):", pad, y);
  y += 20;
  const allErr = (assetLoad.errors||[]).concat(audioLoad.errors||[]);
  if (allErr.length) {
    const maxLines = 5;
    for (let i=0; i<Math.min(maxLines, allErr.length); i++) {
      ctx.fillText(`- ${allErr[i]}`, pad, y);
      y += 18;
    }
    if (allErr.length > maxLines) {
      ctx.fillText(`... (+${allErr.length - maxLines} autres)`, pad, y);
    }
  } else {
    ctx.fillStyle = "#94e2b9";
    ctx.fillText("Aucune erreur détectée", pad, y);
  }
  ctx.restore();
}

function drawMenu() {
  const modeLabel = soundMode === SOUND_MODE.SFX ? "SFX" : (soundMode === SOUND_MODE.MUSIC ? "Musique" : "Muet");
  const worldLabelMap = { multi: 'Multi-monde', enfer: 'Enfer', ciel: 'Ciel', espace: 'Espace', cuisine: 'Cuisine', palmier: 'Palmier' };
  const fixedLabel = worldLabelMap[fixedWorldMode] || 'Multi-monde';
  ctx.save();
  // Background subtle overlay
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, VW, VH);

  // Title
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#e6f1ff";
  ctx.font = "36px Arial";
  ctx.fillText("RouRn game", VW/2, 32);
  ctx.font = "18px Arial";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("The first Pollito Nene game.", VW/2, 72);

  // Panels
  const panelPad = 14;
  const leftX = Math.floor(VW*0.08);
  const rightX = Math.floor(VW*0.54);
  const topY = 120;
  const panelW = Math.floor(VW*0.38);
  const panelH = Math.floor(VH*0.60);

  // Left panel: Présentation & Commandes
  ctx.fillStyle = "rgba(16,24,40,0.85)";
  ctx.fillRect(leftX, topY, panelW, panelH);
  ctx.strokeStyle = "#334155";
  ctx.strokeRect(leftX, topY, panelW, panelH);
  ctx.fillStyle = "#e6f1ff";
  ctx.textAlign = "left";
  ctx.font = "22px Arial";
  ctx.fillText("Présentation", leftX + panelPad, topY + panelPad);
  ctx.font = "16px Arial";
  let ly = topY + panelPad + 26;
  const lh = 20;
  const lines = [
    "Objectif: attraper un maximum d'aliments.",
    "Astuce: 10× le même aliment = pouvoirs.",
    `Son: [1] SFX • [2] Musique • [3] Muet (Actuel: ${modeLabel})`,
    "M: basculer rapidement le mode son",
  ];
  ctx.fillStyle = "#cbd5e1";
  for (const L of lines) { ctx.fillText(L, leftX + panelPad, ly); ly += lh; }
  // Affichage du mode monde sélectionné
  ctx.fillText(`Monde: ${fixedLabel} (F pour changer)`, leftX + panelPad, ly);
  ly += lh;

  ctx.fillStyle = "#e6f1ff";
  ctx.font = "22px Arial";
  ctx.fillText("Commandes", leftX + panelPad, ly + 6);
  ctx.font = "16px Arial";
  ctx.fillStyle = "#cbd5e1";
  ly += 30;
  const cmds = [
    "J1: ZQSD (Tir: A)",
    "J2: Flèches (Tir: Entrée)",
    "Espace: Démarrer • P: Pause",
  ];
  for (const L of cmds) { ctx.fillText(L, leftX + panelPad, ly); ly += lh; }

  // Right panel: Points & Pouvoirs
  ctx.fillStyle = "rgba(16,24,40,0.85)";
  ctx.fillRect(rightX, topY, panelW, panelH);
  ctx.strokeStyle = "#334155";
  ctx.strokeRect(rightX, topY, panelW, panelH);
  ctx.textAlign = "left";
  ctx.fillStyle = "#e6f1ff";
  ctx.font = "22px Arial";
  ctx.fillText("Points & Pouvoirs", rightX + panelPad, topY + panelPad);
  ctx.font = "16px Arial";
  let ry = topY + panelPad + 30;
  const icon = 26;
  const rowGap = 28;
  const entries = [
    { key: 'pizza', text: "+3 • Roulage périmètre, tir pepperoni (2s)" },
    { key: 'burger', text: "+3 • Tir salade/tomate vers le haut (4s)" },
    { key: 'tacos', text: "+2 • Tir salade/tomate vers le haut (4s)" },
    { key: 'brocolis', text: "+1 • Vitesse +35%" },
    { key: 'poulet', text: "+5 • Mouvement libre 5s" },
    { key: 'bombe', text: "−5 • Rétrécit 5s" },
  ];
  for (const ent of entries) {
    const img = ASSETS[ent.key];
    if (img) {
      const ih = Math.max(1, Math.round(icon * (img.height / img.width)));
      ctx.drawImage(img, rightX + panelPad, ry - Math.floor(ih/2), icon, ih);
    } else {
      ctx.fillStyle = "#334155";
      ctx.fillRect(rightX + panelPad, ry - Math.floor(icon/2), icon, icon);
    }
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(ent.text, rightX + panelPad + icon + 10, ry);
    ry += rowGap;
  }

  // Start hint box (centered)
  const btnW = Math.floor(VW * 0.44);
  const btnH = 56;
  const btnX = Math.floor((VW - btnW) / 2);
  const btnY = Math.min(VH - 90, topY + panelH + 24);
  ctx.fillStyle = "rgba(15,23,42,0.9)";
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = "#4cc9f0";
  ctx.lineWidth = 2;
  ctx.strokeRect(btnX, btnY, btnW, btnH);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e6f1ff";
  ctx.font = "24px Arial";
  ctx.fillText("Espace pour commencer", btnX + btnW/2, btnY + btnH/2);

  ctx.restore();
}

function drawPause() {
  drawCenteredText([
    "Pause",
    "P: Reprendre • Échap: Menu",
  ]);
}

function drawGameOver() {
  const winner = (score1 === score2) ? "Égalité" : (score1 > score2 ? "Vainqueur: Joueur 1" : "Vainqueur: Joueur 2");
  drawCenteredText([
    "Fin de partie !",
    `Score J1: ${score1} | Score J2: ${score2}`,
    winner,
    "[R] Rejouer • [Échap] Retour menu",
  ]);

  // Affichage des comptes par aliment pour chaque joueur
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = "20px Arial";
  ctx.fillStyle = "#e6f1ff";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;

  const lineH = 32;
  const iconW = 24;
  const yStart = Math.round(VH / 2 + 80);

  // En-têtes colonnes
  ctx.textAlign = "left";
  ctx.fillText("Joueur 1 – Détails", 40, yStart - lineH);
  ctx.textAlign = "right";
  ctx.fillText("Joueur 2 – Détails", VW - 40, yStart - lineH);

  // Colonne gauche (J1)
  let y = yStart;
  let xL = 40;
  ctx.textAlign = "left";
  for (const def of ITEM_TYPES) {
    const key = def.key;
    const img = ASSETS[key];
    const count = stats1 ? (stats1[key] || 0) : 0;
    const pts = getItemPoints(key) * count;
    const iw = iconW;
    const ih = img && img.width && img.height ? Math.round(iw * (img.height / img.width)) : iw;
    if (img) ctx.drawImage(img, xL, y - Math.floor(ih / 2), iw, ih);
    else { ctx.fillRect(xL, y - Math.floor(iw/2), iw, iw); }
    ctx.fillText(`x${count} (${pts >= 0 ? '+' : ''}${pts})`, xL + iw + 8, y);
    y += lineH;
  }

  // Colonne droite (J2)
  y = yStart;
  let xR = VW - 40;
  ctx.textAlign = "right";
  for (const def of ITEM_TYPES) {
    const key = def.key;
    const img = ASSETS[key];
    const count = stats2 ? (stats2[key] || 0) : 0;
    const pts = getItemPoints(key) * count;
    const iw = iconW;
    const ih = img && img.width && img.height ? Math.round(iw * (img.height / img.width)) : iw;
    // Icône alignée à droite
    if (img) ctx.drawImage(img, xR - iw, y - Math.floor(ih / 2), iw, ih);
    else { ctx.fillRect(xR - iw, y - Math.floor(iw/2), iw, iw); }
    ctx.fillText(`x${count} (${pts >= 0 ? '+' : ''}${pts})`, xR - iw - 8, y);
    y += lineH;
  }
  ctx.restore();
}

// -----------------------------
// Logique de contrôle des états
// -----------------------------
function handleToggles() {
  // Menu
  if (gameState === STATE.MENU) {
    if (keys[" "] || keys["Spacebar"] || keys["Space"]) { // Espace
      keys[" "] = keys["Spacebar"] = false; // consommer
      keys["Space"] = false;
      startGame();
      return;
    }
  }
  // Pause
  if (gameState === STATE.PLAYING && (keys["p"] || keys["P"])) {
    keys["p"] = keys["P"] = false;
    gameState = STATE.PAUSED;
    return;
  }
  if (gameState === STATE.PAUSED) {
    if (keys["p"] || keys["P"]) {
      keys["p"] = keys["P"] = false;
      gameState = STATE.PLAYING;
      return;
    }
    if (keys["Escape"]) {
      keys["Escape"] = false;
      toMenu();
      return;
    }
  }

  // Game Over
  if (gameState === STATE.OVER) {
    if (keys["r"] || keys["R"]) {
      keys["r"] = keys["R"] = false;
      startGame();
      return;
    }
    if (keys["Escape"]) {
      keys["Escape"] = false;
      toMenu();
      return;
    }
  }

  // Mute
  // Touche M: cycle des modes SFX → MUSIQUE → MUTE → SFX
  if (keys["m"] || keys["M"]) {
    keys["m"] = keys["M"] = false;
    const order = [SOUND_MODE.SFX, SOUND_MODE.MUSIC, SOUND_MODE.MUTE];
    const idx = order.indexOf(soundMode);
    const next = order[(idx + 1) % order.length];
    setSoundMode(next);
  }

  // Raccourcis de sélection directe (disponibles dès le menu)
  if (keys["1"]) { keys["1"] = false; setSoundMode(SOUND_MODE.SFX); }
  if (keys["2"]) { keys["2"] = false; setSoundMode(SOUND_MODE.MUSIC); }
  if (keys["3"]) { keys["3"] = false; setSoundMode(SOUND_MODE.MUTE); }
}

function frame(ts) {
  const now = ts || performance.now();
  let dt = (now - lastTs) / 1000;
  lastTs = now;
  // Clamp du dt pour éviter de gros sauts si onglet inactif
  dt = Math.min(0.05, Math.max(0, dt));

  // Dev toggle via D on menu
  if (gameState === STATE.MENU && (keys['d'] || keys['D'])) {
    keys['d'] = keys['D'] = false;
    developerMode = !developerMode;
  }
  // World selection via F on menu
  if (gameState === STATE.MENU && (keys['f'] || keys['F'])) {
    keys['f'] = keys['F'] = false;
    cycleFixedWorld();
    if (fixedWorldMode !== 'multi') {
      // Choisir un fond correspondant si disponible
      const idx = Math.max(0, bgImages.findIndex(e => e.id === fixedWorldMode));
      if (idx >= 0) { bgIndex = idx; setWorldFromId(bgImages[bgIndex]?.id); }
      else { setWorldFromId(fixedWorldMode); }
    } else {
      // Multi: revenir au premier fond (fond.png si présent)
      bgIndex = 0;
      setWorldFromId(bgImages[bgIndex]?.id || 'classique');
    }
  }

  try {
    handleToggles();
    update(dt);
    render();
  } catch (e) {
    console.error('FRAME ERROR:', e && e.stack ? e.stack : e);
  }
  requestAnimationFrame(frame);
}

// -----------------------------
// Initialisation
// -----------------------------
function init() {
  resetGame();
  gameState = STATE.MENU;
  requestAnimationFrame(frame);
}

// Démarrage après interaction utilisateur (policy audio/perf)
let started = false;
function startOnce() {
  if (started) return;
  started = true;
  console.log('START GAME');
  // Lancer la boucle et l'UI immédiatement
  init();
  // Charger médias en arrière-plan
  preloadAssets().catch((e)=>console.error('IMG PRELOAD ERR', e)).then(()=>{});
  preloadAudio().catch((e)=>console.error('AUDIO PRELOAD ERR', e));
  // Découverte des fonds disponibles (fond*.png)
  discoverBackgrounds().catch((e)=>console.error('BG DISCOVERY ERR', e));
}
// Démarrage immédiat sans interaction
try {
  started = true;
  init();
  preloadAssets().catch((e)=>console.error('IMG PRELOAD ERR', e));
  preloadAudio().catch((e)=>console.error('AUDIO PRELOAD ERR', e));
  // Découverte des fonds disponibles (fond*.png)
  discoverBackgrounds().catch((e)=>console.error('BG DISCOVERY ERR', e));
} catch (_) {
  // si un souci, fallback sur interaction
  document.addEventListener('click', startOnce, { once: true });
  document.addEventListener('keydown', startOnce, { once: true });
}

// Journalisation utile (erreurs globales)
window.addEventListener('error', e => console.error('JS ERROR:', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', e => console.error('PROMISE REJECTION:', e.reason));

// Notes d'implémentation (visibles en lecture du code):
// - Espace virtuel 1280x720 (16:9); le canvas est mis à l'échelle via renderScale.
// - AABB basique via intersects(a,b) avec petites marges (COLLISION_PAD).
// - ITEM_TYPES centralise points et vitesses; ajustable facilement.
// - Difficulté: toutes les 20 s, spawnRate += 0.15 et fallSpeed *= 1.05 (avec caps).
// - Ordre de dessin: fond → items → joueurs → HUD/overlays.

// Click handler for dev toggle in menu
(function(){
  function canvasToVirtual(ev){
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / VW;
    return {
      x: (ev.clientX - rect.left) / scale,
      y: (ev.clientY - rect.top) / scale
    };
  }
  document.addEventListener('click', (ev)=>{
    if (gameState !== STATE.MENU) return;
    const p = canvasToVirtual(ev);
    const r = devToggleRect;
    if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      developerMode = !developerMode;
    }
  }, false);
})();
