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
const WIN_SCORE = 100;        // Score qui termine immédiatement la partie
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
const TACO_SHOT_INTERVAL = 4.0; // tir manuel toutes les ~4 s (tacos/burger)
const TACO_SHOT_SPEED = 180;    // vitesse des projectiles tacos/burger (px/s)
const MAX_SHOTS = 24;           // sécurité de projectiles simultanés
const PIZZA_SHOT_INTERVAL = 2.0; // pizza: un tir toutes les ~2 s
const PIZZA_SHOT_SPEED = 180;    // vitesse des peperoni (px/s)
// Monde espace (fond-espace): réglages spécifiques
const SPACE_PLAYER_SPEED_FACTOR = 0.6;   // joueurs plus lents en apesanteur
const SPACE_ITEM_SPEED_FACTOR = 0.45;    // nourriture se déplace lentement
const SPACE_STAR_SPEED_MULT = 1.6;       // etoile: vitesse x1.6 pendant le boost espace
const SPACE_STAR_DURATION = 5.0;         // etoile: 5 secondes
const SPACE_STAR_POINTS = 5;             // etoile (dernier monde) vaut 5 points
const FRITE_POINTS = 0;                  // points directs de la frite (bonus via mini-frites)
const FRITE_BASE_SPEED = 150;            // vitesse de chute de la frite
const FRITE_BASE_W = 46;                 // taille de la frite
const FRITE_SPAWN_INTERVAL = 10;         // apparition forcée d'une frite toutes les 10 s
const FRITE_SHOT_SPEED = 280;            // vitesse des petites frites
const FRITE_SHOT_W = 18;                 // taille des petites frites
const FRITE_SHOT_LIFETIME = 12;          // sécurité: durée max des petites frites (s)
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
const CHICKEN_SPAWN_INTERVAL = 30;  // apparition forcée d'un poulet toutes les 30 s

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
        console.warn(`[assets] Échec de chargement image '${name}' via toutes les tentatives`);
        return resolve(ph);
      }
      const url = pathList.shift();
      const img = new Image();
      img.onload = () => resolve(img);
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
  { key: "fond", file: "fond-classique.png", color: "#1b2a41" },
  // Fonds alternatifs
  { key: "fond_couteau", file: "fond-couteau.png", color: "#1b2a41" },
  { key: "fond_enfer", file: "fond-enfer.png", color: "#2b0000" },
  { key: "fond_espace", file: "fond-espace.png", color: "#001b2b" },
  { key: "rourn1", file: "rourn1.png", color: "#4461cf" },
  { key: "rourn2", file: "rourn2.png", color: "#cf4444" },
  // Transformations visuelles des joueurs
  { key: "rourntacos", file: "rourntacos.png", color: "#b56576" },
  { key: "rournpizza", file: "rournpizza.png", color: "#d4a373" },
  { key: "rournbrocolis", file: "rournbrocolis.png", color: "#5aa469" },
  { key: "rournburger", file: "rournburger.png", color: "#c9a227" },
  { key: "tacostomato", file: "Tomato.png", color: "#c0392b" },
  { key: "tacossalad", file: "Salad.png", color: "#27ae60" },
  { key: "pepperoni", file: "peperoni.png", color: "#b33f2a" },
  { key: "frite", file: "frite.png", color: "#f2c94c" },
  { key: "rourn1ailes", file: "rourn1ailes.png", color: "#8fb9ff" },
  { key: "rourn2ailes", file: "rourn2ailes.png", color: "#ff8fb9" },
  { key: "rournpoule", file: "rournpoule.png", color: "#deb887" },
  { key: "pizza", file: "pizza.png", color: "#d4a373" },
  { key: "burger", file: "burger.png", color: "#c9a227" },
  { key: "tacos", file: "Tacos.png", color: "#b56576" },
  { key: "brocolis", file: "brocolis.png", color: "#5aa469" },
  { key: "poulet", file: "poulet.png", color: "#ce9461" },
  // Sprite alternatif pour le poulet après activation
  { key: "couteau", file: "couteau.png", color: "#ce9461" },
  // Étape enfer: couteau devient braise, joueurs -> rourn-enfer
  { key: "braise", file: "braise.png", color: "#cf4444" },
  { key: "etoile", file: "etoile.png", color: "#ffd166" },
  { key: "rourn_enfer", file: "rourn-enfer.png", color: "#e11d48" },
  { key: "bombe", file: "bombe.png", color: "#555" },
];

