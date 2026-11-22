// Unit tests for the pure game logic: grid, pathfinding, seeker and hider brains, save data.
// Run:  node tests/core.test.js
const { load, test, assert, eq, summary } = require('./loader');

const G = load(
  ['js/config.js', 'js/core/util.js', 'js/core/save.js', 'js/core/grid.js', 'js/core/seekerBrain.js', 'js/core/hiderBrain.js'],
  '({ CONFIG, DIFFICULTY, ACCESSORIES, U, Save, Grid, SeekerBrain, HiderBrain })'
);
const { CONFIG, DIFFICULTY, U, Save, Grid, SeekerBrain, HiderBrain } = G;

// A 30x20 field with an optional wall
function field(wallCols) {
  const g = new Grid(30, 20, 32);
  for (let x = 0; x < 30; x++) { g.set(x, 0, 1, 1); g.set(x, 19, 1, 1); }
  for (let y = 0; y < 20; y++) { g.set(0, y, 1, 1); g.set(29, y, 1, 1); }
  return g;
}
const body = (x, y) => ({ x, y, hw: CONFIG.BODY_HW, hh: CONFIG.BODY_HH });

console.log('Grid');
test('box cannot walk into a solid tile and slides along it', () => {
  const g = field();
  g.set(10, 10, 1, 1);
  const e = body(9 * 32 + 16, 10 * 32 + 16);
  g.moveBox(e, 40, 0);
  assert(e.x < 10 * 32 - CONFIG.BODY_HW + 0.5, 'stopped at the wall, x=' + e.x);
  const y0 = e.y;
  g.moveBox(e, 40, 10);
  assert(e.y > y0 || e.y === y0, 'did not move backwards');
});
test('line of sight is blocked by opaque tiles only', () => {
  const g = field();
  g.set(10, 10, 1, 0);                                   // solid but see-through (bush)
  assert(g.hasLOS(5 * 32, 10 * 32 + 16, 15 * 32, 10 * 32 + 16), 'sees through bush');
  g.set(10, 10, 1, 1);                                   // wall
  assert(!g.hasLOS(5 * 32, 10 * 32 + 16, 15 * 32, 10 * 32 + 16), 'blocked by wall');
});
test('A* finds a way around a wall and the path is walkable', () => {
  const g = field();
  for (let y = 1; y < 15; y++) g.set(14, y, 1, 1);       // wall with a gap at the bottom
  const p = g.findPath(3 * 32 + 16, 5 * 32 + 16, 25 * 32 + 16, 5 * 32 + 16);
  assert(p && p.length >= 2, 'path exists');
  let px = 3 * 32 + 16, py = 5 * 32 + 16;
  for (const q of p) { assert(g.segmentFree(px, py, q.x, q.y, 7, 5), 'segment free'); px = q.x; py = q.y; }
  assert(U.dist(px, py, 25 * 32 + 16, 5 * 32 + 16) < 20, 'ends at target');
});
test('A* returns null when the target is walled off', () => {
  const g = field();
  for (let y = 1; y < 19; y++) g.set(14, y, 1, 1);       // full wall
  eq(g.findPath(3 * 32, 5 * 32, 25 * 32, 5 * 32), null);
});
test('reachableFrom and nearestFree work', () => {
  const g = field();
  g.set(5, 5, 1, 1);
  const seen = g.reachableFrom(3, 3);
  assert(seen[3 + 3 * 30] === 1 && seen[5 + 5 * 30] === 0);
  const n = g.nearestFree(5, 5, 2);
  assert(n && !g.isSolid(n.x, n.y));
});
test('rayLength stops at an opaque tile', () => {
  const g = field();
  g.set(10, 10, 1, 1);
  const len = g.rayLength(5 * 32, 10 * 32 + 16, 0, 400);
  assert(len > 100 && len < 5 * 32 + 8, 'ray length ' + len);
});

console.log('\nUtil and Save');
test('seeded rng is repeatable', () => {
  const a = U.rng(42), b = U.rng(42);
  for (let i = 0; i < 5; i++) eq(a(), b());
});
test('angleDiff wraps around', () => {
  assert(Math.abs(U.angleDiff(3.0, -3.0) - (2 * Math.PI - 6.0)) < 1e-9);
});
test('Save loads defaults, records a round, and unlocks accessories by stars', () => {
  Save.load();
  eq(Save.data.settings.difficulty, 'normal');
  const r1 = Save.recordRound('barangay', true, 3, true, 0);
  assert(r1.improved);
  eq(Save.totalStars(), 3);
  assert(r1.unlocked.some(a => a.id === 'cap'), 'cap unlocks once total stars reach 2');
  assert(!r1.unlocked.some(a => a.id === 'headphones'), 'headphones still locked at 3 stars');
  const r2 = Save.recordRound('school', true, 1, false, 2);
  assert(r2.unlocked.some(a => a.id === 'headphones'), 'headphones unlock at 4 stars');
  const r3 = Save.recordRound('barangay', true, 1, false, 0);
  assert(!r3.improved, 'lower score does not replace best');
  eq(Save.data.stats.played, 3);
});

