// Global tuning values. Change numbers here, not in the scene code.
const CONFIG = {
  TILE: 32,             // world pixels per map tile
  DENSITY: 2,           // object art is drawn at 2x for sharper detail
  VIEW_HEIGHT: 400,     // world pixels visible top to bottom (camera zoom is derived from this)
  DESIGN_W: 960,        // menu and HUD layouts are designed on a 960x540 canvas, then scaled to fit
  DESIGN_H: 540,

  // Player movement (world pixels per second)
  SNEAK: 52,
  WALK: 100,
  RUN: 168,
  ACTOR_SCALE: 0.5,     // character frames are 96px tall, shown about 48 world px tall

  // Stamina
  STAMINA_MAX: 100,
  STAMINA_DRAIN: 30,    // per second while running
  STAMINA_REGEN: 22,    // per second while not running
  STAMINA_DELAY: 0.7,   // seconds after running before regen starts
  STAMINA_MIN_RUN: 14,  // after hitting zero you must recover this much before running again

  // Round rules
  HEARTS: 3,
  COUNTDOWN: 9,         // seconds Taya counts at base before hunting
  CATCH_RADIUS: 19,
  INVULN: 2.2,          // seconds of safety after being caught
  HIDE_RANGE: 42,       // how close you must be to a hiding spot to use it
  BASE_RANGE: 54,       // how close you must be to base to shout "Save!"
  BASE_SAFE_DIST: 170,  // Taya must be farther than this from base for Save to count
  SEARCH_TIME: 1.5,     // seconds Taya stands at a spot before checking it
  SPOT_COOLDOWN: 24,    // seconds before Taya re-checks the same spot

  // Collision box of an actor's feet (half sizes)
  BODY_HW: 7,
  BODY_HH: 5
};

// Taya (seeker) settings per difficulty.
//   patrol/chase  movement speeds
//   vision/fov    sight range in px and cone width in degrees
//   react         seconds of seeing you before it commits to a chase
//   lose          seconds it keeps chasing after losing line of sight
//   find          multiplier on each hiding spot's chance to find you
//   hearRun/hearWalk  noise radius multipliers
//   hiders        number of AI hiders besides you
//   time          round length in seconds
const DIFFICULTY = {
  easy:   { id: 'easy',   label: 'Madali',      patrol: 62, chase: 112, vision: 150, fov: 84,  react: 0.75, lose: 0.6, find: 0.65, hearRun: 0.7, hearWalk: 0.0, hiders: 4, time: 150, stun: 2.8 },
  normal: { id: 'normal', label: 'Katamtaman',  patrol: 72, chase: 126, vision: 175, fov: 96,  react: 0.5,  lose: 1.0, find: 1.0,  hearRun: 1.0, hearWalk: 0.6, hiders: 5, time: 165, stun: 2.4 },
  hard:   { id: 'hard',   label: 'Mahirap',     patrol: 82, chase: 140, vision: 200, fov: 108, react: 0.3,  lose: 1.5, find: 1.3,  hearRun: 1.25, hearWalk: 1.0, hiders: 7, time: 180, stun: 2.0 }
};
const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

// Chance that one search of a hiding spot finds someone inside (before the difficulty multiplier).
const SPOT_TYPES = {
  bush:   { label: 'Halaman',  find: 0.50 },
  saging: { label: 'Saging',   find: 0.45 },
  barrel: { label: 'Drum',     find: 0.35 },
  crates: { label: 'Kahon',    find: 0.50 },
  sako:   { label: 'Sako',     find: 0.40 },
  tire:   { label: 'Gulong',   find: 0.50 }
};

const NPC_NAMES = ['Mina', 'Jun', 'Bea', 'Totoy', 'Pepe', 'Lisa', 'Ramon', 'Dindo', 'Aling Nena', 'Kuya Ben'];

// Cosmetics. Hoodie colours are free. Accessories unlock with total stars.
const HOODIES = [
  { id: 'blue',   label: 'Asul',     hue: null, css: '#2f6fe0' },
  { id: 'pink',   label: 'Rosas',    hue: 330,  css: '#e0509a' },
  { id: 'green',  label: 'Berde',    hue: 135,  css: '#37b24d' },
  { id: 'yellow', label: 'Dilaw',    hue: 48,   css: '#f2c230', light: 0.06 },
  { id: 'orange', label: 'Kahel',    hue: 24,   css: '#f08c2a' },
  { id: 'red',    label: 'Pula',     hue: 355,  css: '#e03131' },
  { id: 'purple', label: 'Lila',     hue: 275,  css: '#9c4ddb' },
  { id: 'white',  label: 'Puti',     hue: null, desat: true, css: '#e8ecf5' }
];

const ACCESSORIES = [
  { id: 'none',      label: 'Wala',       stars: 0 },
  { id: 'salakot',   label: 'Salakot',    stars: 0 },
  { id: 'cap',       label: 'Cap',        stars: 2 },
  { id: 'headphones', label: 'Headphones', stars: 4 },
  { id: 'crown',     label: 'Korona',     stars: 8 }
];
