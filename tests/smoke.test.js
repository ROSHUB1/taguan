// Smoke test: runs every scene against a fake Phaser (a recursive Proxy that accepts any call).
// It cannot check how things LOOK, but it does run all scene code paths and the whole game loop,
// so typos, undefined variables and bad logic show up here instead of on the phone.
// Run:  node tests/smoke.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { fakeStorage, test, assert, summary, WWW } = require('./loader');

// ---- fake Phaser
function any(name) {
  const f = function () {};
  const store = {};
  const p = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 1;
      if (k === 'then') return undefined;
      if (k in store) return store[k];
      if (k === 'active') return true;
      if (k === 'length') return 0;
      return any(name + '.' + String(k));
    },
    set(t, k, v) { store[k] = v; return true; },
    apply() { return any(name + '()'); },
    construct() { return any(name + ' new'); }
  });
  return p;
}

class FakeScene {
  constructor(key) {
    this.key = key;
    this.add = any('add');
    this.cameras = { main: any('camera') };
    this.input = { addPointer() {}, on() {}, once() {}, keyboard: { addKeys: () => keyState, on() {} } };
    this.scale = { width: 960, height: 540, on() {}, off() {} };
    this.events = { once() {}, on() {} };
    this.tweens = { add() {}, killTweensOf() {} };
    this.clock = 0;
    this.pending = [];
    this.time = {
      get now() { return 0; },
      delayedCall: (ms, fn) => { this.pending.push(fn); }
    };
    this.textures = { exists: () => false, remove() {}, addCanvas: () => any('tex'), addImage: () => any('tex') };
    this.started = [];
    this.launched = [];
    const self = this;
    this.scene = {
      start: (k, d) => self.started.push([k, d]),
      launch: (k, d) => self.launched.push([k, d]),
      stop() {}, pause() {}, resume() {}, restart() {},
      get: () => hudStub
    };
  }
}
const keyState = new Proxy({}, { get: () => ({ isDown: false }) });
const hudStub = { toast() {} };

const sandbox = {
  console, Math, Date, JSON, setInterval: () => 0, clearInterval() {}, setTimeout, navigator: {},
  window: { localStorage: fakeStorage() },
  document: {
    createElement: () => ({ width: 1, height: 1, getContext: () => any('ctx'), style: {} }),
    addEventListener() {}, hidden: false
  },
  Image: function () {},
  Phaser: {
    Scene: FakeScene, AUTO: 0, Scale: { RESIZE: 1 },
    Textures: { FilterMode: { NEAREST: 1, LINEAR: 0 } },
    Display: { Color: { ValueToColor: () => ({ darken: () => ({ color: 1, lighten: () => ({ color: 1 }) }), lighten: () => ({ color: 1 }), color: 1 }), HexStringToColor: () => ({ color: 1 }) } },
    Input: { Keyboard: { JustDown: () => false } },
    Game: function () {}
  }
};
sandbox.window.window = sandbox.window;
sandbox.window.AudioContext = undefined;
const ctx = vm.createContext(sandbox);

const files = ['config.js', 'data.js', 'assets.js', 'core/util.js', 'core/save.js', 'core/grid.js', 'core/seekerBrain.js', 'core/hiderBrain.js',
  'art/pixel.js', 'art/ground.js', 'art/objects.js', 'art/characters.js', 'art/mapRender.js', 'world/mapBuilder.js', 'world/maps.js',
  'audio.js', 'ui.js', 'scenes/boot.js', 'scenes/menu.js', 'scenes/mapselect.js', 'scenes/customize.js', 'scenes/info.js',
  'scenes/game.js', 'scenes/hud.js', 'scenes/result.js'];
let src = '';
for (const f of files) src += '\n;/* ' + f + ' */\n' + fs.readFileSync(path.join(WWW, 'js', f), 'utf8') + '\n';
src += '\n;({ CONFIG, DIFFICULTY, MAPS, Save, CTRL, Sfx, U, scenes: { BootScene, MenuScene, MapSelectScene, CustomizeScene, HowToScene, SettingsScene, GameScene, HudScene, ResultScene } });';
const G = vm.runInContext(src, ctx, { filename: 'bundle.js' });
G.Save.load();

function run(name, fn) { test(name, fn); }

// ---- simple menu scenes just need to build
for (const k of ['MenuScene', 'MapSelectScene', 'CustomizeScene', 'HowToScene', 'SettingsScene']) {
  run('build ' + k, () => { const s = new G.scenes[k](); s.create(); });
}
run('ResultScene builds (win, with unlocks)', () => {
  const s = new G.scenes.ResultScene();
  s.init({ won: true, stars: 3, reason: 'time', mapId: 'barangay', difficulty: 'normal', hearts: 2, freed: 3, friends: 5, caught: 1, saved: true, improved: true, unlocked: [G.CONFIG && { label: 'Cap' }] });
  s.create();
  s.pending.forEach(f => f());
});
run('ResultScene builds (loss)', () => {
  const s = new G.scenes.ResultScene();
  s.init({ won: false, stars: 0, reason: 'hearts', mapId: 'court', difficulty: 'hard', hearts: 0, freed: 0, friends: 7, caught: 3, saved: false, improved: false, unlocked: [] });
  s.create();
});

