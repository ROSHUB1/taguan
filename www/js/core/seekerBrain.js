// The brain of Taya (the seeker). Pure logic: it is told what is in the world and answers with where to walk.
// The scene moves the body and applies the events. No Phaser in here (unit tested in Node).
//
// States
//   wait         counting at base, hiders get a head start
//   patrol       walking to the next hiding spot to check
//   search       standing at a spot, looking around, then rolling the dice to find whoever is inside
//   investigate  walking to a place where something was seen or heard
//   chase        has spotted a hider and is running them down
//   stunned      just caught somebody, frozen for a moment
class SeekerBrain {
  constructor(grid, diff, rnd) {
    this.grid = grid;
    this.diff = diff;
    this.rnd = rnd;
    this.state = 'wait';
    this.waitT = CONFIG.COUNTDOWN;
    this.facing = Math.PI / 2;
    this.sight = 0;           // 0..1, how close Taya is to noticing a hider
    this.alert = 0;           // 0 calm, 1 curious (?), 2 chasing (!)
    this.target = null;
    this.lastKnown = null;
    this.lostT = 0;
    this.spot = null;
    this.certain = false;     // true when Taya watched someone hide: the search will find them
    this.searchT = 0;
    this.arriveT = 0;
    this.searched = {};       // spot id -> time of last check
    this.focus = null;        // {x, y, until}: prefer spots near here
    this.stunT = 0;
    this.baseFacing = 0;
    this.hearCD = 0;
    this.time = 0;
    this._dt = 0.016;
    this._lx = null;
    this._ly = null;
    this.stuckT = 0;
    this.stuckN = 0;
    this._clearPath();
  }

  _clearPath() {
    this.path = null;
    this.pathI = 0;
    this.pathDest = null;
    this.repathT = 0;
  }

  // Freeze after a catch.
  stun(t) {
    this.stunT = t;
    this.state = 'stunned';
    this.target = null;
    this.sight = 0;
    this._clearPath();
  }

  // Someone hid in plain sight: the next search of that spot is certain to find them.
  notifyHide(spot) {
    this.spot = spot;
    this.certain = true;
    this.state = 'patrol';
    this.target = null;
    this.sight = 0;
    this.lostT = 0;
    this._clearPath();
  }

  // Can Taya see target t right now?
  sees(me, t) {
    if (t.hidden || t.gone) return false;
    return this._canSee(me, t, U.dist(me.x, me.y, t.x, t.y));
  }

  _canSee(me, t, d) {
    if (d > this.diff.vision) return false;
    if (d > 30) {
      const a = Math.atan2(t.y - me.y, t.x - me.x);
      if (Math.abs(U.angleDiff(this.facing, a)) > (this.diff.fov * Math.PI / 180) / 2) return false;
    }
    return this.grid.hasLOS(me.x, me.y, t.x, t.y);
  }

