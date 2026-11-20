// Map objects: houses, trees, hiding spots, vehicles. Each one is painted with canvas rectangles and discs
// at 2x density (64px per tile). The catalog says how big an object is, which tiles are solid or block
// sight, and whether it is a hiding spot.
//
//  w, h      texture size in tiles
//  ax, ay    which texture tile sits on the placement tile (placement tile = bottom-left of the footprint)
//  solid     tile offsets (dx, dy) from the placement tile that nobody can walk through
//  opaque    tile offsets that block line of sight
//  hide      key of SPOT_TYPES when the object is a hiding spot
//  fade      tall art: becomes see-through when a character walks behind it
//  variants  how many colour variants paint() supports
const OBJ_T = 64;

function cellsRect(w, h) {
  const out = [];
  for (let dy = -(h - 1); dy <= 0; dy++) for (let dx = 0; dx < w; dx++) out.push([dx, dy]);
  return out;
}

const OBJECTS = {
  tree:      { w: 3, h: 3, ax: 1, ay: 2, solid: [[0, 0]], opaque: [], fade: true, variants: 2, paint: paintTree },
  palm:      { w: 3, h: 4, ax: 1, ay: 3, solid: [[0, 0]], opaque: [], fade: true, variants: 1, paint: paintPalm },
  bush:      { w: 1, h: 1, ax: 0, ay: 0, solid: [[0, 0]], opaque: [], hide: 'bush', variants: 3, paint: paintBush },
  saging:    { w: 3, h: 2, ax: 1, ay: 1, solid: [[0, 0]], opaque: [], hide: 'saging', fade: true, variants: 1, paint: paintSaging },
  barrel:    { w: 1, h: 1, ax: 0, ay: 0, solid: [[0, 0]], opaque: [], hide: 'barrel', variants: 2, paint: paintBarrel },
  crates:    { w: 1, h: 1, ax: 0, ay: 0, solid: [[0, 0]], opaque: [], hide: 'crates', variants: 1, paint: paintCrates },
  sako:      { w: 1, h: 1, ax: 0, ay: 0, solid: [[0, 0]], opaque: [], hide: 'sako', variants: 1, paint: paintSako },
  tire:      { w: 1, h: 1, ax: 0, ay: 0, solid: [[0, 0]], opaque: [], hide: 'tire', variants: 3, paint: paintTire },
  bench:     { w: 2, h: 1, ax: 0, ay: 0, solid: cellsRect(2, 1), opaque: [], variants: 1, paint: paintBench },
  lamp:      { w: 1, h: 2, ax: 0, ay: 1, solid: [[0, 0]], opaque: [], variants: 1, paint: paintLamp },
  fenceH:    { w: 1, h: 1, ax: 0, ay: 0, solid: [[0, 0]], opaque: [], variants: 1, paint: paintFenceH },
  fenceV:    { w: 1, h: 1, ax: 0, ay: 0, solid: [[0, 0]], opaque: [], variants: 1, paint: paintFenceV },
  house:     { w: 6, h: 4, ax: 0, ay: 3, solid: cellsRect(6, 4), opaque: cellsRect(6, 4), variants: 5, paint: paintHouse },
  kubo:      { w: 4, h: 4, ax: 0, ay: 3, solid: cellsRect(4, 4), opaque: cellsRect(4, 4), variants: 1, paint: paintKubo },
  school:    { w: 10, h: 5, ax: 0, ay: 4, solid: cellsRect(10, 5), opaque: cellsRect(10, 5), variants: 1, paint: paintSchool },
  stall:     { w: 3, h: 2, ax: 0, ay: 1, solid: cellsRect(3, 2), opaque: cellsRect(3, 2), variants: 3, paint: paintStall },
  jeepney:   { w: 5, h: 2, ax: 0, ay: 1, solid: cellsRect(5, 2), opaque: cellsRect(5, 2), variants: 3, paint: paintJeepney },
  tricycle:  { w: 3, h: 2, ax: 0, ay: 1, solid: cellsRect(3, 2), opaque: [], variants: 3, paint: paintTricycle },
  hoop:      { w: 1, h: 2, ax: 0, ay: 1, solid: [[0, 0]], opaque: [], variants: 1, paint: paintHoop },
  flag:      { w: 1, h: 3, ax: 0, ay: 2, solid: [[0, 0]], opaque: [], variants: 1, paint: paintFlag },
  swing:     { w: 3, h: 2, ax: 0, ay: 1, solid: cellsRect(3, 2), opaque: [], variants: 1, paint: paintSwing },
  bleacher:  { w: 4, h: 2, ax: 0, ay: 1, solid: cellsRect(4, 2), opaque: [], variants: 1, paint: paintBleacher }
};