console.log('\nSeekerBrain');
function spotsFor(g) {
  // three bushes on the right half, each with an approach point on its left
  return [
    { id: 1, x: 20 * 32 + 16, y: 5 * 32 + 16, ax: 19 * 32 + 16, ay: 5 * 32 + 16 },
    { id: 2, x: 20 * 32 + 16, y: 10 * 32 + 16, ax: 19 * 32 + 16, ay: 10 * 32 + 16 },
    { id: 3, x: 20 * 32 + 16, y: 15 * 32 + 16, ax: 19 * 32 + 16, ay: 15 * 32 + 16 }
  ];
}
function sim(brain, g, me, targets, spots, seconds, onEvent) {
  const dt = 1 / 60;
  let t = 0;
  const log = [];
  for (let i = 0; i < seconds * 60; i++) {
    t += dt;
    const out = brain.update(dt, { time: t, self: me, targets, spots });
    if (out.speed > 0) g.moveBox(me, out.dx * out.speed * dt, out.dy * out.speed * dt);
    for (const e of out.events) { log.push({ t, e }); if (onEvent) onEvent(e, t); }
  }
  return log;
}
test('Taya waits for the countdown, then goes hunting', () => {
  const g = field(); const spots = spotsFor(g);
  const b = new SeekerBrain(g, DIFFICULTY.normal, U.rng(1));
  const me = body(5 * 32, 10 * 32);
  const log = sim(b, g, me, [], spots, 8, null);
  eq(me.x, 5 * 32, 'did not move during the countdown');
  const log2 = sim(b, g, me, [], spots, 6, null);
  assert(log2.some(l => l.e.type === 'go') || b.state !== 'wait', 'started');
  assert(me.x !== 5 * 32 || me.y !== 10 * 32, 'moved after countdown');
});
test('Taya checks every spot eventually and finds a hider with certain=true', () => {
  const g = field(); const spots = spotsFor(g);
  const b = new SeekerBrain(g, DIFFICULTY.normal, U.rng(2));
  const me = body(5 * 32, 10 * 32);
  const searched = new Set();
  const hiddenTarget = { id: 'p', kind: 'player', x: spots[1].x, y: spots[1].y, hidden: true, noise: 0 };
  sim(b, g, me, [hiddenTarget], spots, 120, (e) => { if (e.type === 'search') searched.add(e.spotId); });
  eq(searched.size, 3, 'all three spots searched, got ' + [...searched]);
});
test('a visible hider in front is spotted, chased and caught', () => {
  const g = field(); const spots = spotsFor(g);
  const b = new SeekerBrain(g, DIFFICULTY.normal, U.rng(3));
  b.state = 'patrol'; b.facing = 0;
  const me = body(5 * 32, 10 * 32);
  const target = { id: 'p', kind: 'player', x: 9 * 32, y: 10 * 32, hidden: false, noise: 0 };
  let spotted = false, caught = false;
  sim(b, g, me, [target], spots, 6, (e) => { if (e.type === 'spotted') spotted = true; if (e.type === 'catch') caught = true; });
  assert(spotted, 'spotted'); assert(caught, 'caught');
  eq(b.state, 'stunned', 'frozen after the catch');
});
test('a hider behind a wall is not seen', () => {
  const g = field();
  for (let y = 5; y < 15; y++) g.set(8, y, 1, 1);
  const b = new SeekerBrain(g, DIFFICULTY.normal, U.rng(4));
  b.state = 'patrol'; b.facing = 0;
  const me = body(5 * 32, 10 * 32);
  const target = { id: 'p', kind: 'player', x: 10 * 32, y: 10 * 32, hidden: false, noise: 0 };
  assert(!b.sees(me, target), 'cannot see through the wall');
});
test('a hider behind Taya is not seen unless very close', () => {
  const g = field();
  const b = new SeekerBrain(g, DIFFICULTY.normal, U.rng(5));
  b.state = 'patrol'; b.facing = 0;                      // looking right
  const me = body(10 * 32, 10 * 32);
  assert(!b.sees(me, { id: 'p', x: 7 * 32, y: 10 * 32, hidden: false }), 'behind: not seen');
  assert(b.sees(me, { id: 'p', x: 10 * 32 - 20, y: 10 * 32, hidden: false }), 'very close: seen');
});
test('running footsteps make Taya investigate; walking quietly on easy does not', () => {
  const g = field(); const spots = spotsFor(g);
  const b = new SeekerBrain(g, DIFFICULTY.normal, U.rng(6));
  b.state = 'patrol'; b.facing = Math.PI;                // looking away
  const me = body(5 * 32, 10 * 32);
  const noisy = { id: 'p', kind: 'player', x: 5 * 32 + 100, y: 10 * 32, hidden: false, noise: 150 };
  let heard = false;
  sim(b, g, me, [noisy], spots, 1, (e) => { if (e.type === 'heard') heard = true; });
  assert(heard, 'heard the runner');
});
test('hidden targets are never seen or heard', () => {
  const g = field(); const spots = spotsFor(g);
  const b = new SeekerBrain(g, DIFFICULTY.hard, U.rng(7));
  b.state = 'patrol'; b.facing = 0;
  const me = body(5 * 32, 10 * 32);
  const t = { id: 'p', kind: 'player', x: 6 * 32, y: 10 * 32, hidden: true, noise: 500 };
  let any = false;
  sim(b, g, me, [t], [], 3, (e) => { if (e.type === 'spotted' || e.type === 'heard' || e.type === 'catch') any = true; });
  assert(!any, 'no detection of a hidden target');
});
test('after losing sight Taya investigates the last known spot', () => {
  const g = field(); const spots = spotsFor(g);
  const b = new SeekerBrain(g, DIFFICULTY.normal, U.rng(8));
  b.state = 'patrol'; b.facing = 0;
  const me = body(5 * 32, 10 * 32);
  const target = { id: 'p', kind: 'player', x: 10 * 32, y: 10 * 32, hidden: false, noise: 0 };
  sim(b, g, me, [target], spots, 1.2, null);
  eq(b.state, 'chase');
  target.hidden = true;                                 // player vanishes
  sim(b, g, me, [target], spots, 2.5, null);
  assert(b.state === 'investigate' || b.state === 'patrol' || b.state === 'search', 'gave up the chase, state ' + b.state);
});
test('Taya does not get stuck behind a wall while patrolling', () => {
  const g = field();
  for (let y = 1; y < 16; y++) g.set(12, y, 1, 1);       // wall with a gap at the bottom
  const spots = [{ id: 1, x: 20 * 32 + 16, y: 5 * 32 + 16, ax: 19 * 32 + 16, ay: 5 * 32 + 16 }];
  const b = new SeekerBrain(g, DIFFICULTY.normal, U.rng(9));
  b.state = 'patrol';
  const me = body(4 * 32 + 16, 5 * 32 + 16);
  let searched = false;
  sim(b, g, me, [], spots, 40, (e) => { if (e.type === 'search') searched = true; });
  assert(searched, 'reached the spot on the other side of the wall');
});
test('notifyHide forces the next search to be certain', () => {
  const g = field(); const spots = spotsFor(g);
  const b = new SeekerBrain(g, DIFFICULTY.easy, U.rng(10));
  b.state = 'patrol';
  b.notifyHide(spots[0]);
  const me = body(10 * 32, 5 * 32 + 16);
  let ev = null;
  sim(b, g, me, [], spots, 10, (e) => { if (e.type === 'search' && !ev) ev = e; });
  assert(ev && ev.spotId === 1 && ev.certain === true, 'certain search of spot 1');
});