  // w = { time, self:{x,y}, targets:[{id,kind,x,y,hidden,gone,invuln,noise}], spots:[{id,x,y,ax,ay}] }
  update(dt, w) {
    this._dt = dt;
    this.time = w.time;
    const ev = [];
    const me = w.self;
    if (this.hearCD > 0) this.hearCD -= dt;

    if (this.stunT > 0) {
      this.stunT -= dt;
      this.alert = 0;
      if (this.stunT <= 0) {
        this.stunT = 0;
        this.arriveT = 0;
        this.state = this.lastKnown ? 'investigate' : 'patrol';
        this._clearPath();
      }
      return this._out(me, 0, 0, 0, ev);
    }

    if (this.state === 'wait') {
      this.waitT -= dt;
      this.facing = -Math.PI / 2;     // back turned, eyes covered
      if (this.waitT <= 0) { this.state = 'patrol'; ev.push({ type: 'go' }); }
      return this._out(me, 0, 0, 0, ev);
    }

    // ---- what can Taya see and hear?
    let seen = null, seenD = Infinity;
    for (const t of w.targets) {
      if (t.gone || t.hidden || t.invuln) continue;
      const d = U.dist(me.x, me.y, t.x, t.y);
      if (d < seenD && this._canSee(me, t, d)) { seen = t; seenD = d; }
    }
    const wasChasing = this.state === 'chase';
    if (seen) {
      const gain = dt / Math.max(0.05, this.diff.react) * (seenD < 60 ? 2.5 : 1);
      this.sight = Math.min(1, this.sight + gain);
      this.lastKnown = { x: seen.x, y: seen.y };
    } else {
      this.sight = Math.max(0, this.sight - dt * 0.7);
    }

    if (seen && (this.sight >= 1 || wasChasing)) {
      if (!wasChasing) {
        ev.push({ type: 'spotted', id: seen.id, kind: seen.kind });
        this._clearPath();
        this.spot = null;
        this.certain = false;
      }
      this.state = 'chase';
      this.target = seen;
      this.lostT = 0;
    } else if (wasChasing) {
      this.lostT += dt;
      if (this.lostT > this.diff.lose) {
        this.state = 'investigate';
        this.arriveT = 0;
        this.target = null;
        this._clearPath();
      }
    }

    // footsteps
    if (this.state !== 'chase' && this.hearCD <= 0) {
      let heard = null, hd = Infinity;
      for (const t of w.targets) {
        if (t.gone || t.hidden || !(t.noise > 0)) continue;
        const d = U.dist(me.x, me.y, t.x, t.y);
        if (d <= t.noise && d < hd) { heard = t; hd = d; }
      }
      if (heard) {
        this.lastKnown = { x: heard.x, y: heard.y };
        this.state = 'investigate';
        this.arriveT = 0;
        this.hearCD = 2.5;
        this.spot = null;
        this._clearPath();
        ev.push({ type: 'heard', id: heard.id });
      }
    }

    // ---- act on the current state
    let out;
    switch (this.state) {
      case 'chase': out = this._doChase(me, seen, seenD, dt, ev); break;
      case 'investigate': out = this._doInvestigate(me, dt); break;
      case 'search': out = this._doSearch(me, dt, ev); break;
      default: out = this._doPatrol(me, w, dt); break;
    }

    this.alert = this.state === 'chase' ? 2 : ((this.sight > 0.15 || this.state === 'investigate') ? 1 : 0);
    this._trackStuck(me, out.speed, dt);
    return this._out(me, out.dx, out.dy, out.speed, ev);
  }

  _doChase(me, seen, seenD, dt, ev) {
    if (seen && seenD <= CONFIG.CATCH_RADIUS) {
      ev.push({ type: 'catch', id: seen.id, kind: seen.kind });
      this.stun(this.diff.stun);
      return { dx: 0, dy: 0, speed: 0 };
    }
    const tx = seen ? seen.x : (this.lastKnown ? this.lastKnown.x : me.x);
    const ty = seen ? seen.y : (this.lastKnown ? this.lastKnown.y : me.y);
    const r = this._walkTo(me, tx, ty, dt);
    if (r.arrived || r.failed) return { dx: 0, dy: 0, speed: 0 };
    return { dx: r.dx, dy: r.dy, speed: this.diff.chase };
  }

  _doInvestigate(me, dt) {
    if (!this.lastKnown) { this.state = 'patrol'; return { dx: 0, dy: 0, speed: 0 }; }
    const r = this._walkTo(me, this.lastKnown.x, this.lastKnown.y, dt);
    if (r.arrived || r.failed) {
      this.arriveT += dt;
      this.facing = this.baseFacing + Math.sin(this.arriveT * 3) * 1.1;
      if (this.arriveT > 1.4) {
        this.focus = { x: this.lastKnown.x, y: this.lastKnown.y, until: this.time + 14 };
        this.lastKnown = null;
        this.state = 'patrol';
        this.spot = null;
        this._clearPath();
      }
      return { dx: 0, dy: 0, speed: 0, keepFacing: true };
    }
    this.baseFacing = Math.atan2(r.dy, r.dx);
    return { dx: r.dx, dy: r.dy, speed: this.diff.patrol * 1.25 };
  }

  _doSearch(me, dt, ev) {
    this.searchT += dt;
    this.facing = this.baseFacing + Math.sin(this.searchT * 3.2) * 0.8;
    if (this.searchT >= CONFIG.SEARCH_TIME) {
      ev.push({ type: 'search', spotId: this.spot.id, certain: this.certain });
      this.searched[this.spot.id] = this.time;
      this.spot = null;
      this.certain = false;
      this.state = 'patrol';
      this._clearPath();
    }
    return { dx: 0, dy: 0, speed: 0, keepFacing: true };
  }

