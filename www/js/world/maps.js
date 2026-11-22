// The three maps. Each one is a recipe: lay terrain, place buildings, scatter trees and hiding spots, set the base.
// Maps are 56 x 40 tiles. Everything is seeded, so a map looks the same every time.
const MAP_COLS = 56, MAP_ROWS = 40;
const OPEN = [GT.grass, GT.dirt, GT.concrete, GT.sand];

function buildBarangay(b) {
  const T = CONFIG.TILE;
  b.border();
  // streets and the crossroads plaza
  b.fill(GT.road, 1, 18, 54, 3);
  b.fill(GT.road, 26, 1, 3, 38);
  b.fill(GT.plaza, 21, 14, 13, 11);
  b.roadLine(1, 19.5, 21, 19.5); b.roadLine(34, 19.5, 55, 19.5);
  b.roadLine(27.5, 1, 27.5, 14); b.roadLine(27.5, 25, 27.5, 39);
  // yards
  b.fill(GT.dirt, 2, 11, 18, 3); b.fill(GT.dirt, 30, 11, 23, 3);
  b.fill(GT.dirt, 2, 29, 18, 3);
  // basketball court
  b.fill(GT.court, 34, 26, 19, 12);
  b.courtLines(34, 26, 19, 12);
  b.reserve(21, 14, 13, 11);

  // houses along the streets (bottom-left tile)
  b.place('house', 3, 10, 0); b.place('house', 11, 10, 1); b.place('kubo', 19, 10);
  b.place('house', 30, 10, 2); b.place('house', 38, 10, 3); b.place('house', 46, 10, 0);
  b.place('house', 3, 36, 1); b.place('house', 11, 36, 3); b.place('kubo', 19, 36);
  // yard fences with a gate gap
  b.fence(2, 14, 16, false, [7, 8]); b.fence(30, 14, 23, false, [11, 12]);
  b.fence(2, 29, 16, false, [7, 8]);
  // market stalls, jeepneys, tricycles
  b.place('stall', 8, 17, 0); b.place('stall', 14, 17, 1); b.place('stall', 38, 17, 2); b.place('stall', 44, 17, 0);
  b.place('jeepney', 6, 23, 0); b.place('jeepney', 38, 23, 1);
  b.place('tricycle', 14, 23, 0); b.place('tricycle', 44, 23, 2);
  // court
  b.place('hoop', 35, 32, 0); b.place('hoop', 51, 32, 0);
  b.place('bleacher', 38, 25, 0, { on: [GT.grass, GT.court] }); b.place('bleacher', 44, 25, 0, { on: [GT.grass, GT.court] });
  // street lamps
  [[20, 17], [34, 17], [20, 22], [34, 22], [25, 6], [29, 6], [25, 33], [29, 33]].forEach(([x, y]) => b.place('lamp', x, y, 0, { on: [GT.grass, GT.plaza, GT.dirt] }));
  b.setBase(27, 19);
  b.setPlayerSpawn(24, 22);

  const area = [2, 2, 53, 37];
  b.scatter('tree', 26, area, { v: [0, 1], on: [GT.grass, GT.dirt] });
  b.scatter('palm', 10, area, { on: [GT.grass] });
  b.scatter('bush', 16, area, { on: [GT.grass, GT.dirt] });
  b.scatter('saging', 9, area, { on: [GT.grass, GT.dirt] });
  b.scatter('barrel', 9, area, { on: OPEN });
  b.scatter('crates', 9, area, { on: OPEN });
  b.scatter('sako', 7, area, { on: OPEN });
}