const ASSETS = Object.create(null); // key -> CanvasImageSource
let originalPouletImg = null; // pour restaurer l'image poulet d'origine
let assetsLoaded = false;
let assetLoad = { total: 0, loaded: 0, current: "", errors: [] };

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
  const add = (n) => out.add(prefix + dir + n);
  add(name);
  add(name.toLowerCase());
  add(name.toUpperCase());
  const cap = (base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()) + ext.toLowerCase();
  add(cap);
  return Array.from(out);
}

function preloadAssets() {
  assetLoad.total = ASSET_LIST.length;
  assetLoad.loaded = 0;
  assetLoad.current = "";
  assetLoad.errors = [];
  const promises = ASSET_LIST.map(({ key, file, color }) =>
    loadImage(key, caseVariants(file), color).then((img) => {
      ASSETS[key] = img;
      assetLoad.loaded += 1;
      assetLoad.current = file;
      if (img && img.__placeholder) assetLoad.errors.push(file);
      // Conserver l'image poulet originale pour restauration ultérieure
      if (key === 'poulet' && !originalPouletImg && img) {
        originalPouletImg = img;
      }
    })
  );
  return Promise.all(promises).then(() => { assetsLoaded = true; });
}

// ---------------------------------
// Audio fichiers (sound2/*.wav) + musique (sound3banana/*.mp3) + modes
// ---------------------------------
const SOUND_MODE = { SFX: "sfx", MUSIC: "music", MUTE: "mute" };
let soundMode = SOUND_MODE.SFX; // sélection utilisateur (menu): SFX (défaut), MUSIC, MUTE
let audioEnabled = true;       // dérivé de soundMode != MUTE
let audioPreloaded = false;    // évite de bloquer le chargement initial
const AUDIO_LIST = [
  { key: "pbtb", file: "sound2/pbtb.wav" },
  { key: "bombe", file: "sound2/bombe.wav" },
  { key: "poulet", file: "sound2/poulet.wav" },
  { key: "etoile", file: "sound2/Son-etoile.wav" },
  { key: "banana", file: "sound3banana/chickenbanana.mp3" },
  { key: "fartprout", file: "fartprout.mp3" },
];
const AUDIO = Object.create(null); // inutilisé désormais, conservé pour compat
const AUDIO_SOURCES = Object.create(null); // key -> array d'URLs candidates
const activeSounds = new Set();

function loadAudio(key, src) {
  // Prépare les variantes de casse et stocke les URLs candidates
  const variants = caseVariants(src);
  AUDIO_SOURCES[key] = variants;
  // Ne crée pas d'élément audio bloquant ici
  return Promise.resolve(null);
}

function preloadAudio() {
  if (audioPreloaded) return Promise.resolve();
  const promises = AUDIO_LIST.map(({ key, file }) =>
    loadAudio(key, file).then((aud) => { AUDIO[key] = aud; })
  );
  return Promise.all(promises).then(() => { audioPreloaded = true; });
}

