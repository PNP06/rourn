"use strict";

// Jeu 2D HTML5 Canvas – Rourn Duo Catch
// - Aucune librairie externe, fonctionne en ouvrant index.html
// - Espace virtuel: 1280x720 (16:9). L'affichage est mis à l'échelle.
// - Contrôles: J1 = ZQSD, J2 = Flèches. P = Pause, Espace = Démarrer, R = Rejouer, Échap = Menu, M = Son.

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
const TACO_SHOT_INTERVAL = 3.0; // tir auto toutes les ~3 s
const TACO_SHOT_SPEED = 180;    // vitesse des projectiles tacos/burger (px/s)
const MAX_SHOTS = 24;           // sécurité de projectiles simultanés
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
    const candidates = [src];
    if (src.startsWith("assets/")) {
      candidates.push("asset/" + src.slice("assets/".length));
    }
    attempt(candidates);
  });
}

// Liste des assets attendus dans le même dossier que index.html
const ASSET_LIST = [
  { key: "fond", file: "assets/fond.png", color: "#1b2a41" },
  { key: "rourn1", file: "assets/rourn1.png", color: "#4461cf" },
  { key: "rourn2", file: "assets/rourn2.png", color: "#cf4444" },
  // Transformations visuelles des joueurs
  { key: "rourntacos", file: "assets/rourntacos.png", color: "#b56576" },
  { key: "rournpizza", file: "assets/rournpizza.png", color: "#d4a373" },
  { key: "rournbrocolis", file: "assets/rournbrocolis.png", color: "#5aa469" },
  { key: "rournburger", file: "assets/rournburger.png", color: "#c9a227" },
  { key: "tacostomato", file: "assets/tacostomato.png", color: "#c0392b" },
  { key: "tacossalad", file: "assets/tacossalad.png", color: "#27ae60" },
  { key: "rournpoule", file: "assets/rournpoule.png", color: "#deb887" },
  { key: "pizza", file: "assets/pizza.png", color: "#d4a373" },
  { key: "burger", file: "assets/burger.png", color: "#c9a227" },
  { key: "tacos", file: "assets/tacos.png", color: "#b56576" },
  { key: "brocolis", file: "assets/brocolis.png", color: "#5aa469" },
  { key: "poulet", file: "assets/poulet.png", color: "#ce9461" },
  { key: "bombe", file: "assets/bombe.png", color: "#555" },
];

const ASSETS = Object.create(null); // key -> CanvasImageSource
let assetsLoaded = false;

function preloadAssets() {
  const promises = ASSET_LIST.map(({ key, file, color }) =>
    loadImage(key, file, color).then((img) => {
      ASSETS[key] = img;
    })
  );
  return Promise.all(promises).then(() => {
    assetsLoaded = true;
  });
}

// ---------------------------------
// Audio fichiers (sound2/*.wav) + musique (sound3banana/*.mp3) + modes
// ---------------------------------
const SOUND_MODE = { SFX: "sfx", MUSIC: "music", MUTE: "mute" };
let soundMode = SOUND_MODE.SFX; // sélection utilisateur (menu): SFX (défaut), MUSIC, MUTE
let audioEnabled = true;       // dérivé de soundMode != MUTE
let audioPreloaded = false;    // évite de bloquer le chargement initial
const AUDIO_LIST = [
  { key: "pbtb", file: "assets/sound2/pbtb.wav" },
  { key: "bombe", file: "assets/sound2/bombe.wav" },
  { key: "poulet", file: "assets/sound2/poulet.wav" },
  { key: "banana", file: "assets/sound3banana/chickenbanana.mp3" },
  { key: "fartprout", file: "assets/fartprout.mp3" },
];
const AUDIO = Object.create(null); // key -> HTMLAudioElement (source)
const activeSounds = new Set();

function loadAudio(key, src) {
  // Ne pas bloquer la page sur le chargement audio
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "none";
    a.src = src;
    resolve(a);
  });
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
  const src = AUDIO[key];
  if (!src) return null;
  const a = src.cloneNode(true);
  a.loop = loop;
  a.volume = volume;
  const handle = {
    stop() {
      try { a.pause(); a.currentTime = 0; } catch (_) {}
      if (timer) clearTimeout(timer);
      activeSounds.delete(handle);
    }
  };
  let timer = null;
  a.play().catch(() => {});
  if (durationSec && durationSec > 0) {
    timer = setTimeout(() => handle.stop(), Math.floor(durationSec * 1000));
  }
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
// Input clavier (keydown/keyup)
// -----------------------------
const keys = Object.create(null); // état des touches pressées

const PREVENT_KEYS = new Set([
  "ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","Spacebar",
  "PageUp","PageDown","Home","End",
  // On ajoute nos touches de jeu pour éviter des effets de scroll sur certains OS
  "z","q","s","d","Z","Q","S","D","p","P","r","R","m","M","Escape"
]);