// ---- full games
function play(mapId, diffId, seed, style) {
  const g = new G.scenes.GameScene();
  g.init({ mapId, difficulty: diffId });
  g.create();
  const hud = new G.scenes.HudScene();
  Object.assign(hud, new FakeScene('HUD'));
  hud.init({ game: g });
  hud.create();
  g.scene.get = () => hud;
  const rnd = G.U.rng(seed);
  let ticks = 0, hides = 0, outs = 0, saves = 0, caught = 0;
  let dirX = 0, dirY = 0, dirT = 0;
  const maxTicks = 60 * 60 * 3.2;
  while (!g.over && ticks < maxTicks) {
    ticks++;
    // scripted player: wander, sometimes run, hide when a spot is near, come out later, save friends
    dirT -= 1;
    if (dirT <= 0) { const a = rnd() * Math.PI * 2; dirX = Math.cos(a); dirY = Math.sin(a); dirT = 30 + rnd() * 90; G.CTRL.runHeld = rnd() < 0.3; }
    if (style === 'hide' && g.ctx && g.ctx.kind === 'hide' && !g.player.hidden && rnd() < 0.3) { G.CTRL.action = true; hides++; }
    else if (g.player.hidden && rnd() < 0.004) { G.CTRL.action = true; outs++; }
    else if (g.ctx && g.ctx.kind === 'save') { G.CTRL.action = true; saves++; }
    G.CTRL.touchX = g.player.hidden ? 0 : dirX * (style === 'hide' ? 0.6 : 1);
    G.CTRL.touchY = g.player.hidden ? 0 : dirY * (style === 'hide' ? 0.6 : 1);
    g.update(ticks * 16.7, 16.7);
    hud.update();
    if (ticks % 200 === 0) g.pending.splice(0).forEach(f => { if (g.over) f(); });
  }
  g.pending.splice(0).forEach(f => f());
  // sanity of final state
  for (const e of [g.player, g.sk].concat(g.npcs)) {
    assert(Number.isFinite(e.x) && Number.isFinite(e.y), 'NaN position for ' + e.id);
    assert(!g.grid.solidAt(e.x, e.y) || e.hidden || e.gone, e.id + ' ended inside a solid tile at ' + Math.round(e.x) + ',' + Math.round(e.y));
  }
  return { over: g.over, ticks, hides, outs, saves, hearts: g.player.hearts, started: g.started.map(s => s[0]), timesCaught: g.timesCaught, freeNpcs: g.npcs.filter(e => !e.gone).length };
}

const combos = [];
for (const m of ['barangay', 'school', 'court']) for (const d of ['easy', 'normal', 'hard']) combos.push([m, d]);
combos.forEach(([m, d], i) => {
  run('full round ' + m + '/' + d + ' (wander)', () => {
    const r = play(m, d, 100 + i, 'wander');
    assert(r.over, 'round did not end in time');
    assert(r.started.includes('Result'), 'Result scene was not started');
  });
  run('full round ' + m + '/' + d + ' (hiding player)', () => {
    const r = play(m, d, 200 + i, 'hide');
    assert(r.over, 'round did not end in time');
    console.log('       ' + JSON.stringify(r));
  });
});

summary();

// ---- save flow: a caught friend is freed when the player shouts SAVE at base with Taya far away
run('catching and saving a friend', () => {
  const g = new G.scenes.GameScene();
  g.init({ mapId: 'barangay', difficulty: 'easy' });
  g.create();
  const e = g.npcs[0];
  g.catchEntity(e, false);
  assert(e.gone, 'friend should be caught');
  g.player.x = g.model.base.x + 20; g.player.y = g.model.base.y + 20;
  g.sk.x = g.model.base.x + 40; g.sk.y = g.model.base.y + 40;
  g.updateContext();
  assert(g.ctx && g.ctx.kind === 'save', 'SAVE context at base');
  g.doAction();
  assert(e.gone, 'Taya is too close: friend must stay caught');
  g.sk.x = g.model.base.x + 400; g.sk.y = g.model.base.y;
  g.doAction();
  assert(!e.gone && g.savedAny, 'friend freed');
});
run('player found in hiding loses a heart and gets out', () => {
  const g = new G.scenes.GameScene();
  g.init({ mapId: 'school', difficulty: 'normal' });
  g.create();
  const s = g.model.spots[0];
  g.player.x = s.ax; g.player.y = s.ay;
  g.updateContext(); g.doAction();
  assert(g.player.hidden, 'player hides');
  g.resolveSearch({ spotId: s.id, certain: true });
  assert(!g.player.hidden && g.player.hearts === 2 && g.player.invuln > 0, 'caught in hiding: heart lost');
});
summary();