const Objects = {
  cache: {},
  // Returns a canvas with the object painted on it.
  canvas(type, v) {
    const key = type + ':' + v;
    if (Objects.cache[key]) return Objects.cache[key];
    const def = OBJECTS[type];
    const c = PX.canvas(def.w * OBJ_T, def.h * OBJ_T);
    const ctx = c.getContext('2d');
    def.paint(ctx, c.width, c.height, v || 0, U.rng(77 + type.length * 13 + (v || 0)));
    Objects.cache[key] = c;
    return c;
  }
};

// ------------------------------------------------------------------ trees and plants
function blobCluster(ctx, blobs, cols, rnd, opts) {
  const o = PX.OUT;
  blobs.forEach(([x, y, r]) => PX.disc(ctx, x, y, r + 3, o));
  blobs.forEach(([x, y, r]) => PX.disc(ctx, x, y, r, cols[0]));
  blobs.forEach(([x, y, r]) => { if (r > 14) PX.disc(ctx, x - 3, y - 5, r - 8, cols[1]); });
  blobs.forEach(([x, y, r]) => { if (r > 22) PX.disc(ctx, x - 7, y - 11, r - 20, cols[2]); });
  for (let i = 0; i < (opts && opts.leaves || 26); i++) {
    const b = blobs[Math.floor(rnd() * blobs.length)];
    const a = rnd() * Math.PI * 2, d = rnd() * b[2] * 0.8;
    PX.r(ctx, b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d, 4, 3, rnd() < 0.5 ? cols[0] : cols[3]);
  }
}

function paintTree(ctx, W, H, v, rnd) {
  PX.shadow(ctx, 96, 182, 46, 9, 0.3);
  PX.r(ctx, 82, 114, 28, 70, PX.OUT);
  PX.r(ctx, 85, 114, 22, 68, '#7a4e2a');
  PX.r(ctx, 85, 114, 8, 68, '#93633a');
  PX.r(ctx, 101, 114, 6, 68, '#5e3a1d');
  PX.r(ctx, 76, 176, 12, 8, PX.OUT); PX.r(ctx, 78, 176, 9, 6, '#7a4e2a');
  PX.r(ctx, 104, 176, 12, 8, PX.OUT); PX.r(ctx, 105, 176, 9, 6, '#5e3a1d');
  const cols = v === 1 ? ['#245c2d', '#2f7a3a', '#419d4a', '#65bf5c'] : ['#1f5a2e', '#2c7a3a', '#3a9446', '#5bb55a'];
  blobCluster(ctx, [[96, 100, 58], [60, 92, 38], [132, 92, 38], [96, 62, 44], [68, 62, 28], [126, 62, 28]], cols, rnd);
  if (v === 1) for (let i = 0; i < 9; i++) PX.discO(ctx, 52 + rnd() * 88, 64 + rnd() * 70, 3, '#f5a623', '#a8650a');
}

function paintPalm(ctx, W, H, v, rnd) {
  PX.shadow(ctx, 96, 246, 34, 8, 0.3);
  // curved trunk built from short segments
  for (let y = 248; y > 92; y -= 4) {
    const t = (248 - y) / 156;
    const x = 94 + Math.sin(t * 1.1) * 16;
    const w = 14 - t * 5;
    PX.r(ctx, x - w / 2 - 2, y, w + 4, 6, PX.OUT);
  }
  for (let y = 248; y > 92; y -= 4) {
    const t = (248 - y) / 156;
    const x = 94 + Math.sin(t * 1.1) * 16;
    const w = 14 - t * 5;
    PX.r(ctx, x - w / 2, y, w, 5, Math.floor(y / 12) % 2 ? '#8a5a32' : '#9c6a3c');
    PX.r(ctx, x - w / 2, y, 3, 5, '#b07e4c');
  }
  const cx = 94 + Math.sin(1.1) * 16, cy = 94;
  const frond = (ang, len, droop) => {
    const pts = [], pts2 = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const w = 15 * (1 - t) + 2;
      const px = cx + Math.cos(ang) * len * t;
      const py = cy + Math.sin(ang) * len * t + droop * t * t * len;
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      pts.push([px + nx * w, py + ny * w]);
      pts2.push([px - nx * w, py - ny * w]);
    }
    const poly = pts.concat(pts2.reverse());
    PX.poly(ctx, poly, '#2f9a4a', PX.OUT);
    const mid = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; mid.push([cx + Math.cos(ang) * len * t, cy + Math.sin(ang) * len * t + droop * t * t * len]); }
    ctx.strokeStyle = '#7fd36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mid[0][0], mid[0][1]);
    mid.forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke();
  };
  [[Math.PI * 1.08, 82, 0.55], [Math.PI * 1.92, 82, 0.55], [Math.PI * 1.25, 78, 0.3], [Math.PI * 1.75, 78, 0.3],
   [Math.PI * 1.5, 70, 0.1], [Math.PI * 0.95, 66, 0.9], [Math.PI * 0.05, 66, 0.9]].forEach(f => frond(f[0], f[1], f[2]));
  PX.discO(ctx, cx - 6, cy + 6, 6, '#6b4a2a'); PX.discO(ctx, cx + 6, cy + 8, 6, '#5a3d22'); PX.discO(ctx, cx, cy + 12, 6, '#7a5632');
}