function onKeyDown(e) {
  const key = e.key;
  if (PREVENT_KEYS.has(key)) e.preventDefault();
  if (e.repeat) return; // éviter répétition auto pour les toggles
  keys[key] = true;
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
    this.tacoTimer = 0;       // accumulateur pour tirs auto (tacos)
    this.tacoNextSalad = true;// alterne salade/tomate
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
    // Ajuster la vitesse selon transformation (brocolis +25%)
    let sp = this.speed;
    const tf = getPlayerTransform(this);
    if (tf === "brocolis") sp *= 1.25;
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
    const img = this.img;
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
  { key: "bombe",    points: -5, baseSpeed: 220, baseW: 56 }, // piège
];

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
    const vy = this.baseSpeed * this.variation * speedMult;
    this.y += vy * dt;
  }
  draw(g) {
    const img = this.img;
    if (img) g.drawImage(img, this.x, this.y, this.w, this.h);
  }
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
    return ASSETS[this.kind === 'salad' ? 'tacossalad' : 'tacostomato'];
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
let elapsed = 0;                // temps écoulé depuis start
let lastDiffStep = 0;           // paliers appliqués
let feed1 = []; // derniers items pris par J1 (types)
let feed2 = []; // derniers items pris par J2 (types)
let stats1 = null; // compteur par type pour J1
let stats2 = null; // compteur par type pour J2
const ALL_ITEM_KEYS = ITEM_TYPES.map(t => t.key);

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
  elapsed = 0;
  lastDiffStep = 0;
  feed1 = [];
  feed2 = [];
  stats1 = makeEmptyStats();
  stats2 = makeEmptyStats();
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
  // Décrémenter les timers
  p1.freeTime = Math.max(0, p1.freeTime - dt);
  p2.freeTime = Math.max(0, p2.freeTime - dt);
  p1.shrinkTime = Math.max(0, p1.shrinkTime - dt);
  p2.shrinkTime = Math.max(0, p2.shrinkTime - dt);

  // En mode normal (pas poulet): par défaut horizontal uniquement.
  // Spécial pizza: gauche/droite contrôlent le déplacement le long du bord (périmètre).
  const p1IsPizza = getPlayerTransform(p1) === 'pizza';
  const p2IsPizza = getPlayerTransform(p2) === 'pizza';

  let s1 = 0, s2 = 0;
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

  [dx1, dy1] = normalize(dx1, dy1);
  [dx2, dy2] = normalize(dx2, dy2);

  p1.update(dx1, dy1, dt);
  p2.update(dx2, dy2, dt);

  // Tacos: tirs automatiques alternés salade/tomate
  function tryShootFor(player, id) {
    const tf = getPlayerTransform(player);
    if (tf !== 'tacos' && tf !== 'burger') return;
    player.tacoTimer += dt;
    if (player.tacoTimer >= TACO_SHOT_INTERVAL && shots.length < MAX_SHOTS) {
      player.tacoTimer -= TACO_SHOT_INTERVAL;
      const useSalad = player.tacoNextSalad;
      player.tacoNextSalad = !player.tacoNextSalad;
      const projImg = ASSETS[useSalad ? 'tacossalad' : 'tacostomato'];
      const pw = Math.max(4, Math.round(player.w / 3));
      let ph = pw;
      if (projImg && projImg.width && projImg.height) ph = Math.max(4, Math.round(pw * (projImg.height / projImg.width)));
      let sx, sy, vx, vy;
      if (tf === 'tacos') {
        // tirs vers le haut
        sx = Math.round(player.x + player.w / 2 - pw / 2);
        sy = Math.round(player.y - ph + 4);
        vx = 0; vy = -TACO_SHOT_SPEED;
      } else {
        // burger: tomate → droite, salade → gauche
        sy = Math.round(player.y + player.h / 2 - ph / 2);
        if (useSalad) {
          sx = Math.round(player.x - pw + 4); vx = -TACO_SHOT_SPEED; vy = 0;
        } else {
          sx = Math.round(player.x + player.w - 4); vx = TACO_SHOT_SPEED; vy = 0;
        }
      }
      shots.push(new Projectile(id, useSalad ? 'salad' : 'tomato', sx, sy, pw, ph, vx, vy));
      // Son de tir (SFX uniquement)
      if (soundMode === SOUND_MODE.SFX) {
        playSound('fartprout', { loop: false, durationSec: null, volume: 0.6 });
      }
    }
  }

  tryShootFor(p1, 1);
  tryShootFor(p2, 2);

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

  // Tacos: sautille (appliquer un offset vertical au repos de baseline)
  // tf1/tf2 déjà calculés ci-dessus
  if (p1.freeTime <= 0 && tf1 === "tacos") {
    const hop = Math.max(0, Math.sin(p1.hopPhase)) * HOP_AMP;
    p1.y = p1.baselineY - Math.round(hop);
  }
  if (p2.freeTime <= 0 && tf2 === "tacos") {
    const hop = Math.max(0, Math.sin(p2.hopPhase)) * HOP_AMP;
    p2.y = p2.baselineY - Math.round(hop);
  }

  // Spawns
  if (items.length < MAX_ITEMS) {
    spawnAcc += dt * spawnRate;
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
    if (intersects(p1.rect(), r)) { processPickup(1, it); items.splice(i, 1); continue; }
    // Attrapé par J2 ? (burger: plus de zone élargie, on utilise juste la taille accrue)
    if (intersects(p2.rect(), r)) { processPickup(2, it); items.splice(i, 1); continue; }
    // Sorti de l'écran ? (pas de pénalité)
    if (it.y > VH + 10) {
      items.splice(i, 1);
    }
  }

  // Projectiles update + collisions avec items
  for (let si = shots.length - 1; si >= 0; si--) {
    const s = shots[si];
    s.update(dt);
    // hors écran ?
    if (s.y + s.h < -10) { shots.splice(si, 1); continue; }
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

function spawnItem() {
  const def = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
  const w = Math.max(1, (ASSETS[def.key]?.width) || ITEM_BASE_W);
  // utiliser la largeur d'affichage prévue (baseW) pour éviter spawn hors bords
  const baseW = def.baseW || ITEM_BASE_W;
  const x = Math.random() * (VW - baseW);
  items.push(new Item(def.key, x));
}

function processPickup(playerId, it) {
  const player = playerId === 1 ? p1 : p2;
  const isPoulet = it.type === 'poulet';
  const isBombe = it.type === 'bombe';
  const other = playerId === 1 ? 2 : 1;
  // Score
  if (playerId === 1) score1 += it.points; else score2 += it.points;
  // Son
  if (!isPoulet && !isBombe) playItemSound(it.type);
  // Effets spéciaux
  if (isPoulet) {
    player.freeTime = Math.max(player.freeTime, CHICKEN_FREE_SEC);
    player.x = Math.max(0, Math.round((VW - player.w) / 2));
    player.y = Math.max(0, Math.round((VH - player.h) / 2));
    playExclusiveSfx('poulet', { loop: true, durationSec: CHICKEN_FREE_SEC, volume: 0.65 });
    player.chickenStreak = (player.chickenStreak || 0) + 1;
    if (!player.isPoule && !player.hasTransformed && player.chickenStreak >= 3 && ASSETS['rournpoule']) {
      player.isPoule = true;
      player.hasTransformed = true;
      player.imgKey = 'rournpoule';
    }
    // en mode poule: pas de changement de taille sur poulet
  }
  if (isBombe) {
    player.shrinkTime = Math.max(player.shrinkTime, BOMB_SHRINK_SEC);
    playExclusiveSfx('bombe', { loop: false, durationSec: null, volume: 0.7 });
    player.chickenStreak = 0;
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
  const bg = ASSETS["fond"];
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
  if (!assetsLoaded) drawLoading();
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

  // Indicateur audio discret (coin bas-gauche)
  ctx.textAlign = "left";
  ctx.font = "16px Arial";
  ctx.fillStyle = "#cbd5e1";
  const modeLabel = soundMode === SOUND_MODE.SFX ? "SFX" : (soundMode === SOUND_MODE.MUSIC ? "Musique" : "Muet");
  ctx.fillText(`M: Mode son = ${modeLabel}`, 12, VH - 26);

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

function drawMenu() {
  const modeLabel = soundMode === SOUND_MODE.SFX ? "SFX" : (soundMode === SOUND_MODE.MUSIC ? "Musique" : "Muet");
  drawCenteredText([
    "RouRn game",
    "The first Pollito Nene game.",
    "Objectif: attraper le plus de nourriture.",
    "Astuce: 10× le même aliment = pouvoirs.",
    "J1: ZQSD • J2: Flèches",
    "Espace: Démarrer • P: Pause",
    `Son: [1] SFX • [2] Musique • [3] Muet (Actuel: ${modeLabel})`,
    "M: basculer rapidement le mode son",
  ]);
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
    const iw = iconW;
    const ih = img && img.width && img.height ? Math.round(iw * (img.height / img.width)) : iw;
    if (img) ctx.drawImage(img, xL, y - Math.floor(ih / 2), iw, ih);
    else { ctx.fillRect(xL, y - Math.floor(iw/2), iw, iw); }
    ctx.fillText(`x${count}`, xL + iw + 8, y);
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
    const iw = iconW;
    const ih = img && img.width && img.height ? Math.round(iw * (img.height / img.width)) : iw;
    // Icône alignée à droite
    if (img) ctx.drawImage(img, xR - iw, y - Math.floor(ih / 2), iw, ih);
    else { ctx.fillRect(xR - iw, y - Math.floor(iw/2), iw, iw); }
    ctx.fillText(`x${count}`, xR - iw - 8, y);
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

// Charger d'abord les images pour afficher vite l'UI, l'audio en arrière-plan
preloadAssets().then(() => {
  init();
  setTimeout(() => { preloadAudio(); }, 0);
});

// Notes d'implémentation (visibles en lecture du code):
// - Espace virtuel 1280x720 (16:9); le canvas est mis à l'échelle via renderScale.
// - AABB basique via intersects(a,b) avec petites marges (COLLISION_PAD).
// - ITEM_TYPES centralise points et vitesses; ajustable facilement.
// - Difficulté: toutes les 20 s, spawnRate += 0.15 et fallSpeed *= 1.05 (avec caps).
// - Ordre de dessin: fond → items → joueurs → HUD/overlays.