  _doPatrol(me, w, dt) {
    if (!this.spot) {
      this.spot = this._pickSpot(me, w);
      this._clearPath();
      if (!this.spot) return { dx: 0, dy: 0, speed: 0 };
    }
    const r = this._walkTo(me, this.spot.ax, this.spot.ay, dt);
    if (r.failed) {
      this.searched[this.spot.id] = this.time;
      this.spot = null;
      this.certain = false;
      return { dx: 0, dy: 0, speed: 0 };
    }
    if (r.arrived) {
      this.state = 'search';
      this.searchT = 0;
      this.baseFacing = Math.atan2(this.spot.y - me.y, this.spot.x - me.x);
      return { dx: 0, dy: 0, speed: 0, keepFacing: true };
    }
    return { dx: r.dx, dy: r.dy, speed: this.diff.patrol };
  }

  _pickSpot(me, w) {
    const now = this.time;
    let pool = w.spots.filter(s => {
      const last = this.searched[s.id];
      return last === undefined || now - last >= CONFIG.SPOT_COOLDOWN;
    });
    if (!pool.length) pool = w.spots.slice();
    if (!pool.length) return null;
    const f = this.focus && this.focus.until > now ? this.focus : null;
    const weights = pool.map(s => {
      let wt = 1 / (U.dist(me.x, me.y, s.x, s.y) + 90);
      if (f && U.dist(s.x, s.y, f.x, f.y) < 160) wt *= 5;
      return wt * (0.6 + this.rnd() * 0.8);
    });
    let total = 0;
    for (const x of weights) total += x;
    let r = this.rnd() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  // Direction to walk toward (x, y). Straight if the way is clear, otherwise along an A* path.
  _walkTo(me, x, y, dt) {
    const d = U.dist(me.x, me.y, x, y);
    if (d < 6) return { dx: 0, dy: 0, arrived: true };
    if (this.grid.segmentFree(me.x, me.y, x, y, 8, 6)) {
      this._clearPath();
      return { dx: (x - me.x) / d, dy: (y - me.y) / d, arrived: false };
    }
    this.repathT -= dt;
    const moved = !this.pathDest || U.dist(this.pathDest.x, this.pathDest.y, x, y) > 20;
    if (!this.path || (moved && this.repathT <= 0)) {
      this.path = this.grid.findPath(me.x, me.y, x, y);
      this.pathI = 0;
      this.pathDest = { x, y };
      this.repathT = 0.3;
      if (!this.path) return { dx: 0, dy: 0, arrived: false, failed: true };
    }
    while (this.pathI < this.path.length && U.dist(me.x, me.y, this.path[this.pathI].x, this.path[this.pathI].y) < 6) this.pathI++;
    if (this.pathI >= this.path.length) return { dx: 0, dy: 0, arrived: true };
    const p = this.path[this.pathI];
    const pd = U.dist(me.x, me.y, p.x, p.y) || 1;
    return { dx: (p.x - me.x) / pd, dy: (p.y - me.y) / pd, arrived: false };
  }

  // If Taya is walking but not getting anywhere, throw the path away and eventually give up on that spot.
  _trackStuck(me, speed, dt) {
    if (speed > 0 && this._lx !== null) {
      if (U.dist(me.x, me.y, this._lx, this._ly) < speed * dt * 0.2) this.stuckT += dt; else this.stuckT = 0;
    } else {
      this.stuckT = 0;
    }
    this._lx = me.x;
    this._ly = me.y;
    if (this.stuckT > 0.6) {
      this.stuckT = 0;
      this._clearPath();
      this.stuckN++;
      if (this.stuckN >= 3 && this.state === 'patrol' && this.spot) {
        this.searched[this.spot.id] = this.time;
        this.spot = null;
        this.stuckN = 0;
      }
    }
  }

  _out(me, dx, dy, speed, ev) {
    if (speed > 0) this.facing = U.turnToward(this.facing, Math.atan2(dy, dx), 9 * this._dt);
    return { dx, dy, speed, facing: this.facing, state: this.state, sight: this.sight, alert: this.alert, events: ev };
  }
}