function paintBush(ctx, W, H, v, rnd) {
  PX.shadow(ctx, 32, 57, 24, 5, 0.3);
  const cols = ['#2c7d38', '#3a9a46', '#5fba5f', '#7fd37a'];
  blobCluster(ctx, [[19, 41, 14], [45, 41, 14], [32, 31, 17], [32, 46, 12]], cols, rnd, { leaves: 14 });
  if (v === 1) for (let i = 0; i < 7; i++) { const x = 14 + rnd() * 36, y = 24 + rnd() * 26; PX.disc(ctx, x, y, 3, '#e63946'); PX.disc(ctx, x, y, 1, '#ffd84a'); }
  if (v === 2) for (let i = 0; i < 8; i++) { const x = 14 + rnd() * 36, y = 24 + rnd() * 26; PX.disc(ctx, x, y, 2, '#ffd84a'); PX.disc(ctx, x - 1, y - 1, 1, '#fff6b0'); }
}

function paintSaging(ctx, W, H, v, rnd) {
  PX.shadow(ctx, 96, 120, 30, 6, 0.3);
  // pseudo-stem
  PX.r(ctx, 87, 58, 20, 64, PX.OUT);
  PX.r(ctx, 90, 58, 14, 62, '#a9bf6b');
  PX.r(ctx, 90, 58, 5, 62, '#c4d88a');
  PX.r(ctx, 99, 58, 5, 62, '#8aa150');
  const leaf = (ang, len, wid, droop) => {
    const L = [], R = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const w = wid * Math.sin(Math.PI * (0.12 + t * 0.88));
      const px = 96 + Math.cos(ang) * len * t;
      const py = 62 + Math.sin(ang) * len * t + droop * t * t * len;
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      L.push([px + nx * w, py + ny * w]); R.push([px - nx * w, py - ny * w]);
    }
    PX.poly(ctx, L.concat(R.reverse()), '#3f9d47', PX.OUT);
    ctx.strokeStyle = '#8fd16a'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const t = i / 10; const px = 96 + Math.cos(ang) * len * t; const py = 62 + Math.sin(ang) * len * t + droop * t * t * len; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  };
  [[Math.PI * 1.0, 84, 14, 0.5], [Math.PI * 0.0, 84, 14, 0.5], [Math.PI * 1.2, 80, 13, 0.25], [Math.PI * 1.8, 80, 13, 0.25], [Math.PI * 1.5, 56, 11, 0.05], [Math.PI * 0.9, 60, 11, 0.7]].forEach(l => leaf(l[0], l[1], l[2], l[3]));
  // banana bunch and flower
  for (let i = 0; i < 5; i++) PX.r(ctx, 106 + i * 3, 74 + i * 5, 6, 12, i % 2 ? '#f2d43d' : '#e7c82e');
  PX.discO(ctx, 112, 100, 6, '#8e3b6b');
}

// ------------------------------------------------------------------ hiding spots
function paintBarrel(ctx, W, H, v) {
  const body = v === 1 ? '#b4572e' : '#2f6fd0';
  PX.shadow(ctx, 32, 57, 18, 4, 0.3);
  PX.r(ctx, 14, 17, 36, 41, PX.OUT);
  PX.r(ctx, 16, 18, 32, 38, body);
  PX.r(ctx, 16, 18, 6, 38, PX.shade(body, 1.3));
  PX.r(ctx, 42, 18, 6, 38, PX.shade(body, 0.7));
  PX.r(ctx, 16, 30, 32, 3, PX.shade(body, 0.62));
  PX.r(ctx, 16, 44, 32, 3, PX.shade(body, 0.62));
  PX.ellipseO(ctx, 32, 18, 16, 6, PX.shade(body, 1.15));
  PX.ellipse(ctx, 32, 18, 10, 3, PX.shade(body, 0.7));
  PX.r(ctx, 16, 54, 32, 3, PX.shade(body, 0.55));
}

function paintCrates(ctx, W, H) {
  PX.shadow(ctx, 32, 58, 28, 4, 0.3);
  const crate = (x, y, w, h) => {
    PX.r(ctx, x - 2, y - 2, w + 4, h + 4, PX.OUT);
    PX.r(ctx, x, y, w, h, '#b07a3f');
    PX.r(ctx, x, y, w, 3, '#cf9a58');
    PX.r(ctx, x, y + h - 3, w, 3, '#7e5328');
    for (let i = 1; i < 4; i++) PX.r(ctx, x, y + (h * i) / 4, w, 1, '#8c5d2d');
    ctx.strokeStyle = '#7e5328'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + w - 2, y + h - 2); ctx.stroke();
    PX.r(ctx, x + 2, y + 2, 3, h - 4, '#7e5328'); PX.r(ctx, x + w - 5, y + 2, 3, h - 4, '#7e5328');
  };
  crate(6, 34, 25, 22); crate(33, 34, 25, 22); crate(18, 12, 28, 22);
}

