// Tile grid: collisions, line of sight and A* pathfinding. No Phaser in here (unit tested in Node).
// World coordinates are pixels. An actor's position is the middle of its feet.
class Grid {
  constructor(cols, rows, tile) {
    this.cols = cols;
    this.rows = rows;
    this.tile = tile;
    this.solid = new Uint8Array(cols * rows);    // 1 = nobody can walk here
    this.opaque = new Uint8Array(cols * rows);   // 1 = blocks line of sight
  }

  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows; }
  isSolid(tx, ty) { return !this.inBounds(tx, ty) || this.solid[ty * this.cols + tx] === 1; }
  isOpaque(tx, ty) { return !this.inBounds(tx, ty) || this.opaque[ty * this.cols + tx] === 1; }
  set(tx, ty, solid, opaque) {
    if (!this.inBounds(tx, ty)) return;
    this.solid[ty * this.cols + tx] = solid ? 1 : 0;
    this.opaque[ty * this.cols + tx] = opaque ? 1 : 0;
  }
  tileOf(p) { return Math.floor(p / this.tile); }
  centerOf(t) { return t * this.tile + this.tile / 2; }
  solidAt(px, py) { return this.isSolid(this.tileOf(px), this.tileOf(py)); }

  // Is a box centred at (x, y) with half sizes hw, hh free of solid tiles?
  boxFree(x, y, hw, hh) {
    const x0 = this.tileOf(x - hw), x1 = this.tileOf(x + hw - 0.001);
    const y0 = this.tileOf(y - hh), y1 = this.tileOf(y + hh - 0.001);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.isSolid(tx, ty)) return false;
      }
    }
    return true;
  }

  // Move an entity {x, y, hw, hh} by (dx, dy), sliding along walls. Returns true if it bumped something.
  moveBox(e, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
    const sx = dx / steps, sy = dy / steps;
    let bumped = false;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0) {
        if (this.boxFree(e.x + sx, e.y, e.hw, e.hh)) e.x += sx; else bumped = true;
      }
      if (sy !== 0) {
        if (this.boxFree(e.x, e.y + sy, e.hw, e.hh)) e.y += sy; else bumped = true;
      }
    }
    return bumped;
  }

  // Can (x0, y0) see (x1, y1)? Only opaque tiles (houses, walls) block sight.
  hasLOS(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 8);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.isOpaque(this.tileOf(x0 + (x1 - x0) * t), this.tileOf(y0 + (y1 - y0) * t))) return false;
    }
    return true;
  }

  // Farthest point along a ray before it hits an opaque tile (used to shape the vision cone).
  rayLength(x, y, angle, maxLen) {
    const cx = Math.cos(angle), cy = Math.sin(angle);
    for (let d = 6; d < maxLen; d += 6) {
      if (this.isOpaque(this.tileOf(x + cx * d), this.tileOf(y + cy * d))) return d - 6;
    }
    return maxLen;
  }

  // Nearest walkable tile to (tx, ty) within maxR tiles, or null.
  nearestFree(tx, ty, maxR) {
    for (let r = 0; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!this.isSolid(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
        }
      }
    }
    return null;
  }

  // Flood fill: which tiles can be reached on foot from (tx, ty)?
  reachableFrom(tx, ty) {
    const seen = new Uint8Array(this.cols * this.rows);
    if (this.isSolid(tx, ty)) return seen;
    const q = [tx + ty * this.cols];
    seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const x = i % this.cols, y = (i - x) / this.cols;
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of nb) {
        if (this.isSolid(nx, ny)) continue;
        const j = nx + ny * this.cols;
        if (!seen[j]) { seen[j] = 1; q.push(j); }
      }
    }
    return seen;
  }

  // A straight walk from a to b is clear for a body of this size?
  segmentFree(ax, ay, bx, by, hw, hh) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(d / 4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (!this.boxFree(ax + (bx - ax) * t, ay + (by - ay) * t, hw, hh)) return false;
    }
    return true;
  }

  // A* from (sx, sy) to (ex, ey) in world pixels. Returns a list of {x, y} waypoints or null.
  findPath(sx, sy, ex, ey, hw = 8, hh = 6) {
    let s = { x: this.tileOf(sx), y: this.tileOf(sy) };
    let e = { x: this.tileOf(ex), y: this.tileOf(ey) };
    if (this.isSolid(s.x, s.y)) { s = this.nearestFree(s.x, s.y, 3); if (!s) return null; }
    if (this.isSolid(e.x, e.y)) { e = this.nearestFree(e.x, e.y, 3); if (!e) return null; }
    const cols = this.cols;
    const N = cols * this.rows;
    const startI = s.x + s.y * cols, endI = e.x + e.y * cols;

    if (startI === endI) return [{ x: ex, y: ey }];

    const g = new Float32Array(N).fill(Infinity);
    const parent = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = [];                       // entries are [f, index]
    const push = (f, i) => {
      heap.push([f, i]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        const t = heap[p]; heap[p] = heap[c]; heap[c] = t;
        c = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let p = 0;
        for (;;) {
          const l = p * 2 + 1, r = l + 1;
          let m = p;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === p) break;
          const t = heap[p]; heap[p] = heap[m]; heap[m] = t;
          p = m;
        }
      }
      return top;
    };
    const h = (x, y) => {
      const dx = Math.abs(x - e.x), dy = Math.abs(y - e.y);
      return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy);
    };
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

    g[startI] = 0;
    push(h(s.x, s.y), startI);
    let found = false;
    while (heap.length) {
      const [, i] = pop();
      if (closed[i]) continue;
      closed[i] = 1;
      if (i === endI) { found = true; break; }
      const x = i % cols, y = (i - x) / cols;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (this.isSolid(nx, ny)) continue;
        if (dx !== 0 && dy !== 0 && (this.isSolid(x + dx, y) || this.isSolid(x, y + dy))) continue;
        const j = nx + ny * cols;
        if (closed[j]) continue;
        // small penalty next to walls so paths keep a little distance from corners
        const near = (this.isSolid(nx + 1, ny) || this.isSolid(nx - 1, ny) || this.isSolid(nx, ny + 1) || this.isSolid(nx, ny - 1)) ? 0.35 : 0;
        const ng = g[i] + (dx !== 0 && dy !== 0 ? 1.4142 : 1) + near;
        if (ng < g[j]) {
          g[j] = ng;
          parent[j] = i;
          push(ng + h(nx, ny), j);
        }
      }
    }
    if (!found) return null;

    const tiles = [];
    for (let i = endI; i !== -1; i = parent[i]) tiles.push(i);
    tiles.reverse();                                  // start ... end
    const pts = [{ x: sx, y: sy }];
    for (let k = 1; k < tiles.length; k++) {
      const i = tiles[k];
      const x = i % cols, y = (i - x) / cols;
      pts.push({ x: this.centerOf(x), y: this.centerOf(y) });
    }
    // final point: the exact target when it is in the end tile, else the tile centre
    if (this.tileOf(ex) === e.x && this.tileOf(ey) === e.y && this.boxFree(ex, ey, hw, hh)) {
      pts[pts.length - 1] = { x: ex, y: ey };
    }

    // string pulling: skip waypoints that can be reached in a straight line
    const out = [];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.segmentFree(pts[i].x, pts[i].y, pts[j].x, pts[j].y, hw, hh)) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }
}
