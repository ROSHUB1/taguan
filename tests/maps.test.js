// Tests that every map is playable: base and hiding spots reachable, enough spots, spawns valid, paths exist.
// Run:  node tests/maps.test.js
const { load, test, assert, eq, summary } = require('./loader');

const G = load(
  ['js/config.js', 'js/core/util.js', 'js/core/grid.js', 'js/art/pixel.js', 'js/art/ground.js', 'js/art/objects.js',
   'js/world/mapBuilder.js', 'js/world/maps.js'],
  '({ CONFIG, DIFFICULTY, U, Grid, GT, OBJECTS, MAPS, buildMap })'
);
const { CONFIG, DIFFICULTY, U, MAPS, buildMap } = G;
const T = CONFIG.TILE;

for (const def of MAPS) {
  console.log('\nMap: ' + def.id);
  const m = buildMap(def.id);
  const g = m.grid;
  const tile = (p) => [Math.floor(p.x / T), Math.floor(p.y / T)];

  test('size and basic data', () => {
    eq(m.cols, 56); eq(m.rows, 40);
    assert(m.spots.length >= 30, 'at least 30 hiding spots, got ' + m.spots.length);
    assert(m.npcSpawns.length >= 8, 'enough NPC spawn points, got ' + m.npcSpawns.length);
  });
  test('player, seeker and base are on free tiles', () => {
    for (const p of [m.playerSpawn, m.seekerStart, ...m.npcSpawns]) {
      const [x, y] = tile(p);
      assert(!g.isSolid(x, y), 'spawn on solid tile ' + x + ',' + y);
    }
    assert(g.isSolid(m.base.tx, m.base.ty), 'the flag pole itself is solid');
  });
  test('border is sealed', () => {
    for (let x = 0; x < m.cols; x++) { assert(g.isSolid(x, 0) && g.isSolid(x, m.rows - 1)); }
    for (let y = 0; y < m.rows; y++) { assert(g.isSolid(0, y) && g.isSolid(m.cols - 1, y)); }
  });
  test('every spot has a reachable approach tile and distinct ids', () => {
    const [sx, sy] = tile(m.playerSpawn);
    const reach = g.reachableFrom(sx, sy);
    const ids = new Set();
    for (const s of m.spots) {
      const ax = Math.floor(s.ax / T), ay = Math.floor(s.ay / T);
      assert(!g.isSolid(ax, ay) && reach[ax + ay * m.cols], 'spot ' + s.id + ' approach unreachable');
      assert(g.isSolid(s.tx, s.ty), 'spot ' + s.id + ' itself is solid');
      ids.add(s.id);
    }
    eq(ids.size, m.spots.length);
  });
  test('the base can be reached on foot from the player spawn', () => {
    const p = g.findPath(m.playerSpawn.x, m.playerSpawn.y, m.base.x, m.base.y + T);
    assert(p && p.length > 0, 'path to base');
  });
  test('A* can connect random pairs of spots (the seeker never gets an impossible target)', () => {
    const rnd = U.rng(99);
    for (let i = 0; i < 40; i++) {
      const a = rnd.pick(m.spots), b = rnd.pick(m.spots);
      const p = g.findPath(a.ax, a.ay, b.ax, b.ay);
      assert(p !== null, 'no path between ' + a.id + ' and ' + b.id);
    }
  });
  test('path length is sane (paths are not absurd detours)', () => {
    const rnd = U.rng(5);
    for (let i = 0; i < 20; i++) {
      const a = rnd.pick(m.spots), b = rnd.pick(m.spots);
      const p = g.findPath(a.ax, a.ay, b.ax, b.ay);
      let len = 0, px = a.ax, py = a.ay;
      for (const q of p) { len += U.dist(px, py, q.x, q.y); px = q.x; py = q.y; }
      const straight = U.dist(a.ax, a.ay, b.ax, b.ay);
      assert(len < straight * 3 + 200, 'detour ' + Math.round(len) + ' vs straight ' + Math.round(straight));
    }
  });
  test('enough hiding spots for every kid on hard', () => {
    assert(m.spots.length > DIFFICULTY.hard.hiders + 1 + 10);
  });
}

summary();