function paintSako(ctx, W, H) {
  PX.shadow(ctx, 32, 58, 26, 4, 0.3);
  const sack = (cx, cy, rx, ry) => {
    PX.ellipseO(ctx, cx, cy, rx, ry, '#d8c08a');
    PX.ellipse(ctx, cx - 4, cy - 3, rx - 6, ry - 6, '#e6d3a0');
    PX.r(ctx, cx - 4, cy - ry - 5, 8, 7, PX.OUT); PX.r(ctx, cx - 3, cy - ry - 4, 6, 6, '#b89d63');
    ctx.strokeStyle = '#b89d63'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - rx + 6, cy + 2); ctx.lineTo(cx + rx - 6, cy + 2); ctx.stroke();
  };
  sack(18, 46, 14, 11); sack(46, 46, 14, 11); sack(32, 30, 14, 11);
}

function paintTire(ctx, W, H, v) {
  const paint = ['#e03131', '#fcc419', '#339af0'][v % 3];
  PX.shadow(ctx, 32, 56, 20, 4, 0.3);
  PX.discO(ctx, 32, 38, 19, '#2a2a34');
  PX.disc(ctx, 32, 38, 14, '#1d1d25');
  PX.disc(ctx, 32, 38, 7, '#0f0f14');
  PX.disc(ctx, 27, 33, 3, '#4b4b58');
  ctx.strokeStyle = paint; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(32, 38, 16.5, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  PX.r(ctx, 8, 46, 48, 14, 'rgba(0,0,0,0)');
}

// ------------------------------------------------------------------ street furniture
function paintBench(ctx, W, H) {
  PX.shadow(ctx, 64, 58, 54, 4, 0.3);
  PX.r(ctx, 12, 44, 8, 14, PX.OUT); PX.r(ctx, 14, 44, 5, 12, '#4a4f66');
  PX.r(ctx, 108, 44, 8, 14, PX.OUT); PX.r(ctx, 110, 44, 5, 12, '#4a4f66');
  PX.box(ctx, 8, 14, 112, 10, '#a06e3c');
  PX.box(ctx, 8, 30, 112, 12, '#b57d45');
}

function paintLamp(ctx, W, H) {
  const g = ctx.createRadialGradient(32, 34, 2, 32, 34, 58);
  g.addColorStop(0, 'rgba(255,226,122,0.55)'); g.addColorStop(1, 'rgba(255,226,122,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 100);
  PX.shadow(ctx, 32, 120, 14, 3, 0.3);
  PX.r(ctx, 26, 40, 12, 82, PX.OUT); PX.r(ctx, 29, 40, 6, 80, '#58607a');
  PX.r(ctx, 22, 112, 20, 10, PX.OUT); PX.r(ctx, 24, 112, 16, 8, '#4a4f66');
  PX.r(ctx, 16, 22, 32, 20, PX.OUT); PX.r(ctx, 19, 25, 26, 14, '#ffe27a'); PX.r(ctx, 19, 25, 26, 4, '#fff3b8');
  PX.r(ctx, 14, 16, 36, 8, PX.OUT); PX.r(ctx, 17, 17, 30, 6, '#3d4258');
}

function paintFenceH(ctx, W, H) {
  PX.shadow(ctx, 32, 58, 30, 3, 0.25);
  PX.r(ctx, 0, 30, 64, 8, PX.OUT); PX.r(ctx, 0, 32, 64, 4, '#d0a96e');
  PX.r(ctx, 0, 44, 64, 8, PX.OUT); PX.r(ctx, 0, 46, 64, 4, '#d0a96e');
  for (let i = 0; i < 4; i++) {
    const x = 4 + i * 16;
    PX.poly(ctx, [[x, 56], [x, 24], [x + 4, 18], [x + 8, 24], [x + 8, 56]], '#ecd9aa', PX.OUT);
    PX.r(ctx, x + 1, 24, 2, 30, '#fff3cf');
  }
}

function paintFenceV(ctx, W, H) {
  PX.r(ctx, 27, 0, 10, 64, PX.OUT); PX.r(ctx, 29, 0, 6, 64, '#d0a96e');
  [4, 40].forEach(y => {
    PX.r(ctx, 22, y, 20, 22, PX.OUT); PX.r(ctx, 24, y + 2, 16, 18, '#ecd9aa'); PX.r(ctx, 24, y + 2, 16, 4, '#fff3cf');
  });
}

// ------------------------------------------------------------------ buildings
function paintHouse(ctx, W, H, v) {
  const wall = ['#f1c79d', '#9fd0ee', '#b3e2bb', '#f3de8f', '#f4ecd8'][v % 5];
  const roof = ['#b5472f', '#3f6fb0', '#4a8f4a', '#8a8f98', '#a83232'][v % 5];
  PX.shadow(ctx, W / 2, H - 6, W / 2 - 14, 9, 0.28);
  // wall
  PX.r(ctx, 20, 108, 344, 138, PX.OUT);
  PX.r(ctx, 24, 112, 336, 130, wall);
  PX.r(ctx, 24, 112, 336, 12, PX.shade(wall, 0.78));
  PX.r(ctx, 24, 226, 336, 16, PX.shade(wall, 0.82));
  // roof (corrugated)
  PX.poly(ctx, [[10, 118], [52, 8], [332, 8], [374, 118]], roof, PX.OUT);
  for (let y = 18; y < 112; y += 11) {
    const inset = (y - 8) * 0.37;
    PX.r(ctx, 52 - inset + 4, y, 280 + inset * 2 - 8, 2, PX.shade(roof, 0.78));
    PX.r(ctx, 52 - inset + 4, y + 2, 280 + inset * 2 - 8, 2, PX.shade(roof, 1.14));
  }
  PX.r(ctx, 52, 8, 280, 8, PX.shade(roof, 1.3));
  // water tank on the roof
  PX.r(ctx, 270, 26, 40, 34, PX.OUT); PX.r(ctx, 273, 29, 34, 28, '#4b86d6'); PX.r(ctx, 273, 29, 8, 28, '#7fb0f0'); PX.r(ctx, 273, 29, 34, 5, '#2e5fa6');
  // windows
  const win = (x) => {
    PX.r(ctx, x - 2, 134, 68, 66, PX.OUT);
    PX.r(ctx, x, 136, 64, 62, '#ffffff');
    PX.r(ctx, x + 5, 141, 54, 52, '#a9dcf3');
    PX.r(ctx, x + 5, 141, 54, 14, '#d2f0fb');
    PX.r(ctx, x + 30, 141, 4, 52, '#ffffff');
    PX.r(ctx, x + 5, 164, 54, 3, '#ffffff');
    for (let i = 0; i < 4; i++) PX.r(ctx, x + 12 + i * 13, 141, 2, 52, '#3b3f55');
    PX.r(ctx, x - 4, 198, 72, 6, '#8a8f98');
  };
  win(52); win(268);
  // door
  PX.r(ctx, 164, 148, 56, 96, PX.OUT);
  PX.r(ctx, 167, 151, 50, 91, '#7a4e2a');
  PX.r(ctx, 172, 158, 40, 26, '#bfe4f5'); PX.r(ctx, 190, 158, 4, 26, '#7a4e2a');
  PX.r(ctx, 172, 192, 40, 42, '#8a5a32');
  PX.disc(ctx, 206, 214, 3, '#f2d43d');
  // porch
  PX.r(ctx, 152, 240, 80, 14, PX.OUT); PX.r(ctx, 155, 242, 74, 10, '#c3c3cd');
  // plants
  [[132, 236], [252, 236]].forEach(([x, y]) => {
    PX.r(ctx, x - 8, y - 4, 16, 14, PX.OUT); PX.r(ctx, x - 6, y - 2, 12, 10, '#b5472f');
    PX.discO(ctx, x, y - 12, 9, '#3a9a46');
  });
}

function paintKubo(ctx, W, H) {
  PX.shadow(ctx, 128, 248, 108, 8, 0.28);
  // stilts
  for (let i = 0; i < 5; i++) { PX.r(ctx, 36 + i * 42 - 2, 194, 10, 58, PX.OUT); PX.r(ctx, 36 + i * 42, 194, 6, 56, '#8a6a3a'); }
  PX.r(ctx, 28, 190, 200, 12, PX.OUT); PX.r(ctx, 30, 192, 196, 8, '#c49a54');
  // bamboo walls
  PX.r(ctx, 40, 118, 176, 76, PX.OUT);
  PX.r(ctx, 42, 120, 172, 72, '#d7c26a');
  for (let x = 46; x < 212; x += 10) PX.r(ctx, x, 120, 3, 72, '#b9a24c');
  PX.r(ctx, 42, 150, 172, 3, '#a38c3e');
  // windows with propped shutters
  [[58, 'l'], [164, 'r']].forEach(([x, side]) => {
    PX.r(ctx, x - 2, 136, 40, 36, PX.OUT); PX.r(ctx, x, 138, 36, 32, '#3a2b1a');
    PX.poly(ctx, side === 'l' ? [[x, 134], [x - 18, 124], [x - 18, 154], [x, 160]] : [[x + 36, 134], [x + 54, 124], [x + 54, 154], [x + 36, 160]], '#c8b25a', PX.OUT);
  });
  // thatch roof
  PX.poly(ctx, [[6, 130], [58, 16], [198, 16], [250, 130]], '#b8903c', PX.OUT);
  for (let y = 22; y < 128; y += 9) {
    const inset = (y - 16) * 0.46;
    for (let x = 58 - inset + 6; x < 198 + inset - 6; x += 9) PX.r(ctx, x + ((y / 9) % 2 ? 4 : 0), y, 5, 3, '#8f6c24');
    PX.r(ctx, 58 - inset + 4, y + 5, 140 + inset * 2 - 8, 2, '#cfa84e');
  }
  PX.r(ctx, 58, 16, 140, 7, '#d9b95e');
  PX.poly(ctx, [[6, 130], [10, 138], [246, 138], [250, 130]], '#8f6c24', PX.OUT);
  // ladder
  PX.r(ctx, 200, 196, 5, 56, PX.OUT); PX.r(ctx, 226, 196, 5, 56, PX.OUT);
  PX.r(ctx, 201, 196, 3, 54, '#8a6a3a'); PX.r(ctx, 227, 196, 3, 54, '#8a6a3a');
  for (let y = 204; y < 250; y += 12) PX.r(ctx, 201, y, 29, 4, '#a07a44');
}

function paintSchool(ctx, W, H) {
  PX.shadow(ctx, W / 2, H - 8, W / 2 - 20, 10, 0.28);
  PX.r(ctx, 16, 64, 608, 240, PX.OUT);
  PX.r(ctx, 20, 68, 600, 232, '#f3e6c4');
  PX.r(ctx, 20, 68, 600, 10, '#d9c999');
  PX.r(ctx, 20, 272, 600, 28, '#f2c230');
  PX.r(ctx, 20, 272, 600, 4, '#d6a41a');
  PX.r(ctx, 20, 184, 600, 8, '#d9c999');
  // roof
  PX.poly(ctx, [[2, 76], [44, 6], [596, 6], [638, 76]], '#8e2f2f', PX.OUT);
  for (let y = 14; y < 72; y += 10) PX.r(ctx, 44 - (y - 6) * 0.6, y, 552 + (y - 6) * 1.2, 2, '#a73c3c');
  PX.r(ctx, 44, 6, 552, 6, '#b84a4a');
  // windows
  const win = (x, y) => {
    PX.r(ctx, x - 2, y - 2, 52, 52, PX.OUT);
    PX.r(ctx, x, y, 48, 48, '#ffffff');
    PX.r(ctx, x + 4, y + 4, 40, 40, '#7cc2ec');
    PX.r(ctx, x + 4, y + 4, 40, 10, '#b4e2f8');
    PX.r(ctx, x + 22, y + 4, 4, 40, '#ffffff');
    PX.r(ctx, x - 4, y + 48, 56, 5, '#a09a86');
  };
  for (let i = 0; i < 8; i++) { if (i === 3 || i === 4) continue; win(36 + i * 72, 96); }
  for (let i = 0; i < 8; i++) { if (i === 3 || i === 4) continue; win(36 + i * 72, 200); }
  // entrance
  PX.r(ctx, 262, 196, 116, 104, PX.OUT);
  PX.r(ctx, 265, 199, 110, 101, '#e2d2a6');
  PX.poly(ctx, [[262, 200], [320, 150], [378, 200]], '#e2d2a6', PX.OUT);
  PX.r(ctx, 285, 236, 70, 64, PX.OUT); PX.r(ctx, 288, 239, 64, 61, '#7a4e2a');
  PX.r(ctx, 317, 239, 4, 61, '#4f321a');
  PX.r(ctx, 294, 246, 24, 22, '#bfe4f5'); PX.r(ctx, 322, 246, 24, 22, '#bfe4f5');
  // sign
  PX.r(ctx, 240, 120, 160, 36, PX.OUT); PX.r(ctx, 243, 123, 154, 30, '#2a4d9b');
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PAARALAN', 320, 139);
  PX.r(ctx, 246, 300, 148, 12, PX.OUT); PX.r(ctx, 249, 302, 142, 8, '#c3c3cd');
}

function paintStall(ctx, W, H, v) {
  const col = ['#2f6fd0', '#d6342a', '#2f9e44'][v % 3];
  PX.shadow(ctx, 96, 122, 86, 6, 0.28);
  PX.r(ctx, 10, 46, 8, 76, PX.OUT); PX.r(ctx, 12, 46, 4, 74, '#8a6a3a');
  PX.r(ctx, 174, 46, 8, 76, PX.OUT); PX.r(ctx, 176, 46, 4, 74, '#8a6a3a');
  // back shelf with goods
  PX.r(ctx, 16, 56, 160, 34, PX.OUT); PX.r(ctx, 18, 58, 156, 30, '#6b4a2a');
  for (let i = 0; i < 12; i++) PX.r(ctx, 22 + i * 12.5, 62 + (i % 2) * 12, 9, 10, ['#e63946', '#f2d43d', '#4caf50', '#4dabf7', '#f08c00'][i % 5]);
  // counter
  PX.box(ctx, 8, 84, 176, 30, '#b87b43');
  PX.r(ctx, 8, 84, 176, 8, '#d49a5c');
  for (let i = 0; i < 8; i++) PX.disc(ctx, 20 + i * 21, 80, 5, ['#e63946', '#f2d43d', '#7cc243', '#f08c00'][i % 4]);
  // striped awning with scalloped edge
  PX.r(ctx, 4, 8, 184, 40, PX.OUT);
  for (let i = 0; i < 12; i++) {
    PX.r(ctx, 6 + i * 15, 10, 15, 36, i % 2 ? '#ffffff' : col);
    PX.disc(ctx, 6 + i * 15 + 7, 46, 7, i % 2 ? '#ffffff' : col);
  }
  PX.r(ctx, 6, 10, 180, 6, 'rgba(255,255,255,0.35)');
  PX.r(ctx, 6, 38, 180, 4, 'rgba(0,0,0,0.12)');
  if (v === 0) {
    PX.r(ctx, 56, 18, 80, 18, PX.OUT); PX.r(ctx, 58, 20, 76, 14, '#ffd84a');
    ctx.fillStyle = '#7a1f1f'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SARI-SARI', 96, 28);
  }
}

function paintJeepney(ctx, W, H, v) {
  const [body, stripe] = [['#f2c230', '#d6342a'], ['#2f6fd0', '#ffffff'], ['#d6342a', '#ffd84a']][v % 3];
  PX.shadow(ctx, 160, 120, 140, 7, 0.3);
  // roof rack and luggage
  PX.r(ctx, 52, 18, 196, 8, PX.OUT); PX.r(ctx, 54, 20, 192, 4, '#c9ced8');
  [[70, '#e63946'], [112, '#4dabf7'], [160, '#f08c00'], [206, '#7cc243']].forEach(([x, c]) => PX.box(ctx, x, 4, 30, 16, c));
  // bunting
  for (let i = 0; i < 9; i++) PX.poly(ctx, [[60 + i * 22, 26], [72 + i * 22, 26], [66 + i * 22, 36]], ['#e63946', '#ffd84a', '#4dabf7'][i % 3], PX.OUT);
  // body
  PX.r(ctx, 14, 34, 288, 70, PX.OUT);
  PX.r(ctx, 17, 37, 282, 64, body);
  PX.r(ctx, 17, 37, 282, 8, PX.shade(body, 1.25));
  PX.r(ctx, 17, 80, 282, 8, stripe);
  PX.r(ctx, 17, 92, 282, 9, PX.shade(body, 0.75));
  // hood
  PX.r(ctx, 264, 54, 50, 50, PX.OUT); PX.r(ctx, 267, 57, 44, 44, body); PX.r(ctx, 267, 57, 44, 6, PX.shade(body, 1.25));
  PX.r(ctx, 267, 80, 44, 8, stripe);
  PX.r(ctx, 300, 64, 14, 36, PX.OUT); PX.r(ctx, 302, 66, 10, 32, '#d9dde6');
  for (let i = 0; i < 4; i++) PX.r(ctx, 302, 70 + i * 7, 10, 2, '#8a90a0');
  PX.disc(ctx, 307, 58, 5, '#fff3b0');
  // windows
  for (let i = 0; i < 6; i++) {
    PX.r(ctx, 36 + i * 38 - 2, 46, 34, 26, PX.OUT); PX.r(ctx, 36 + i * 38, 48, 30, 22, '#35506b');
    PX.poly(ctx, [[38 + i * 38, 50], [48 + i * 38, 50], [40 + i * 38, 68], [38 + i * 38, 68]], '#6f93b3');
  }
  PX.r(ctx, 262, 48, 36, 28, PX.OUT); PX.r(ctx, 264, 50, 32, 24, '#35506b');
  // wheels
  [[66], [236]].forEach(([x]) => {
    PX.discO(ctx, x, 106, 16, '#1d1d25');
    PX.disc(ctx, x, 106, 8, '#c9ced8'); PX.disc(ctx, x, 106, 3, '#7e8494');
  });
}

function paintTricycle(ctx, W, H, v) {
  const body = ['#2f9e44', '#d6342a', '#2f6fd0'][v % 3];
  PX.shadow(ctx, 96, 120, 76, 6, 0.3);
  // sidecar
  PX.box(ctx, 90, 54, 84, 44, body);
  PX.poly(ctx, [[86, 56], [100, 30], [172, 30], [178, 56]], PX.shade(body, 1.2), PX.OUT);
  PX.r(ctx, 106, 36, 54, 16, '#bfe4f5');
  PX.r(ctx, 94, 78, 76, 8, '#ffd84a');
  // motorbike
  PX.r(ctx, 22, 62, 46, 26, PX.OUT); PX.r(ctx, 24, 64, 42, 22, '#4a4f66');
  PX.r(ctx, 36, 50, 28, 14, PX.OUT); PX.r(ctx, 38, 52, 24, 10, '#2a2a34');
  PX.r(ctx, 14, 44, 20, 5, PX.OUT); PX.r(ctx, 16, 45, 16, 3, '#c9ced8');
  PX.r(ctx, 18, 46, 6, 36, PX.OUT); PX.r(ctx, 19, 48, 4, 32, '#8a90a0');
  [[36, 108], [78, 108], [150, 108]].forEach(([x, y]) => {
    PX.discO(ctx, x, y, 13, '#1d1d25'); PX.disc(ctx, x, y, 6, '#c9ced8'); PX.disc(ctx, x, y, 2, '#7e8494');
  });
}

// ------------------------------------------------------------------ sports and playground
function paintHoop(ctx, W, H) {
  PX.shadow(ctx, 32, 122, 16, 4, 0.3);
  PX.r(ctx, 26, 36, 12, 90, PX.OUT); PX.r(ctx, 29, 36, 6, 88, '#8a90a0');
  PX.r(ctx, 20, 116, 24, 10, PX.OUT); PX.r(ctx, 22, 116, 20, 8, '#5b6070');
  PX.r(ctx, 10, 6, 44, 34, PX.OUT); PX.r(ctx, 13, 9, 38, 28, '#f2f4f8');
  PX.r(ctx, 24, 18, 16, 12, 'rgba(0,0,0,0)'); ctx.strokeStyle = '#d6342a'; ctx.lineWidth = 3; ctx.strokeRect(24, 18, 16, 12);
  PX.r(ctx, 20, 38, 24, 4, '#f08c00');
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(22 + i * 5, 42); ctx.lineTo(25 + i * 4, 56); ctx.stroke(); }
}

function paintFlag(ctx, W, H) {
  PX.shadow(ctx, 32, 186, 16, 4, 0.3);
  PX.r(ctx, 26, 24, 11, 162, PX.OUT); PX.r(ctx, 29, 24, 5, 160, '#d9dde6');
  PX.discO(ctx, 31, 22, 6, '#f6c945');
  PX.r(ctx, 18, 174, 28, 12, PX.OUT); PX.r(ctx, 20, 176, 24, 8, '#8a90a0');
  // Philippine flag, waving
  const x0 = 34, y0 = 30, w = 28, h = 26;
  for (let i = 0; i < w; i++) {
    const dy = Math.sin(i / 4) * 2;
    ctx.fillStyle = '#0038a8'; ctx.fillRect(x0 + i, y0 + dy, 1, h / 2);
    ctx.fillStyle = '#ce1126'; ctx.fillRect(x0 + i, y0 + dy + h / 2, 1, h / 2);
  }
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 13, y0 + h / 2); ctx.lineTo(x0, y0 + h); ctx.closePath(); ctx.fill();
  PX.disc(ctx, x0 + 4, y0 + h / 2, 2, '#fcd116');
  ctx.strokeStyle = PX.OUT; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, w, h);
}

