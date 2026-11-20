// The round itself: the world, the player, Taya, the other kids and the rules.
// The scene only moves bodies and applies events. Decisions are made by SeekerBrain / HiderBrain (core/).
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.mapId = (data && data.mapId) || 'barangay';
    this.diffId = (data && data.difficulty) || Save.data.settings.difficulty || 'normal';
  }

  create() {
    const T = CONFIG.TILE;
    const diff = this.diff = DIFFICULTY[this.diffId] || DIFFICULTY.normal;
    const model = this.model = buildMap(this.mapId);
    const grid = this.grid = model.grid;
    this.rnd = U.rng((Date.now() % 100000) + 7);
    model.spots.forEach(s => { s.owner = null; });
    this.spotById = {};
    model.spots.forEach(s => { this.spotById[s.id] = s; });

    this.over = false;
    this.time_ = 0;                    // seconds since Taya started hunting
    this.timeLeft = diff.time;
    this.timesCaught = 0;
    this.savedAny = false;
    this.footT = 0;
    this.tensionNow = 0;

    this.cameras.main.setBackgroundColor(0x0b1020);
    this.buildWorld();
    this.buildActors();
    this.buildInput();

    // camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, model.cols * T, model.rows * T);
    cam.setZoom(this.zoomFor());
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.roundPixels = true;
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      CTRL.touchX = 0; CTRL.touchY = 0; CTRL.runHeld = false; CTRL.action = false;
    });

    // shared state read by the HUD scene
    this.hs = {
      hearts: CONFIG.HEARTS, timeLeft: this.timeLeft, countdown: CONFIG.COUNTDOWN, stamina: 100, exhausted: false,
      ctx: null, free: 0, total: this.npcs.length, alert: 0, hidden: false,
      player: { x: 0, y: 0 }, seeker: { x: 0, y: 0 }, mapName: model.name
    };
    this.scene.launch('HUD', { game: this });
    Sfx.startMusic('game');
  }

  zoomFor() { return this.scale.height / CONFIG.VIEW_HEIGHT; }
  onResize() { this.cameras.main.setZoom(this.zoomFor()); }
  toast(msg, color) { const h = this.scene.get('HUD'); if (h && h.toast) h.toast(msg, color); }

  // ------------------------------------------------------------------ world
  buildWorld() {
    const T = CONFIG.TILE, model = this.model;
    UI.canvasTexture(this, 'ground_' + this.mapId, Ground.build(model));
    this.add.image(0, 0, 'ground_' + this.mapId).setOrigin(0).setDepth(-10);

    this.objs = [];
    this.spotImg = {};
    for (const o of model.objects) {
      const d = o.def;
      const key = 'obj_' + o.type + '_' + o.v;
      if (!this.textures.exists(key)) UI.canvasTexture(this, key, Objects.canvas(o.type, o.v), Phaser.Textures.FilterMode.LINEAR);
      const x0 = (o.tx - d.ax) * T, y0 = (o.ty - d.ay) * T;
      const img = this.add.image(x0, y0, key).setOrigin(0).setDisplaySize(d.w * T, d.h * T);
      const base = (o.ty + 1) * T;
      img.setDepth(base);
      this.objs.push({ img, d, x0, y0, w: d.w * T, h: d.h * T, base, fade: !!d.fade });
      if (o.spot) this.spotImg[o.spot.id] = img;
    }

    const tint = model.tint;
    if (tint && tint.alpha > 0) {
      this.add.rectangle(0, 0, model.cols * T, model.rows * T, tint.color, tint.alpha).setOrigin(0).setDepth(9000);
    }
    this.cone = this.add.graphics().setDepth(8000);
    this.hint = this.add.graphics().setDepth(8500);
    this.marker = this.add.graphics().setDepth(8600);
  }

  // ------------------------------------------------------------------ actors
  makeActor(sheetKey, x, y, id, kind) {
    const sprite = this.add.sprite(x, y, sheetKey, 0).setOrigin(0.5, 0.98).setScale(CONFIG.ACTOR_SCALE);
    const shadow = this.add.ellipse(x, y, 16, 6, 0x000000, 0.3);
    return {
      id, kind, x, y, hw: CONFIG.BODY_HW, hh: CONFIG.BODY_HH, sprite, shadow,
      face: 'down', animT: 0, hidden: false, gone: false, invuln: 0, noise: 0, spot: null
    };
  }

  buildActors() {
    const model = this.model, diff = this.diff;
    const A = ASSETS.anchors;

    // sheets
    UI.sheetTexture(this, 'g_player', CharArt.makeSheet('hider', Save.data.outfit, A.hider));
    UI.sheetTexture(this, 'g_seeker', CharArt.makeSheet('seeker', null, A.seeker));

    // player
    const p = this.player = this.makeActor('g_player', model.playerSpawn.x, model.playerSpawn.y, 'player', 'player');
    p.stamina = CONFIG.STAMINA_MAX; p.exhausted = false; p.regenDelay = 0; p.hearts = CONFIG.HEARTS;

    // Taya
    const sk = this.sk = this.makeActor('g_seeker', model.seekerStart.x, model.seekerStart.y, 'taya', 'seeker');
    sk.brain = new SeekerBrain(this.grid, diff, this.rnd);
    sk.face = 'up';
    sk.alertText = UI.text(this, sk.x, sk.y - 62, '', 26, '#ffffff', { stroke: '#0b1020', strokeW: 5, title: true }).setDepth(8700);
    sk.meter = this.add.graphics().setDepth(8700);

    // the other kids
    this.npcs = [];
    const spawns = U.shuffle(model.npcSpawns.slice(), this.rnd);
    const hoodies = HOODIES.filter(h => h.id !== Save.data.outfit.hoodie);
    const accs = ['none', 'none', 'salakot', 'cap'];
    const n = Math.min(diff.hiders, spawns.length);
    for (let i = 0; i < n; i++) {
      const h = hoodies[i % hoodies.length];
      const acc = accs[(i * 3 + 1) % accs.length];
      const key = 'g_npc_' + h.id + '_' + acc;
      if (!this.textures.exists(key)) UI.sheetTexture(this, key, CharArt.makeSheet('hider', { hoodie: h.id, acc }, A.hider));
      const e = this.makeActor(key, spawns[i].x, spawns[i].y, 'npc' + i, 'npc');
      e.name = NPC_NAMES[i % NPC_NAMES.length];
      e.brain = new HiderBrain(this.grid, this.rnd, e.id);
      this.npcs.push(e);
    }
    this.byId = { player: p };
    this.npcs.forEach(e => { this.byId[e.id] = e; });
  }

  // ------------------------------------------------------------------ input
  buildInput() {
    this.keys = null;
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,CTRL,C,SPACE,E');
    }
  }

  readMove() {
    const k = this.keys;
    let ix = 0, iy = 0, touch = false;
    if (k) {
      if (k.A.isDown || k.LEFT.isDown) ix -= 1;
      if (k.D.isDown || k.RIGHT.isDown) ix += 1;
      if (k.W.isDown || k.UP.isDown) iy -= 1;
      if (k.S.isDown || k.DOWN.isDown) iy += 1;
    }
    if (CTRL.touchX || CTRL.touchY) { ix = CTRL.touchX; iy = CTRL.touchY; touch = true; }
    const mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; }
    return { ix, iy, mag: Math.min(1, mag), touch };
  }

  // ------------------------------------------------------------------ main loop
  update(time, delta) {
    if (this.over) { this.updateVisuals(0.016, true); return; }
    const dt = Math.min(delta / 1000, 0.05);
    const diff = this.diff, T = CONFIG.TILE;
    const p = this.player, sk = this.sk;

    // timers
    if (sk.brain.state !== 'wait') {
      this.time_ += dt;
      this.timeLeft -= dt;
    }
    p.invuln = Math.max(0, p.invuln - dt);
    this.npcs.forEach(e => { e.invuln = Math.max(0, e.invuln - dt); });

    this.updatePlayer(dt);
    this.updateNpcs(dt);
    this.updateSeeker(dt);

    this.updateContext();
    this.updateHud();
    this.updateVisuals(dt, false);

    if (this.timeLeft <= 0) this.finish(true, 'time');
  }

  updatePlayer(dt) {
    const p = this.player, k = this.keys;
    // action button (touch) or Space / E
    let act = CTRL.action;
    CTRL.action = false;
    if (k && (Phaser.Input.Keyboard.JustDown(k.SPACE) || Phaser.Input.Keyboard.JustDown(k.E))) act = true;
    if (act) this.doAction();

    if (p.hidden) { p.noise = 0; return; }
    const m = this.readMove();
    const moving = m.mag > 0.12;
    const wantRun = moving && (CTRL.runHeld || (k && k.SHIFT.isDown));
    const wantSneak = moving && !wantRun && ((k && (k.CTRL.isDown || k.C.isDown)) || (m.touch && m.mag < 0.45));

    // stamina
    let run = wantRun && !p.exhausted && p.stamina > 0;
    if (run) {
      p.stamina -= CONFIG.STAMINA_DRAIN * dt;
      p.regenDelay = CONFIG.STAMINA_DELAY;
      if (p.stamina <= 0) { p.stamina = 0; p.exhausted = true; }
    } else {
      p.regenDelay -= dt;
      if (p.regenDelay <= 0) p.stamina = Math.min(CONFIG.STAMINA_MAX, p.stamina + CONFIG.STAMINA_REGEN * dt);
      if (p.exhausted && p.stamina >= CONFIG.STAMINA_MIN_RUN) p.exhausted = false;
    }

    const speed = !moving ? 0 : (run ? CONFIG.RUN : (wantSneak ? CONFIG.SNEAK : CONFIG.WALK));
    if (moving) {
      const len = Math.hypot(m.ix, m.iy) || 1;
      const dx = m.ix / len, dy = m.iy / len;
      this.grid.moveBox(p, dx * speed * dt, dy * speed * dt);
      this.setFace(p, dx, dy);
      this.animate(p, speed, dt);
    } else {
      this.animate(p, 0, dt);
    }
    p.speed = speed;
    // noise Taya can hear
    p.noise = run ? 130 * this.diff.hearRun : (speed >= CONFIG.WALK ? 70 * this.diff.hearWalk : 0);
    if (run) {
      this.footT -= dt;
      if (this.footT <= 0) { Sfx.play('step'); this.footT = 0.24; }
    }
  }

  updateNpcs(dt) {
    const sk = this.sk;
    for (const e of this.npcs) {
      if (e.gone) { e.noise = 0; continue; }
      const out = e.brain.update(dt, { time: this.time_, self: e, seeker: sk, spots: this.model.spots });
      for (const ev of out.events) this.onHiderEvent(e, ev);
      if (e.hidden) { e.noise = 0; continue; }
      if (out.speed > 0) {
        this.grid.moveBox(e, out.dx * out.speed * dt, out.dy * out.speed * dt);
        this.setFace(e, out.dx, out.dy);
      }
      this.animate(e, out.speed, dt);
      e.noise = out.speed > 120 ? 70 * this.diff.hearRun : 0;
    }
  }

  onHiderEvent(e, ev) {
    const spot = ev.spotId ? this.spotById[ev.spotId] : null;
    switch (ev.type) {
      case 'claim': if (spot) spot.owner = e.id; break;
      case 'release': if (spot && spot.owner === e.id) spot.owner = null; break;
      case 'hide':
        if (!spot) break;
        spot.owner = e.id;
        // if Taya was watching, she knows exactly where they went
        if (this.sk.brain.state !== 'wait' && this.sk.brain.state !== 'stunned' && this.sk.brain.state !== 'chase' && this.sk.brain.sees(this.sk, e)) {
          this.sk.brain.notifyHide(spot);
        }
        e.hidden = true; e.spot = spot;
        e.sprite.setVisible(false); e.shadow.setVisible(false);
        this.rustle(spot);
        if (U.dist(e.x, e.y, this.player.x, this.player.y) < 260) Sfx.play('hide');
        break;
      case 'unhide':
        e.hidden = false; e.spot = null;
        if (spot) { e.x = spot.ax; e.y = spot.ay; }
        e.sprite.setVisible(true); e.shadow.setVisible(true);
        this.rustle(spot);
        break;
      default: break;
    }
  }

  rustle(spot) {
    const img = spot && this.spotImg[spot.id];
    if (!img) return;
    const x = img.x;
    this.tweens.add({ targets: img, x: x + 2, duration: 55, yoyo: true, repeat: 3, onComplete: () => { img.x = x; } });
  }

  updateSeeker(dt) {
    const sk = this.sk, b = sk.brain;
    const targets = [this.player].concat(this.npcs).map(e => ({
      id: e.id, kind: e.kind, x: e.x, y: e.y, hidden: e.hidden, gone: e.gone, invuln: e.invuln > 0, noise: e.noise || 0
    }));
    const out = b.update(dt, { time: this.time_, self: sk, targets, spots: this.model.spots });
    if (out.speed > 0) {
      this.grid.moveBox(sk, out.dx * out.speed * dt, out.dy * out.speed * dt);
      this.setFace(sk, Math.cos(out.facing), Math.sin(out.facing));
    } else {
      this.setFace(sk, Math.cos(out.facing), Math.sin(out.facing));
    }
    this.animate(sk, out.speed, dt);
    sk.state = out.state; sk.sight = out.sight; sk.alert = out.alert; sk.facing = out.facing;

    for (const ev of out.events) {
      switch (ev.type) {
        case 'go':
          Sfx.play('go');
          this.toast('Taya: "Handa na ba kayo? Hahanapin ko na kayo!"', '#ffe27a');
          break;
        case 'spotted':
          if (ev.kind === 'player') { Sfx.play('spotted'); Sfx.vibrate(40); }
          break;
        case 'heard':
          if (ev.id === 'player') Sfx.play('heard');
          break;
        case 'catch': this.catchEntity(this.byId[ev.id], false); break;
        case 'search': this.resolveSearch(ev); break;
        default: break;
      }
    }
  }

  resolveSearch(ev) {
    const spot = this.spotById[ev.spotId];
    if (!spot || !spot.owner) return;
    const e = this.byId[spot.owner];
    if (!e || e.gone) return;
    const chance = (SPOT_TYPES[spot.type] ? SPOT_TYPES[spot.type].find : 0.4) * this.diff.find;
    if (ev.certain || this.rnd() < chance) {
      this.catchEntity(e, true);
      this.sk.brain.stun(this.diff.stun);
    } else if (e === this.player) {
      this.toast('Muntik na! Hindi ka nakita ni Taya.', '#9ff0b0');
      this.rustle(spot);
    }
  }

  // ------------------------------------------------------------------ catching and saving
  catchEntity(e, fromHiding) {
    if (!e || e.gone) return;
    const T = CONFIG.TILE;
    if (e.hidden) {
      const spot = e.spot;
      e.hidden = false;
      if (spot) { e.x = spot.ax; e.y = spot.ay; spot.owner = null; }
      e.spot = null;
      e.sprite.setVisible(true); e.shadow.setVisible(true);
      this.rustle(spot);
    }
    if (e === this.player) {
      this.timesCaught++;
      e.hearts--;
      e.invuln = CONFIG.INVULN;
      Sfx.play('hurt'); Sfx.vibrate(120);
      this.cameras.main.shake(200, 0.007);
      this.toast(fromHiding ? 'Nahanap ka sa taguan!' : 'Nahuli ka ni Taya!', '#ff8a8a');
      if (e.hearts <= 0) this.finish(false, 'hearts');
      return;
    }
    // a friend is caught: they wait by the flag until somebody shouts SAVE
    e.gone = true;
    if (e.spot) { e.spot.owner = null; e.spot = null; }
    e.brain = new HiderBrain(this.grid, this.rnd, e.id);
    Sfx.play('caught');
    this.toast(e.name + ' ay nahuli!', '#ffd27a');
    this.placeCaught();
  }

  placeCaught() {
    const base = this.model.base;
    const list = this.npcs.filter(e => e.gone);
    list.forEach((e, i) => {
      const a = (i / Math.max(1, list.length)) * Math.PI * 2 + 0.6;
      e.x = base.x + Math.cos(a) * 42;
      e.y = base.y + Math.sin(a) * 34 + 6;
      e.face = 'down';
      e.sprite.setTint(0x9aa4d6).setAlpha(0.85);
      e.frame = 0; e.bob = 0;
    });
  }

  saveFriends() {
    const caught = this.npcs.filter(e => e.gone);
    if (!caught.length) return;
    if (U.dist(this.sk.x, this.sk.y, this.model.base.x, this.model.base.y) <= CONFIG.BASE_SAFE_DIST) {
      Sfx.play('deny');
      this.toast('Masyadong malapit si Taya!', '#ff8a8a');
      return;
    }
    caught.forEach((e) => {
      e.gone = false;
      e.sprite.clearTint().setAlpha(1);
      e.brain = new HiderBrain(this.grid, this.rnd, e.id);
    });
    this.savedAny = true;
    Sfx.play('save'); Sfx.vibrate(60);
    this.toast('SAVE! Nakalaya ang ' + caught.length + ' kaibigan!', '#9ff0b0');
  }

  // ------------------------------------------------------------------ player action (hide / out / save)
  updateContext() {
    const p = this.player, base = this.model.base;
    let ctx = null;
    if (p.hidden) {
      ctx = { kind: 'out', label: 'LABAS' };
    } else {
      const caught = this.npcs.some(e => e.gone);
      if (caught && U.dist(p.x, p.y, base.x, base.y) <= CONFIG.BASE_RANGE) {
        ctx = { kind: 'save', label: 'SAVE!' };
      } else {
        let best = null, bd = CONFIG.HIDE_RANGE;
        for (const s of this.model.spots) {
          if (s.owner) continue;
          const d = U.dist(p.x, p.y, s.x, s.y);
          if (d < bd) { bd = d; best = s; }
        }
        if (best) ctx = { kind: 'hide', label: 'TAGO', spot: best };
      }
    }
    this.ctx = ctx;
  }

  doAction() {
    const c = this.ctx, p = this.player;
    if (!c) return;
    if (c.kind === 'save') { this.saveFriends(); return; }
    if (c.kind === 'out') {
      const s = p.spot;
      p.hidden = false;
      if (s) { p.x = s.ax; p.y = s.ay; s.owner = null; }
      p.spot = null;
      p.sprite.setVisible(true); p.shadow.setVisible(true);
      Sfx.play('unhide');
      this.rustle(s);
      return;
    }
    if (c.kind === 'hide') {
      const s = c.spot;
      if (s.owner) return;
      const b = this.sk.brain;
      if (b.state !== 'wait' && b.state !== 'stunned' && b.state !== 'chase' && b.sees(this.sk, p)) {
        b.notifyHide(s);
        this.toast('Nakita ka ni Taya na nagtago!', '#ff8a8a');
      }
      s.owner = 'player';
      p.hidden = true; p.spot = s;
      p.sprite.setVisible(false); p.shadow.setVisible(false);
      Sfx.play('hide');
      this.rustle(s);
    }
  }

  // ------------------------------------------------------------------ visuals
  setFace(e, dx, dy) {
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;
    e.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  animate(e, speed, dt) {
    let frame, bob = 0;
    if (speed > 1) {
      e.animT += dt * (speed / 11);
      if (e.face === 'right') frame = 4 + (Math.floor(e.animT) % 5);
      else if (e.face === 'left') frame = 9 + (Math.floor(e.animT) % 5);
      else { frame = e.face === 'down' ? 0 : 1; bob = Math.abs(Math.sin(e.animT * 1.3)) * 2; }
    } else {
      frame = { down: 0, up: 1, left: 2, right: 3 }[e.face];
    }
    e.frame = frame;
    e.bob = bob;
  }

  updateVisuals(dt, frozen) {
    const all = [this.player, this.sk].concat(this.npcs);
    const t = this.time.now;
    for (const e of all) {
      if (e.hidden) continue;
      if (e.frame === undefined) { e.frame = 0; e.bob = 0; }
      e.sprite.setFrame(e.frame);
      e.sprite.setPosition(Math.round(e.x), Math.round(e.y - e.bob));
      e.sprite.setDepth(e.y);
      e.shadow.setPosition(e.x, e.y).setDepth(e.y - 1);
      if (e.invuln > 0) e.sprite.setAlpha(Math.sin(t / 45) > 0 ? 1 : 0.3);
      else if (!e.gone) e.sprite.setAlpha(1);
    }

    // Taya: alert sign and sight meter
    const sk = this.sk;
    const a = sk.alert || 0;
    sk.alertText.setText(a === 2 ? '!' : (a === 1 ? '?' : ''));
    sk.alertText.setColor(a === 2 ? '#ff5a5a' : '#ffe27a');
    sk.alertText.setPosition(sk.x, sk.y - 62 - (a === 2 ? Math.sin(t / 70) * 2 : 0));
    sk.meter.clear();
    if (sk.sight > 0.04 && sk.state !== 'chase') {
      sk.meter.fillStyle(0x000000, 0.5); sk.meter.fillRect(sk.x - 12, sk.y - 52, 24, 4);
      sk.meter.fillStyle(0xffe27a, 1); sk.meter.fillRect(sk.x - 12, sk.y - 52, 24 * sk.sight, 4);
    }

    // vision cone
    const g = this.cone;
    g.clear();
    if (sk.state !== 'wait' && sk.state !== 'stunned') {
      const d = this.diff, fov = d.fov * Math.PI / 180;
      const a0 = (sk.facing || 0) - fov / 2;
      g.fillStyle(sk.state === 'chase' ? 0xff4040 : 0xffe27a, sk.state === 'chase' ? 0.2 : 0.15);
      g.beginPath();
      g.moveTo(sk.x, sk.y - 10);
      for (let i = 0; i <= 14; i++) {
        const ang = a0 + fov * i / 14;
        const len = this.grid.rayLength(sk.x, sk.y - 10, ang, d.vision);
        g.lineTo(sk.x + Math.cos(ang) * len, sk.y - 10 + Math.sin(ang) * len);
      }
      g.closePath();
      g.fillPath();
    }

    // hints: ring around the spot you can use, arrow over yourself, pulse on your hiding place
    const h = this.hint;
    h.clear();
    const pulse = 0.5 + 0.5 * Math.sin(t / 220);
    if (this.ctx && this.ctx.spot) {
      h.lineStyle(3, 0xffffff, 0.5 + 0.4 * pulse);
      h.strokeCircle(this.ctx.spot.x, this.ctx.spot.y, 17 + pulse * 2);
    }
    const p = this.player;
    if (p.hidden && p.spot) {
      h.lineStyle(3, 0x9ff0b0, 0.4 + 0.5 * pulse);
      h.strokeCircle(p.spot.x, p.spot.y, 18 + pulse * 3);
    }
    if (this.model.base) {
      const caught = this.npcs.some(e => e.gone);
      if (caught) {
        h.lineStyle(3, 0xffe27a, 0.4 + 0.5 * pulse);
        h.strokeCircle(this.model.base.x, this.model.base.y, CONFIG.BASE_RANGE - 4 + pulse * 3);
      }
    }
    const m = this.marker;
    m.clear();
    if (!p.hidden) {
      const mx = p.x, my = p.y - 58 + Math.sin(t / 200) * 2;
      m.fillStyle(0x000000, 0.45); m.fillTriangle(mx - 6, my - 1, mx + 6, my - 1, mx, my + 8);
      m.fillStyle(0xffffff, 1); m.fillTriangle(mx - 5, my - 3, mx + 5, my - 3, mx, my + 5);
    }

    // tall objects fade when the player is behind them
    for (const o of this.objs) {
      if (!o.fade) continue;
      const behind = p.x > o.x0 && p.x < o.x0 + o.w && p.y > o.y0 && p.y < o.base;
      const target = behind ? 0.42 : 1;
      o.img.alpha += (target - o.img.alpha) * 0.25;
    }
  }

  updateHud() {
    const hs = this.hs, p = this.player, sk = this.sk;
    hs.hearts = p.hearts;
    hs.timeLeft = Math.max(0, this.timeLeft);
    hs.countdown = sk.brain.state === 'wait' ? Math.max(0, sk.brain.waitT) : 0;
    hs.stamina = p.stamina; hs.exhausted = p.exhausted;
    hs.ctx = this.ctx;
    hs.free = this.npcs.filter(e => !e.gone).length;
    hs.alert = sk.alert || 0;
    hs.hidden = p.hidden;
    hs.player.x = p.x; hs.player.y = p.y; hs.seeker.x = sk.x; hs.seeker.y = sk.y;
    // music gets faster as the round runs out and when Taya is chasing
    const prog = 1 - this.timeLeft / this.diff.time;
    const target = sk.state === 'chase' ? 1 : U.clamp(0.15 + prog * 0.6, 0, 0.8);
    this.tensionNow += (target - this.tensionNow) * 0.03;
    Sfx.tension = this.tensionNow;
  }

  // ------------------------------------------------------------------ end of round
  finish(won, reason) {
    if (this.over) return;
    this.over = true;
    const p = this.player;
    const stillCaught = this.npcs.filter(e => e.gone).length;
    let stars = 0;
    if (won) stars = 1 + (p.hearts >= 2 ? 1 : 0) + (stillCaught === 0 ? 1 : 0);
    Sfx.stopMusic();
    Sfx.play(won ? 'win' : 'lose');
    this.toast(won ? 'Tapos ang oras! Nanalo ka!' : 'Naubos ang puso mo...', won ? '#9ff0b0' : '#ff8a8a');
    this.time.delayedCall(1500, () => {
      const res = Save.recordRound(this.mapId, won, stars, this.savedAny, this.timesCaught);
      this.scene.stop('HUD');
      this.scene.start('Result', {
        won, stars, reason, mapId: this.mapId, difficulty: this.diffId,
        hearts: p.hearts, freed: this.npcs.length - stillCaught, friends: this.npcs.length,
        caught: this.timesCaught, saved: this.savedAny, improved: res.improved, unlocked: res.unlocked
      });
    });
  }
}
