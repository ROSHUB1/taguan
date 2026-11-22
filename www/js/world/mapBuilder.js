// Builds a map model: terrain, decals, objects, collision grid, hiding spots, base and spawn points.
// Pure data (no Phaser, no canvas), so it can be unit tested in Node. Rendering lives in mapRender.js.
class MapBuilder {
  constructor(id, cols, rows, seed) {
    this.id = id;
    this.cols = cols;
    this.rows = rows;
    this.seed = seed;
    this.rnd = U.rng(seed);
    this.ground = new Uint8Array(cols * rows).fill(GT.grass);
    this.occ = new Uint8Array(cols * rows);        // 0 free, 1 solid object, 2 reserved open space
    this.grid = new Grid(cols, rows, CONFIG.TILE);
    this.decals = [];
    this.objects = [];
    this.base = null;
    this.playerTile = null;
  }

  idx(tx, ty) { return ty * this.cols + tx; }
  inB(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows; }
  groundAt(tx, ty) { return this.ground[this.idx(tx, ty)]; }

  // ---- terrain
  fill(type, tx, ty, w, h) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (this.inB(x, y)) this.ground[this.idx(x, y)] = type;
  }

  // Solid hedge ring around the whole map
  border() {
    for (let x = 0; x < this.cols; x++) { this._hedge(x, 0); this._hedge(x, this.rows - 1); }
    for (let y = 1; y < this.rows - 1; y++) { this._hedge(0, y); this._hedge(this.cols - 1, y); }
  }
  _hedge(tx, ty) {
    this.ground[this.idx(tx, ty)] = GT.hedge;
    this.grid.set(tx, ty, 1, 1);
    this.occ[this.idx(tx, ty)] = 1;
  }

  decal(d) { this.decals.push(d); }

  // Dashed paint line along the middle of a road, in tile units
  roadLine(tx0, ty0, tx1, ty1) {
    const T = CONFIG.TILE;
    this.decal({ kind: 'line', x0: tx0 * T, y0: ty0 * T, x1: tx1 * T, y1: ty1 * T, color: '#e9d36a', lw: 2, dash: [12, 10], alpha: 0.9 });
  }

  // Basketball court markings inside a rectangle given in tiles
  courtLines(tx, ty, tw, th) {
    const T = CONFIG.TILE;
    const x = tx * T, y = ty * T, w = tw * T, h = th * T;
    const white = '#f4f7ff';
    const d = (o) => this.decal(Object.assign({ color: white, lw: 2, alpha: 0.9 }, o));
    d({ kind: 'frame', x: x + 6, y: y + 6, w: w - 12, h: h - 12 });
    d({ kind: 'line', x0: x + w / 2, y0: y + 6, x1: x + w / 2, y1: y + h - 6 });
    d({ kind: 'circle', x: x + w / 2, y: y + h / 2, r: Math.min(h * 0.18, 70) });
    const keyW = Math.min(w * 0.17, 150), keyH = Math.min(h * 0.42, 160);
    d({ kind: 'frame', x: x + 6, y: y + h / 2 - keyH / 2, w: keyW, h: keyH });
    d({ kind: 'frame', x: x + w - 6 - keyW, y: y + h / 2 - keyH / 2, w: keyW, h: keyH });
    d({ kind: 'arc', x: x + 6, y: y + h / 2, r: Math.min(h * 0.4, 190), a0: -Math.PI / 2, a1: Math.PI / 2 });
    d({ kind: 'arc', x: x + w - 6, y: y + h / 2, r: Math.min(h * 0.4, 190), a0: Math.PI / 2, a1: Math.PI * 1.5 });
  }

  // Keep this area free of scattered objects (it is still walkable)
  reserve(tx, ty, w, h) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) {
      if (this.inB(x, y) && this.occ[this.idx(x, y)] === 0) this.occ[this.idx(x, y)] = 2;
    }
  }

  // ---- objects
  // Place an object with its bottom-left footprint tile at (tx, ty). Returns the object or null if it does not fit.
  //   opts.gap    free tiles required around its solid cells (default 0)
  //   opts.on     allowed terrain types (default: not road / hedge)
  //   opts.force  ignore occupancy and terrain checks
  place(type, tx, ty, v, opts) {
    const def = OBJECTS[type];
    if (!def) throw new Error('unknown object ' + type);
    opts = opts || {};
    const gap = opts.gap || 0;
    const cells = def.solid.map(([dx, dy]) => [tx + dx, ty + dy]);
    if (!opts.force) {
      for (const [x, y] of cells) {
        if (!this.inB(x, y)) return null;
        if (this.occ[this.idx(x, y)] !== 0) return null;
        const g = this.groundAt(x, y);
        if (opts.on ? !opts.on.includes(g) : (g === GT.road || g === GT.hedge)) return null;
        for (let yy = y - gap; yy <= y + gap; yy++) for (let xx = x - gap; xx <= x + gap; xx++) {
          if (this.inB(xx, yy) && this.occ[this.idx(xx, yy)] === 1) {
            if (!cells.some(c => c[0] === xx && c[1] === yy)) return null;
          }
        }
      }
    }
    const opaque = new Set(def.opaque.map(([dx, dy]) => (tx + dx) + ',' + (ty + dy)));
    for (const [x, y] of cells) {
      if (!this.inB(x, y)) continue;
      this.occ[this.idx(x, y)] = 1;
      this.grid.set(x, y, 1, opaque.has(x + ',' + y));
    }
    const o = { type, tx, ty, v: v === undefined ? 0 : v, def };
    this.objects.push(o);
    return o;
  }

  // Scatter `count` objects at random spots inside the rectangle [x0, y0, x1, y1] (tiles, inclusive).
  scatter(type, count, rect, opts) {
    opts = Object.assign({ gap: 1, on: [GT.grass, GT.dirt, GT.concrete, GT.sand] }, opts || {});
    const def = OBJECTS[type];
    let placed = 0;
    for (let tries = 0; tries < count * 60 && placed < count; tries++) {
      const tx = this.rnd.int(rect[0], rect[2]);
      const ty = this.rnd.int(rect[1], rect[3]);
      const v = opts.v ? this.rnd.pick(opts.v) : this.rnd.int(0, def.variants - 1);
      if (this.place(type, tx, ty, v, opts)) placed++;
    }
    return placed;
  }

  // A row or column of fence pieces, skipping any listed gap tiles
  fence(tx0, ty0, len, vertical, gaps) {
    for (let i = 0; i < len; i++) {
      const x = vertical ? tx0 : tx0 + i, y = vertical ? ty0 + i : ty0;
      if (gaps && gaps.includes(i)) continue;
      this.place(vertical ? 'fenceV' : 'fenceH', x, y, 0, { on: [GT.grass, GT.dirt, GT.concrete, GT.sand] });
    }
  }

  // The base ("Bahay"): a flag pole with a gold ring on the ground
  setBase(tx, ty) {
    this.place('flag', tx, ty, 0, { force: true });
    const T = CONFIG.TILE;
    this.decal({ kind: 'circle', x: tx * T + T / 2, y: ty * T + T / 2, r: T * 2.1, color: '#f6c945', lw: 3, alpha: 0.85 });
    this.decal({ kind: 'circle', x: tx * T + T / 2, y: ty * T + T / 2, r: T * 2.1 + 5, color: '#ffffff', lw: 1, alpha: 0.4 });
    this.base = { tx, ty, x: tx * T + T / 2, y: ty * T + T / 2 };
  }

  setPlayerSpawn(tx, ty) { this.playerTile = { x: tx, y: ty }; }

  // Work out hiding spots, remove anything unreachable, pick spawn points.
  finish(meta) {
    const T = CONFIG.TILE;
    const g = this.grid;
    let start = this.playerTile;
    if (g.isSolid(start.x, start.y)) start = g.nearestFree(start.x, start.y, 4);
    const reach = g.reachableFrom(start.x, start.y);

    const spots = [];
    const keep = [];
    let n = 0;
    for (const o of this.objects) {
      if (!o.def.hide) { keep.push(o); continue; }
      // approach tile: in front (south) first, then west, east, north
      const nb = [[0, 1], [-1, 0], [1, 0], [0, -1]];
      let ap = null;
      for (const [dx, dy] of nb) {
        const x = o.tx + dx, y = o.ty + dy;
        if (!g.isSolid(x, y) && reach[this.idx(x, y)]) { ap = { x, y }; break; }
      }
      if (!ap) {
        // unreachable: take the object away again
        for (const [dx, dy] of o.def.solid) { g.set(o.tx + dx, o.ty + dy, 0, 0); this.occ[this.idx(o.tx + dx, o.ty + dy)] = 0; }
        continue;
      }
      keep.push(o);
      n++;
      const spot = {
        id: 's' + n, type: o.def.hide, objType: o.type,
        tx: o.tx, ty: o.ty,
        x: o.tx * T + T / 2, y: o.ty * T + T / 2,
        ax: ap.x * T + T / 2, ay: ap.y * T + T / 2
      };
      o.spot = spot;
      spots.push(spot);
    }
    this.objects = keep;

    // spawn points for the other kids: free reachable tiles 3-8 tiles from the base
    const npc = [];
    const cand = [];
    for (let y = 1; y < this.rows - 1; y++) for (let x = 1; x < this.cols - 1; x++) {
      if (g.isSolid(x, y) || !reach[this.idx(x, y)]) continue;
      const d = Math.hypot(x - this.base.tx, y - this.base.ty);
      if (d >= 3 && d <= 8) cand.push({ x: x * T + T / 2, y: y * T + T / 2 });
    }
    U.shuffle(cand, this.rnd);
    for (const c of cand) {
      if (npc.every(p => Math.hypot(p.x - c.x, p.y - c.y) > 40)) npc.push(c);
      if (npc.length >= 10) break;
    }

    // Taya waits just south of the flag
    let sk = g.nearestFree(this.base.tx, this.base.ty + 1, 3);
    return Object.assign({
      id: this.id, cols: this.cols, rows: this.rows, seed: this.seed,
      ground: this.ground, decals: this.decals, objects: this.objects, grid: g,
      spots, base: this.base,
      playerSpawn: { x: start.x * T + T / 2, y: start.y * T + T / 2 },
      npcSpawns: npc,
      seekerStart: { x: sk.x * T + T / 2, y: sk.y * T + T / 2 },
      reach
    }, meta || {});
  }
}