function paintSwing(ctx, W, H) {
  PX.shadow(ctx, 96, 120, 84, 5, 0.28);
  ctx.strokeStyle = PX.OUT; ctx.lineWidth = 9; ctx.lineCap = 'round';
  [[14, 120, 40, 18], [178, 120, 152, 18]].forEach(l => { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); });
  ctx.beginPath(); ctx.moveTo(34, 18); ctx.lineTo(158, 18); ctx.stroke();
  ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 5;
  [[14, 120, 40, 18], [178, 120, 152, 18]].forEach(l => { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); });
  ctx.beginPath(); ctx.moveTo(34, 18); ctx.lineTo(158, 18); ctx.stroke();
  [[70, '#e03131'], [122, '#fcc419']].forEach(([x, c]) => {
    ctx.strokeStyle = PX.OUT; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 10, 18); ctx.lineTo(x - 10, 82); ctx.moveTo(x + 10, 18); ctx.lineTo(x + 10, 82); ctx.stroke();
    PX.box(ctx, x - 16, 80, 32, 8, c);
  });
}

function paintBleacher(ctx, W, H) {
  PX.shadow(ctx, 128, 122, 118, 5, 0.28);
  [[92, '#4a6fa5', 24], [66, '#5a7fb5', 24], [40, '#6a8fc5', 24]].forEach(([y, c, h], i) => {
    PX.r(ctx, 8 + i * 6, y - 2, 240 - i * 12, h + 4, PX.OUT);
    PX.r(ctx, 10 + i * 6, y, 236 - i * 12, h, '#b9bcc8');
    PX.r(ctx, 10 + i * 6, y, 236 - i * 12, 8, c);
    PX.r(ctx, 10 + i * 6, y + 8, 236 - i * 12, 3, PX.shade(c, 0.7));
  });
  ctx.strokeStyle = PX.OUT; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(24, 40); ctx.lineTo(24, 14); ctx.lineTo(232, 14); ctx.lineTo(232, 40); ctx.stroke();
  ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(24, 40); ctx.lineTo(24, 14); ctx.lineTo(232, 14); ctx.lineTo(232, 40); ctx.stroke();
}
