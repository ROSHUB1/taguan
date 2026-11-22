// Brain of an AI hider (one of the other kids). Pure logic, unit tested in Node.
//
// States
//   go       walking to a free hiding spot
//   flee     saw Taya coming, running to a spot far from Taya
//   hidden   inside a spot
class HiderBrain {
  constructor(grid, rnd, id) {
    this.grid = grid;
    this.rnd = rnd;
    this.id = id;
    this.state = 'go';
    this.spot = null;
    this.hiddenT = 0;
    this.relocateAt = 16 + rnd() * 22;
    this.path = null;
    this.pathI = 0;
    this.repathT = 0;
    this.stuckT = 0;
    this._lx = null;
    this._ly = null;
    this.delay = rnd() * 1.2;     // not everyone sets off at the same instant
  }

  _clearPath() { this.path = null; this.pathI = 0; this.repathT = 0; }

  // w = { time, self:{x,y}, seeker:{x,y}, spots:[{id,x,y,ax,ay,owner}] }
  update(dt, w) {
    const ev = [];
    const me = w.self;
    const sk = w.seeker;
    const sd = U.dist(me.x, me.y, sk.x, sk.y);

    if (this.delay > 0) { this.delay -= dt; return { dx: 0, dy: 0, speed: 0, events: ev }; }

    if (this.state === 'hidden') {
      this.hiddenT += dt;
      if (this.hiddenT > this.relocateAt) {
        this.relocateAt = this.hiddenT + 14 + this.rnd() * 14;
        // sometimes sneak off to a new spot, but only when Taya is far away
        if (sd > 280 && this.rnd() < 0.35) {
          ev.push({ type: 'unhide', spotId: this.spot.id });
          ev.push({ type: 'release', spotId: this.spot.id });
          this.spot = null;
          this.state = 'go';
          this._clearPath();
        }
      }
      return { dx: 0, dy: 0, speed: 0, events: ev };
    }

    // Taya nearby and in sight: run
    if (this.state === 'go' && sd < 140 && this.grid.hasLOS(me.x, me.y, sk.x, sk.y)) {
      this.state = 'flee';
      if (this.spot) { ev.push({ type: 'release', spotId: this.spot.id }); this.spot = null; }
      this._clearPath();
    }

    if (!this.spot) {
      this.spot = this._pickSpot(me, sk, w.spots, this.state === 'flee');
      if (!this.spot) return { dx: 0, dy: 0, speed: 0, events: ev };
      ev.push({ type: 'claim', spotId: this.spot.id });
      this._clearPath();
    }

    const r = this._walkTo(me, this.spot.ax, this.spot.ay, dt);
    if (r.failed) {
      ev.push({ type: 'release', spotId: this.spot.id });
      this.spot = null;
      return { dx: 0, dy: 0, speed: 0, events: ev };
    }
    if (r.arrived) {
      this.state = 'hidden';
      this.hiddenT = 0;
      ev.push({ type: 'hide', spotId: this.spot.id });
      return { dx: 0, dy: 0, speed: 0, events: ev };
    }
    this._trackStuck(me, dt);
    return { dx: r.dx, dy: r.dy, speed: this.state === 'flee' ? 150 : 92, events: ev };
  }

  _pickSpot(me, sk, spots, fleeing) {
    const free = spots.filter(s => s.owner === null || s.owner === undefined);
    if (!free.length) return null;
    const weights = free.map(s => {
      const dMe = U.dist(me.x, me.y, s.x, s.y);
      const dSk = U.dist(sk.x, sk.y, s.x, s.y);
      let wt = 1 / (dMe + 120);
      if (dSk < 200) wt *= fleeing ? 0.02 : 0.35;
      return wt * (0.5 + this.rnd());
    });
    let total = 0;
    for (const x of weights) total += x;
    let r = this.rnd() * total;
    for (let i = 0; i < free.length; i++) {
      r -= weights[i];
      if (r <= 0) return free[i];
    }
    return free[free.length - 1];
  }

  _walkTo(me, x, y, dt) {
    const d = U.dist(me.x, me.y, x, y);
    if (d < 6) return { dx: 0, dy: 0, arrived: true };
    if (this.grid.segmentFree(me.x, me.y, x, y, 8, 6)) {
      this._clearPath();
      return { dx: (x - me.x) / d, dy: (y - me.y) / d, arrived: false };
    }
    if (!this.path) {
      this.path = this.grid.findPath(me.x, me.y, x, y);
      this.pathI = 0;
      if (!this.path) return { dx: 0, dy: 0, arrived: false, failed: true };
    }
    while (this.pathI < this.path.length && U.dist(me.x, me.y, this.path[this.pathI].x, this.path[this.pathI].y) < 6) this.pathI++;
    if (this.pathI >= this.path.length) return { dx: 0, dy: 0, arrived: true };
    const p = this.path[this.pathI];
    const pd = U.dist(me.x, me.y, p.x, p.y) || 1;
    return { dx: (p.x - me.x) / pd, dy: (p.y - me.y) / pd, arrived: false };
  }

  _trackStuck(me, dt) {
    if (this._lx !== null && U.dist(me.x, me.y, this._lx, this._ly) < 0.4) this.stuckT += dt; else this.stuckT = 0;
    this._lx = me.x;
    this._ly = me.y;
    if (this.stuckT > 0.7) { this.stuckT = 0; this._clearPath(); }
  }
}