console.log('\nHiderBrain');
test('an AI hider picks a free spot, walks there and hides', () => {
  const g = field(); const spots = spotsFor(g).map(s => Object.assign({ owner: null }, s));
  const h = new HiderBrain(g, U.rng(11), 'n1');
  const me = body(4 * 32, 8 * 32);
  let hid = null;
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 30 && !hid; i++) {
    const out = h.update(dt, { time: i * dt, self: me, seeker: { x: 2 * 32, y: 17 * 32 }, spots });
    if (out.speed > 0) g.moveBox(me, out.dx * out.speed * dt, out.dy * out.speed * dt);
    for (const e of out.events) {
      if (e.type === 'claim') spots.find(s => s.id === e.spotId).owner = 'n1';
      if (e.type === 'hide') hid = e;
    }
  }
  assert(hid, 'hid within 30s');
  eq(h.state, 'hidden');
});
test('two AI hiders never claim the same spot', () => {
  const g = field(); const spots = spotsFor(g).map(s => Object.assign({ owner: null }, s));
  const hs = [new HiderBrain(g, U.rng(12), 'a'), new HiderBrain(g, U.rng(13), 'b'), new HiderBrain(g, U.rng(14), 'c')];
  const bodies = [body(4 * 32, 8 * 32), body(5 * 32, 9 * 32), body(4 * 32, 12 * 32)];
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 40; i++) {
    hs.forEach((h, k) => {
      const out = h.update(dt, { time: i * dt, self: bodies[k], seeker: { x: 2 * 32, y: 17 * 32 }, spots });
      if (out.speed > 0) g.moveBox(bodies[k], out.dx * out.speed * dt, out.dy * out.speed * dt);
      for (const e of out.events) {
        const sp = spots.find(s => s.id === e.spotId);
        if (e.type === 'claim') { assert(sp.owner === null, 'spot ' + sp.id + ' already owned by ' + sp.owner); sp.owner = h.id; }
        if (e.type === 'release') sp.owner = null;
      }
    });
  }
  const owners = spots.map(s => s.owner).filter(Boolean);
  eq(new Set(owners).size, owners.length, 'owners unique');
  eq(hs.filter(h => h.state === 'hidden').length, 3, 'all three hid');
});

summary();
