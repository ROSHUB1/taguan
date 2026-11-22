// Small helpers shared by the whole game. No Phaser in here so it can be unit tested in Node.
const U = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); },

  // Seeded random number generator (mulberry32). Same seed, same sequence.
  rng(seed) {
    let a = seed >>> 0;
    const f = function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));      // inclusive
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.range = (lo, hi) => lo + f() * (hi - lo);
    return f;
  },

  // Shortest signed difference between two angles, in (-PI, PI].
  angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d <= -Math.PI) d += Math.PI * 2;
    return d;
  },

  // Turn `cur` toward `target` by at most `maxStep` radians.
  turnToward(cur, target, maxStep) {
    const d = U.angleDiff(cur, target);
    if (Math.abs(d) <= maxStep) return target;
    return cur + Math.sign(d) * maxStep;
  },

  fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return m + ':' + s;
  },

  shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
};