function buildSchool(b) {
  b.border();
  b.fill(GT.concrete, 8, 4, 40, 21);
  b.fill(GT.cobble, 27, 10, 3, 28);
  b.fill(GT.cobble, 8, 21, 40, 2);
  b.fill(GT.sand, 3, 24, 19, 12);
  b.fill(GT.court, 38, 24, 15, 12);
  b.courtLines(38, 24, 15, 12);
  b.reserve(24, 11, 9, 14);

  b.place('school', 23, 9, 0);
  b.place('house', 6, 9, 4); b.place('house', 44, 9, 4);
  b.place('hoop', 39, 30, 0); b.place('hoop', 51, 30, 0);
  b.place('bleacher', 41, 23, 0, { on: [GT.concrete, GT.court, GT.grass] }); b.place('bleacher', 46, 23, 0, { on: [GT.concrete, GT.court, GT.grass] });
  b.place('swing', 5, 28, 0, { on: [GT.sand] }); b.place('swing', 11, 28, 0, { on: [GT.sand] });
  b.place('stall', 13, 17, 1); b.place('stall', 36, 17, 2);
  [[24, 16], [31, 16], [24, 28], [31, 28]].forEach(([x, y]) => b.place('bench', x, y, 0, { on: [GT.grass, GT.concrete] }));
  [[26, 12], [30, 12], [26, 24], [30, 24], [26, 34], [30, 34], [9, 13], [46, 13]].forEach(([x, y]) => b.place('lamp', x, y, 0, { on: [GT.grass, GT.concrete, GT.cobble] }));
  b.setBase(28, 14);
  b.setPlayerSpawn(25, 18);

  const area = [2, 2, 53, 37];
  b.scatter('tire', 11, [3, 24, 21, 35], { on: [GT.sand], gap: 0 });
  b.scatter('tree', 24, area, { v: [0, 1], on: [GT.grass] });
  b.scatter('palm', 6, area, { on: [GT.grass] });
  b.scatter('bush', 16, area, { on: [GT.grass, GT.concrete] });
  b.scatter('saging', 6, area, { on: [GT.grass] });
  b.scatter('barrel', 8, area, { on: OPEN });
  b.scatter('crates', 9, area, { on: OPEN });
  b.scatter('sako', 6, area, { on: OPEN });
}

function buildCourt(b) {
  b.border();
  b.fill(GT.concrete, 6, 4, 44, 32);
  b.fill(GT.court, 14, 12, 28, 16);
  b.courtLines(14, 12, 28, 16);
  b.reserve(14, 12, 28, 16);

  b.place('hoop', 15, 20, 0, { on: [GT.court] }); b.place('hoop', 40, 20, 0, { on: [GT.court] });
  [16, 24, 33].forEach(x => b.place('bleacher', x, 11, 0, { on: [GT.concrete, GT.court] }));
  [16, 24, 33].forEach(x => b.place('bleacher', x, 30, 0, { on: [GT.concrete, GT.court] }));
  [8, 13, 34, 40, 45].forEach((x, i) => { b.place('stall', x, 8, 0 + (i % 3)); b.place('stall', x, 34, (i + 1) % 3); });
  b.place('jeepney', 1, 16, 0); b.place('jeepney', 50, 16, 2); b.place('jeepney', 1, 26, 1); b.place('jeepney', 50, 26, 0);
  b.place('tricycle', 2, 21, 1); b.place('tricycle', 51, 21, 0);
  [[13, 11], [42, 11], [13, 28], [42, 28], [21, 7], [34, 7], [21, 33], [34, 33]].forEach(([x, y]) => b.place('lamp', x, y, 0, { on: [GT.concrete, GT.grass] }));
  b.setBase(28, 20);
  b.setPlayerSpawn(25, 21);

  const area = [2, 2, 53, 37];
  const off = { on: [GT.grass, GT.concrete] };
  b.scatter('tree', 18, [1, 1, 54, 38], { v: [0, 1], on: [GT.grass] });
  b.scatter('palm', 10, [1, 1, 54, 38], { on: [GT.grass] });
  b.scatter('bush', 10, area, off);
  b.scatter('saging', 6, area, { on: [GT.grass] });
  b.scatter('barrel', 13, area, off);
  b.scatter('crates', 13, area, off);
  b.scatter('sako', 10, area, off);
}

const MAPS = [
  { id: 'barangay', name: 'Barangay', sub: 'Filipino Neighborhood', seed: 11, unlock: 0, tint: { color: 0x2a1050, alpha: 0.16 },
    desc: 'Mga bahay, tindahan, at jeepney. Maraming taguan, malawak ang plaza.', build: buildBarangay },
  { id: 'school', name: 'Paaralan', sub: 'School Playground', seed: 23, unlock: 2, tint: { color: 0x000000, alpha: 0 },
    desc: 'Playground na may gulong at duyan. Matalas ang mata ni Taya sa harap ng paaralan.', build: buildSchool },
  { id: 'court', name: 'Basketball Court', sub: 'Barangay Court (Gabi)', seed: 37, unlock: 5, tint: { color: 0x050a34, alpha: 0.30 },
    desc: 'Gabi sa court. Nasa gitna ang bahay, kaya delikadong tumawid.', build: buildCourt }
];

// Build the full model for a map id.
function buildMap(id) {
  const def = MAPS.find(m => m.id === id);
  const b = new MapBuilder(def.id, MAP_COLS, MAP_ROWS, def.seed);
  def.build(b);
  return b.finish({ name: def.name, sub: def.sub, desc: def.desc, tint: def.tint, unlock: def.unlock });
}