function playSound(key, { loop = false, durationSec = null, volume = 0.6 } = {}) {
  if (!audioEnabled) return null;
  const sources = AUDIO_SOURCES[key];
  if (!sources || sources.length === 0) return null;
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
  let idx = 0;
  const tryPlay = () => {
    if (idx >= sources.length) { return; }
    a.src = sources[idx++];
    a.play().then(() => {
      if (durationSec && durationSec > 0) {
        timer = setTimeout(() => handle.stop(), Math.floor(durationSec * 1000));
      }
    }).catch(() => {
      // Essayer la prochaine variante
      tryPlay();
    });
  };
  tryPlay();
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
  "ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","Spacebar",
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
    this.tacoNextSalad = true;// alterne salade/tomate
    this.pizzaTimer = 0;      // accumulateur pour tirs auto (pizza)
    // Espace: boost de vitesse temporaire après étoile
    this.starBoostTime = 0;   // temps restant du boost étoile (s)
    // Effet poulet: apparence et déplacement doux vers le centre
    this.wingsKey = null;     // 'rourn1ailes' ou 'rourn2ailes'
    this.moveToCenterElapsed = 0;
    this.moveToCenterDur = 0;
    this.moveStartX = 0;
    this.moveStartY = 0;
    this.moveTargetX = 0;
    this.moveTargetY = 0;
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
    const tf = getPlayerTransform(this);
    if (tf === "brocolis") sp *= 1.35;
    // Monde espace: déplacement plus lent par défaut
    if (spaceMode) sp *= SPACE_PLAYER_SPEED_FACTOR;
    // Boost étoile en espace
    if ((this.starBoostTime || 0) > 0) sp *= SPACE_STAR_SPEED_MULT;
    this.x += dx * sp * dt;
    this.y += dy * sp * dt;
    // Pizza: rotation; si hors poulet on utilisera la distance périmètre (gérée après),
    // sinon on utilise la composante dominante de vitesse
    if (tf === "pizza" && this.freeTime > 0) {
      const rotVel = (Math.abs(dx) >= Math.abs(dy) ? dx : dy) * sp;
      this.angle += rotVel * dt * 0.12;
    }
    // Tacos: avance de phase (rythme plus marqué si on bouge)
    if (tf === "tacos") {
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
    const img = (this.freeTime > 0 && this.wingsKey && ASSETS[this.wingsKey]) ? ASSETS[this.wingsKey] : this.img;
    if (!img) return;
    const tf = getPlayerTransform(this);
    if (tf === "pizza") {
      // Dessin avec rotation autour du centre
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
  { key: "poulet",   points:  5, baseSpeed: 200, baseW: 60 }, // bonus un peu plus grand
  { key: "frite",    points:  FRITE_POINTS, baseSpeed: FRITE_BASE_SPEED, baseW: FRITE_BASE_W, forceOnly: true }, // spawn forcé
  { key: "bombe",    points: -5, baseSpeed: 220, baseW: 56 }, // piège
];

function getItemPoints(key) {
  const d = ITEM_TYPES.find(t => t.key === key);
  return d ? d.points : 0;
}

class Item {
  constructor(typeKey, x, y = undefined, dirX = 0, dirY = 1) {
    const def = ITEM_TYPES.find(t => t.key === typeKey);
    this.type = def.key;
    this.points = def.points;
    this.baseSpeed = def.baseSpeed;
    this.baseW = def.baseW || ITEM_BASE_W;
    this.x = x;
    // Position Y par défaut juste au-dessus si non précisée
    this.y = (y == null) ? -this.h : y;
    this.variation = 0.9 + Math.random() * 0.2; // petite variation de vitesse
    // Direction de déplacement (unité approximative, normalisée plus bas)
    const len = Math.hypot(dirX, dirY) || 1;
    this.dirX = dirX / len;
    this.dirY = dirY / len;
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
    if (spaceMode) {
      const sp = this.baseSpeed * this.variation * (speedMult) * SPACE_ITEM_SPEED_FACTOR;
      this.x += this.dirX * sp * dt;
      this.y += this.dirY * sp * dt;
    } else {
      const vy = this.baseSpeed * this.variation * speedMult;
      this.y += vy * dt;
    }
  }
  draw(g) {
    const img = this.img;
    if (img) g.drawImage(img, this.x, this.y, this.w, this.h);
  }
}

// Projectiles envoyés par le tacos
class Projectile {
  constructor(ownerId, kind, x, y, w, h, vx = 0, vy = -TACO_SHOT_SPEED, opts = {}) {
    this.ownerId = ownerId;     // 1 ou 2
    this.kind = kind;           // 'salad' | 'tomato'
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.vx = vx; this.vy = vy;
    this.bouncy = !!opts.bouncy;
    this.life = opts.life || 0; // 0 = illimité
  }
  get img() {
    if (this.kind === 'salad') return ASSETS['tacossalad'];
    if (this.kind === 'tomato') return ASSETS['tacostomato'];
    if (this.kind === 'pepperoni') return ASSETS['pepperoni'];
    if (this.kind === 'frite') return ASSETS['frite'];
    return null;
  }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.bouncy) {
      // rebond sur les bords de l'espace virtuel
      if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx); }
      if (this.x + this.w > VW) { this.x = VW - this.w; this.vx = -Math.abs(this.vx); }
      if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy); }
      if (this.y + this.h > VH) { this.y = VH - this.h; this.vy = -Math.abs(this.vy); }
      if (this.life > 0) this.life = Math.max(0, this.life - dt);
    }
  }
  draw(g) {
    const img = this.img;
    if (img) g.drawImage(img, this.x, this.y, this.w, this.h);
    else {
      g.fillStyle =
        this.kind === 'salad' ? '#27ae60' :
        this.kind === 'frite' ? '#f2c94c' :
        '#c0392b';
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
let score1 = 0, score2 = 0;
let timeLeft = GAME_DURATION; // s
let spawnRate = SPAWN_BASE_RATE; // items/sec
let speedMult = 1.0;            // multiplicateur vitesse chute
let spawnAcc = 0;               // accumulateur de spawn
let chickenTimer = 0;           // timer pour les apparitions forcées de poulet
let pendingChickens = 0;        // nombre de poulets à générer dès que possible
let friteTimer = 0;             // timer pour les frite forcées
let pendingFrites = 0;          // nombre de frites à générer dès que possible
let elapsed = 0;                // temps écoulé depuis start
let lastDiffStep = 0;           // paliers appliqués
let feed1 = []; // derniers items pris par J1 (types)
let feed2 = []; // derniers items pris par J2 (types)
let stats1 = null; // compteur par type pour J1
let stats2 = null; // compteur par type pour J2
const ALL_ITEM_KEYS = ITEM_TYPES.map(t => t.key);
// Fond courant et mode couteau (après poulet)
let currentBgKey = 'fond';
let knifeMode = false;
let hellMode = false; // étape enfer après capture de couteau
let spaceMode = false; // étape espace après braise

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
  items = [];
  shots = [];
  score1 = 0;
  score2 = 0;
  timeLeft = GAME_DURATION;
  spawnRate = SPAWN_BASE_RATE;
  speedMult = 1.0;
  spawnAcc = 0;
  chickenTimer = 0;
  pendingChickens = 0;
  friteTimer = 0;
  pendingFrites = 0;
  elapsed = 0;
  lastDiffStep = 0;
  feed1 = [];
  feed2 = [];
  stats1 = makeEmptyStats();
  stats2 = makeEmptyStats();
  // Réinitialiser le fond et le mode couteau
  knifeMode = false;
  hellMode = false;
  spaceMode = false;
  currentBgKey = 'fond';
  // Restaurer l'image du poulet si on l'avait remplacée
  if (originalPouletImg) {
    ASSETS['poulet'] = originalPouletImg;
  }
  // Restaurer l'apparence de base des joueurs
  p1.imgKey = p1.defaultImgKey;
  p2.imgKey = p2.defaultImgKey;
  p1.wingsKey = 'rourn1ailes';
  p2.wingsKey = 'rourn2ailes';
}

function startGame() {
  resetGame();
  gameState = STATE.PLAYING;
}

function toMenu() {
  gameState = STATE.MENU;
}

function gameOver() {
  gameState = STATE.OVER;
}

function maybeEndGameByScore() {
  if (gameState !== STATE.PLAYING) return false;
  if (score1 >= WIN_SCORE || score2 >= WIN_SCORE) {
    gameOver();
    return true;
  }
  return false;
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
    return;
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
  // Décrémenter les timers
  p1.freeTime = Math.max(0, p1.freeTime - dt);
  p2.freeTime = Math.max(0, p2.freeTime - dt);
  p1.shrinkTime = Math.max(0, p1.shrinkTime - dt);
  p2.shrinkTime = Math.max(0, p2.shrinkTime - dt);
  // Espace: boost étoile
  p1.starBoostTime = Math.max(0, (p1.starBoostTime || 0) - dt);
  p2.starBoostTime = Math.max(0, (p2.starBoostTime || 0) - dt);

  // En mode normal (pas poulet): par défaut horizontal uniquement.
  // Spécial pizza: gauche/droite contrôlent le déplacement le long du bord (périmètre).
  const p1IsPizza = getPlayerTransform(p1) === 'pizza';
  const p2IsPizza = getPlayerTransform(p2) === 'pizza';

  let s1 = 0, s2 = 0;
  if (!spaceMode) {
    if (p1.freeTime <= 0) {
      if (p1IsPizza) {
        s1 = Math.sign(dx1);
        dx1 = 0; dy1 = 0; // on gèrera le déplacement périmètre après update
      } else {
        dy1 = 0;
      }
    }
    if (p2.freeTime <= 0) {
      if (p2IsPizza) {
        s2 = Math.sign(dx2);
        dx2 = 0; dy2 = 0;
      } else {
        dy2 = 0;
      }
    }
  }

  [dx1, dy1] = normalize(dx1, dy1);
  [dx2, dy2] = normalize(dx2, dy2);

  // Décrémenter les cooldowns de tir
  p1.tacoTimer = Math.max(0, (p1.tacoTimer || 0) - dt);
  p2.tacoTimer = Math.max(0, (p2.tacoTimer || 0) - dt);
  p1.pizzaTimer = Math.max(0, (p1.pizzaTimer || 0) - dt);
  p2.pizzaTimer = Math.max(0, (p2.pizzaTimer || 0) - dt);

  p1.update(dx1, dy1, dt);
  p2.update(dx2, dy2, dt);

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

  // Tacos: tirs automatiques alternés salade/tomate
  function tryShootFor(player, id, fire) {
    const tf = getPlayerTransform(player);
    if ((tf === "tacos" || tf === "burger") && fire) {
      if ((player.tacoTimer || 0) <= 0 && shots.length < MAX_SHOTS) {
        player.tacoTimer = TACO_SHOT_INTERVAL;
        const useSalad = player.tacoNextSalad;
        player.tacoNextSalad = !player.tacoNextSalad;
        const projImg = ASSETS[useSalad ? "tacossalad" : "tacostomato"];
        const pw = Math.max(4, Math.round(player.w / 3));
        let ph = pw;
        if (projImg && projImg.width && projImg.height) ph = Math.max(4, Math.round(pw * (projImg.height / projImg.width)));
        const sx = Math.round(player.x + player.w / 2 - pw / 2);
        const sy = Math.round(player.y - ph + 4);
        const vx = 0, vy = -TACO_SHOT_SPEED;
        const kind = useSalad ? 'salad' : 'tomato';
        shots.push(new Projectile(id, kind, sx, sy, pw, ph, vx, vy));
        if (soundMode === SOUND_MODE.SFX) playSound('fartprout', { volume: 0.6 });
      }
    }
    if (tf === 'pizza' && fire) {
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
  p1.scale = p1.baseScale * burgerFactor1 * ((p1.freeTime > 0 && !p1.isPoule) ? CHICKEN_SCALE : 1) * (p1.shrinkTime > 0 ? BOMB_SHRINK_SCALE : 1);
  p2.scale = p2.baseScale * burgerFactor2 * ((p2.freeTime > 0 && !p2.isPoule) ? CHICKEN_SCALE : 1) * (p2.shrinkTime > 0 ? BOMB_SHRINK_SCALE : 1);

  // Calcul dynamique de la baseline (selon la hauteur actuelle)
  p1.baselineY = Math.round(VH - p1.h - BASELINE_MARGIN);
  p2.baselineY = Math.round(VH - p2.h - BASELINE_MARGIN);

  // Forcer/faire tomber à la ligne de base si pas de mouvement libre
  if (!spaceMode) {
    if (p1.freeTime <= 0) {
      if (!p1IsPizza) {
        if (p1.y < p1.baselineY) p1.y = Math.min(p1.baselineY, p1.y + FALL_SPEED * dt);
        else p1.y = p1.baselineY;
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
    if (p2.freeTime <= 0) {
      if (!p2IsPizza) {
        if (p2.y < p2.baselineY) p2.y = Math.min(p2.baselineY, p2.y + FALL_SPEED * dt);
        else p2.y = p2.baselineY;
      } else {
        if (p2.perimT == null) p2.perimT = projectPerimeterT(p2);
        const dist = s2 * p2.speed * dt;
        const L = perimeterLength(p2);
        p2.perimT = ((p2.perimT + dist) % L + L) % L;
        setPosFromPerimeterT(p2, p2.perimT);
        p2.angle += dist * 0.12;
      }
    }
  }

  // Tacos: sautille (appliquer un offset vertical au repos de baseline)
  // tf1/tf2 déjà calculés ci-dessus
  if (!spaceMode && p1.freeTime <= 0 && tf1 === "tacos") {
    const hop = Math.max(0, Math.sin(p1.hopPhase)) * HOP_AMP;
    p1.y = p1.baselineY - Math.round(hop);
  }
  if (!spaceMode && p2.freeTime <= 0 && tf2 === "tacos") {
    const hop = Math.max(0, Math.sin(p2.hopPhase)) * HOP_AMP;
    p2.y = p2.baselineY - Math.round(hop);
  }

  // Timer d'apparition forcée du poulet
  chickenTimer += dt;
  while (chickenTimer >= CHICKEN_SPAWN_INTERVAL) {
    chickenTimer -= CHICKEN_SPAWN_INTERVAL;
    pendingChickens++;
  }
  // Timer d'apparition forcée de la frite
  friteTimer += dt;
  while (friteTimer >= FRITE_SPAWN_INTERVAL) {
    friteTimer -= FRITE_SPAWN_INTERVAL;
    pendingFrites++;
  }

  // Spawns
  if (items.length < MAX_ITEMS) {
    spawnAcc += dt * spawnRate;
    while (pendingChickens > 0 && items.length < MAX_ITEMS) {
      spawnItem('poulet');
      pendingChickens--;
    }
    while (pendingFrites > 0 && items.length < MAX_ITEMS) {
      spawnItem('frite');
      pendingFrites--;
    }
    while (spawnAcc >= 1 && items.length < MAX_ITEMS) {
      spawnAcc -= 1;
      spawnItem();
    }
  }

  // Items update + collisions + nettoyage
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.update(dt, speedMult);

    const r = it.rect();
    // Attrapé par J1 ? (burger: plus de zone élargie, on utilise juste la taille accrue)
    if (intersects(p1.rect(), r)) { processPickup(1, it); items.splice(i, 1); if (gameState !== STATE.PLAYING) return; continue; }
    // Attrapé par J2 ? (burger: plus de zone élargie, on utilise juste la taille accrue)
    if (intersects(p2.rect(), r)) { processPickup(2, it); items.splice(i, 1); if (gameState !== STATE.PLAYING) return; continue; }
    // Sorti de l'écran ? (pas de pénalité)
    if (!spaceMode) {
      if (it.y > VH + 10) items.splice(i, 1);
    } else {
      if (r.y + r.h < -10 || r.y > VH + 10 || r.x + r.w < -10 || r.x > VW + 10) {
        items.splice(i, 1);
      }
    }
  }

  // Projectiles update + collisions avec items
  for (let si = shots.length - 1; si >= 0; si--) {
    const s = shots[si];
    s.update(dt);
    // hors écran ? (toutes directions) - ignoré pour les frites rebondissantes
    if (s.bouncy && FRITE_SHOT_LIFETIME > 0 && s.life <= 0) { shots.splice(si, 1); continue; }
    if (!s.bouncy && (s.y + s.h < -10 || s.y > VH + 10 || s.x + s.w < -10 || s.x > VW + 10)) { shots.splice(si, 1); continue; }
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
    if (hit) {
      shots.splice(si, 1);
      if (gameState !== STATE.PLAYING) return;
    }
  }
}

function playItemSound(type) {
  if (soundMode !== SOUND_MODE.SFX) return; // en mode musique ou muet, pas de SFX
  // pbtb.wav pour pizza/brocolis/burger/tacos
  if (type === "pizza" || type === "brocolis" || type === "burger" || type === "tacos") {
    playSound("pbtb", { loop: false, durationSec: null, volume: 0.7 });
    return;
  }
  if (type === "bombe") {
    // Bombe exclusive avec poulet pour éviter la superposition désagréable
    playExclusiveSfx("bombe", { loop: false, durationSec: null, volume: 0.7 });
    return;
  }
  // Pour le poulet, le son de 5 s est géré dans la collision (par joueur)
}

function emitFriteBursts(player, ownerId) {
  const count = 4;
  for (let i = 0; i < count && shots.length < MAX_SHOTS; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = FRITE_SHOT_SPEED;
    const vx = Math.cos(ang) * sp;
    const vy = Math.sin(ang) * sp;
    const w = FRITE_SHOT_W;
    const h = FRITE_SHOT_W;
    const sx = Math.round(player.x + player.w / 2 - w / 2);
    const sy = Math.round(player.y + player.h / 2 - h / 2);
    shots.push(new Projectile(ownerId, 'frite', sx, sy, w, h, vx, vy, { bouncy: true, life: FRITE_SHOT_LIFETIME }));
  }
}

function spawnItem(forceKey = null) {
  const pool = ITEM_TYPES.filter(t => !t.forceOnly);
  const def = forceKey
    ? ITEM_TYPES.find(t => t.key === forceKey)
    : (pool.length ? pool[Math.floor(Math.random() * pool.length)] : ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)]);
  if (!def) return;
  // utiliser la largeur d'affichage prévue (baseW) pour éviter spawn hors bords
  const baseW = def.baseW || ITEM_BASE_W;
  if (!spaceMode) {
    const x = Math.random() * (VW - baseW);
    items.push(new Item(def.key, x));
  } else {
    // Monde espace: spawn depuis un bord aléatoire, direction vers l'intérieur
    const edge = Math.floor(Math.random() * 4); // 0=top,1=bottom,2=left,3=right
    let x = 0, y = 0, dx = 0, dy = 0;
    switch (edge) {
      case 0: // top -> descend
        x = Math.random() * (VW - baseW);
        y = -baseW;
        dx = 0; dy = 1; break;
      case 1: // bottom -> monte
        x = Math.random() * (VW - baseW);
        y = VH + baseW;
        dx = 0; dy = -1; break;
      case 2: // left -> droite
        x = -baseW;
        y = Math.random() * (VH - baseW);
        dx = 1; dy = 0; break;
      default: // right -> gauche
        x = VW + baseW;
        y = Math.random() * (VH - baseW);
        dx = -1; dy = 0; break;
    }
    items.push(new Item(def.key, x, y, dx, dy));
  }
}

function processPickup(playerId, it) {
  const player = playerId === 1 ? p1 : p2;
  const isPoulet = it.type === 'poulet';
  const isBombe = it.type === 'bombe';
  const isFrite = it.type === 'frite';
  const isBraise = it.type === 'poulet' && ASSETS['poulet'] === ASSETS['braise']; // poulet visuel braise
  const hadKnifeMode = knifeMode; // état avant cette prise
  const other = playerId === 1 ? 2 : 1;
  const earnedPoints = (spaceMode && isPoulet) ? SPACE_STAR_POINTS : it.points;
  // Score
  if (playerId === 1) score1 += earnedPoints; else score2 += earnedPoints;
  maybeEndGameByScore();
  // Son
  if (!isPoulet && !isBombe) playItemSound(it.type);
  // Effets spéciaux
  if (isPoulet) {
    // Monde espace: l'étoile ne donne qu'un boost de vitesse temporaire
    if (spaceMode) {
      player.starBoostTime = Math.max(player.starBoostTime || 0, SPACE_STAR_DURATION);
      if (soundMode === SOUND_MODE.SFX) {
        playSound("etoile", { loop: false, volume: 0.75 });
      }
      // pas d'effet poulet: pas de freeTime, pas de déplacement centre, pas de sons dédiés
    } else {
      player.freeTime = Math.max(player.freeTime, CHICKEN_FREE_SEC);
      // Déplacement doux vers le centre (au lieu de téléportation)
      player.moveToCenterDur = 0.45;
      player.moveToCenterElapsed = 0;
      player.moveStartX = player.x;
      player.moveStartY = player.y;
      player.moveTargetX = Math.max(0, Math.round((VW - player.w) / 2));
      player.moveTargetY = Math.max(0, Math.round((VH - player.h) / 2));
      playExclusiveSfx('poulet', { loop: true, durationSec: CHICKEN_FREE_SEC, volume: 0.65 });
      player.chickenStreak = (player.chickenStreak || 0) + 1;
      if (!player.isPoule && !player.hasTransformed && player.chickenStreak >= 3 && ASSETS['rournpoule']) {
        player.isPoule = true;
        player.hasTransformed = true;
        player.imgKey = 'rournpoule';
      }
      // Mode couteau: à la première capture de poulet, remplacer le fond et le sprite poulet
      if (!knifeMode) {
        knifeMode = true;
        // basculer le fond si disponible
        if (ASSETS['fond_couteau']) {
          currentBgKey = 'fond_couteau';
        }
        // remplacer l'image du poulet par couteau pour les prochains spawns
        if (ASSETS['couteau']) {
          ASSETS['poulet'] = ASSETS['couteau'];
        }
      }
      // Étape enfer: si on attrape le poulet alors qu'il est visuellement un couteau (knifeMode déjà actif)
      else if (hadKnifeMode && !hellMode) {
        hellMode = true;
        if (ASSETS['fond_enfer']) currentBgKey = 'fond_enfer';
        if (ASSETS['braise']) ASSETS['poulet'] = ASSETS['braise'];
        if (ASSETS['rourn_enfer']) {
          p1.imgKey = 'rourn_enfer';
          p2.imgKey = 'rourn_enfer';
          p1.hasTransformed = true;
          p2.hasTransformed = true;
          p1.isPoule = false;
          p2.isPoule = false;
          // Désactiver l'overlay ailes pour garder l'apparence enfer
          p1.wingsKey = null;
          p2.wingsKey = null;
        }
      }
      // Étape espace: si on attrape la braise (poulet visuel braise)
      else if (isBraise && hellMode && !spaceMode) {
        spaceMode = true;
        if (ASSETS['fond_espace']) currentBgKey = 'fond_espace';
        if (ASSETS['etoile']) ASSETS['poulet'] = ASSETS['etoile'];
        // Retour avatars initiaux
        p1.imgKey = p1.defaultImgKey;
        p2.imgKey = p2.defaultImgKey;
        // Réactiver les ailes pour l'effet poulet
        p1.wingsKey = 'rourn1ailes';
        p2.wingsKey = 'rourn2ailes';
        p1.isPoule = false;
        p2.isPoule = false;
        p1.hasTransformed = false;
        p2.hasTransformed = false;
      }
      // en mode poule: pas de changement de taille sur poulet
    }
  }
  if (isFrite) {
    emitFriteBursts(player, playerId);
  }
  if (isBombe) {
    player.shrinkTime = Math.max(player.shrinkTime, BOMB_SHRINK_SEC);
    playExclusiveSfx('bombe', { loop: false, durationSec: null, volume: 0.7 });
    player.chickenStreak = 0;
    // Si effet poulet actif, annule immédiatement pour redevenir normal
    player.freeTime = 0;
    player.moveToCenterElapsed = player.moveToCenterDur;
  }
  if (!isPoulet && !isBombe) {
    player.chickenStreak = 0;
    if (player.isPoule) {
      player.baseScale = Math.min(POULE_MAX_SCALE, player.baseScale * (1 + POULE_GROWTH_STEP));
    }
  }
  // Historique & stats
  if (playerId === 1) {
    feed1.unshift(it.type); if (feed1.length > FEED_MAX) feed1.length = FEED_MAX;
    if (stats1 && it.type in stats1) stats1[it.type]++;
    maybeTransformPlayer(p1, stats1, it.type);
  } else {
    feed2.unshift(it.type); if (feed2.length > FEED_MAX) feed2.length = FEED_MAX;
    if (stats2 && it.type in stats2) stats2[it.type]++;
    maybeTransformPlayer(p2, stats2, it.type);
  }
}

function render() {
  // Préparer le contexte pour l'espace virtuel
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

  // Fond (couvre l'espace virtuel 16:9)
  const bg = ASSETS[currentBgKey] || ASSETS["fond"]; // fond courant avec fallback
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

  // Projectiles
  for (const s of shots) s.draw(ctx);

  // Joueurs
  if (p1) p1.draw(ctx);
  if (p2) p2.draw(ctx);

  // HUD (scores + timer)
  drawHUD();

  // Overlays (menu, pause, game over)
  if (!assetsLoaded) drawLoadingOverlay();
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

  ctx.restore();
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

  // Erreurs en bas
  ctx.textAlign = "left";
  ctx.font = "14px monospace";
  ctx.fillStyle = "#fca5a5";
  const pad = 16;
  let y = VH - 140;
  ctx.fillText("Erreurs de chargement (placeholders):", pad, y);
  y += 20;
  if (assetLoad.errors && assetLoad.errors.length) {
    const maxLines = 5;
    for (let i=0; i<Math.min(maxLines, assetLoad.errors.length); i++) {
      ctx.fillText(`- ${assetLoad.errors[i]}`, pad, y);
      y += 18;
    }
    if (assetLoad.errors.length > maxLines) {
      ctx.fillText(`... (+${assetLoad.errors.length - maxLines} autres)`, pad, y);
    }
  } else {
    ctx.fillStyle = "#94e2b9";
    ctx.fillText("Aucune erreur détectée", pad, y);
  }
  ctx.restore();
}

function drawMenu() {
  const modeLabel = soundMode === SOUND_MODE.SFX ? "SFX" : (soundMode === SOUND_MODE.MUSIC ? "Musique" : "Muet");
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
    { key: 'frite', text: "+0 • Libère 4 mini-frites rebondissantes" },
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
    if (keys[" "] || keys["Spacebar"]) { // Espace
      keys[" "] = keys["Spacebar"] = false; // consommer
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

  handleToggles();
  update(dt);
  render();
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
}
// Démarrage immédiat sans interaction
try {
  started = true;
  init();
  preloadAssets().catch((e)=>console.error('IMG PRELOAD ERR', e));
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
