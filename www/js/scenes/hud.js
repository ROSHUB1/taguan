// HUD scene: hearts, timer, minimap, joystick and buttons. Runs on top of the Game scene.
// It writes into CTRL (shared controls) and reads Game.hs (shared state).
class HudScene extends Phaser.Scene {
  constructor() { super('HUD'); }

  init(data) { this.gs = data.game; }

  create() {
    const gs = this.gs, hs = gs.hs, T = CONFIG.TILE;
    this.input.addPointer(2);
    this.cameras.main.setRoundPixels(false);
    UI.fit(this);
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.paused = false;

    // --- hearts
    this.heartsBox = this.add.container(0, 0);
    this.hearts = [];
    for (let i = 0; i < CONFIG.HEARTS; i++) {
      const h = UI.icon(this, 'heart', i * 36 + 18, 18, 32);
      this.heartsBox.add(h);
      this.hearts.push(h);
    }
    this.friendText = UI.text(this, 0, 0, '', 17, '#ffffff', { ox: 0, stroke: '#0b1020', strokeW: 4 });

    // --- timer
    this.timerBox = this.add.container(0, 0);
    this.timerBox.add(UI.panel(this, 0, 0, 120, 44, { r: 12, alpha: 0.85 }));
    this.timerText = UI.text(this, 0, 0, '0:00', 28, '#ffffff', { stroke: '#0b1020', strokeW: 4 });
    this.timerBox.add(this.timerText);

    // --- banner / toast
    this.banner = UI.text(this, 480, 200, '', 64, '#ffe27a', { title: true, stroke: '#0b1020', strokeW: 8 });
    this.bannerSub = UI.text(this, 480, 250, '', 22, '#ffffff', { stroke: '#0b1020', strokeW: 4 });
    this.toastText = UI.text(this, 480, 90, '', 20, '#ffffff', { stroke: '#0b1020', strokeW: 5, wrap: 640, align: 'center' });
    this.toastText.setAlpha(0);

    // --- pause button
    this.pauseBtn = UI.button(this, 0, 0, 56, 56, 'II', () => this.setPause(true), { size: 24, fill: 0x3a4278 });

    // --- minimap
    const mm = MapRender.mini(gs.model, 3);
    UI.canvasTexture(this, 'mini_hud', mm);
    this.miniBox = this.add.container(0, 0);
    this.mw = mm.width; this.mh = mm.height;
    this.miniBox.add(this.add.rectangle(0, 0, this.mw + 8, this.mh + 8, 0x0b1020, 0.9));
    this.miniBox.add(this.add.image(0, 0, 'mini_hud').setAlpha(0.9));
    this.dots = this.add.graphics();
    this.miniBox.add(this.dots);

    // --- RUN and ACTION buttons
    this.runBtn = this.makeRound(46, 'RUN', 0x2f6fe0, (down) => { CTRL.runHeld = down; });
    this.actBtn = this.makeRound(56, 'TAGO', 0x37b24d, (down) => { if (down) CTRL.action = true; });
    this.runRing = this.add.graphics();
    this.stickG = this.add.graphics();

    // --- touch joystick (left part of the screen)
    this.input.on('pointerdown', (p, over) => {
      if (this.paused || (over && over.length)) return;
      const q = this.cameras.main.getWorldPoint(p.x, p.y);
      if (q.x > this.b.cx + 40 || this.stick.id !== null) return;
      this.stick.id = p.id; this.stick.ox = q.x; this.stick.oy = q.y; this.stick.x = q.x; this.stick.y = q.y;
    });
    this.input.on('pointermove', (p) => {
      if (p.id !== this.stick.id) return;
      const q = this.cameras.main.getWorldPoint(p.x, p.y);
      this.stick.x = q.x; this.stick.y = q.y;
    });
    const release = (p) => {
      if (p.id !== this.stick.id) return;
      this.stick.id = null; CTRL.touchX = 0; CTRL.touchY = 0;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    // keyboard: Esc / P pause
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ESC', () => this.setPause(!this.paused));
      this.input.keyboard.on('keydown-P', () => this.setPause(!this.paused));
    }

    this.buildPauseMenu();
    this.layout();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      CTRL.touchX = 0; CTRL.touchY = 0; CTRL.runHeld = false; CTRL.action = false;
    });
    this.showBanner('Magtago na!', 'Nagbibilang si Taya...', 2200);
  }

  makeRound(r, label, color, onChange) {
    const c = this.add.container(0, 0);
    c.r = r; c.color = color;
    c.g = this.add.graphics();
    c.t = UI.text(this, 0, 0, label, r > 50 ? 22 : 20, '#ffffff', { stroke: '#0b1020', strokeW: 4 });
    c.add([c.g, c.t]);
    const z = this.add.zone(0, 0, r * 2.2, r * 2.2).setInteractive();
    c.add(z);
    c.state = 'up';
    c.enabled = true;
    c.redraw = () => {
      const g = c.g; g.clear();
      const col = c.enabled ? c.color : 0x4a4f66;
      const dy = c.state === 'down' ? 3 : 0;
      g.fillStyle(0x000000, 0.4); g.fillCircle(2, 6, r);
      g.fillStyle(c.state === 'down' ? Phaser.Display.Color.ValueToColor(col).darken(20).color : col, c.enabled ? 0.95 : 0.7);
      g.fillCircle(0, dy, r);
      g.fillStyle(0xffffff, 0.16); g.fillCircle(-r * 0.2, dy - r * 0.35, r * 0.55);
      g.lineStyle(4, 0x0b1020, 1); g.strokeCircle(0, dy, r);
    };
    c.redraw();
    z.on('pointerdown', () => { Sfx.unlock(); c.state = 'down'; c.redraw(); onChange(true); });
    const up = () => { if (c.state === 'down') { c.state = 'up'; c.redraw(); onChange(false); } };
    z.on('pointerup', up); z.on('pointerout', up); z.on('pointerupoutside', up);
    return c;
  }

  buildPauseMenu() {
    const c = this.pauseMenu = this.add.container(480, 270).setDepth(100).setVisible(false);
    c.add(this.add.rectangle(0, 0, 4000, 3000, 0x000000, 0.6).setInteractive());
    c.add(UI.panel(this, 0, 0, 380, 340));
    c.add(UI.text(this, 0, -118, 'PAUSE', 36, '#ffffff', { title: true, stroke: '#0b1020', strokeW: 6 }));
    c.add(UI.button(this, 0, -44, 280, 58, 'TULOY', () => this.setPause(false), { size: 26, fill: PALETTE.green }));
    c.add(UI.button(this, 0, 28, 280, 54, 'ULITIN', () => {
      const g = this.gs;
      this.scene.stop('Game'); this.scene.stop('HUD');
      this.scene.start('Game', { mapId: g.mapId, difficulty: g.diffId });
    }, { size: 22, fill: 0x3a4278 }));
    c.add(UI.button(this, 0, 96, 280, 54, 'LUMABAS', () => {
      Sfx.stopMusic();
      this.scene.stop('Game'); this.scene.stop('HUD');
      this.scene.start('MapSelect');
    }, { size: 22, fill: 0x6b2c3a, back: true }));
  }

  setPause(on) {
    if (on === this.paused || this.gs.over) return;
    this.paused = on;
    this.pauseMenu.setVisible(on);
    CTRL.touchX = 0; CTRL.touchY = 0; CTRL.runHeld = false; this.stick.id = null;
    if (on) { this.scene.pause('Game'); Sfx.stopMusic(); } else { this.scene.resume('Game'); Sfx.startMusic('game'); }
  }

  onResize() { UI.fit(this); this.layout(); }

  layout() {
    const b = this.b = UI.bounds(this);
    const m = 14;
    this.heartsBox.setPosition(b.l + m + 4, b.t + m);
    this.friendText.setPosition(b.l + m + 6, b.t + m + 46);
    this.timerBox.setPosition(b.cx, b.t + m + 24);
    this.pauseBtn.setPosition(b.r - m - 30, b.t + m + 30);
    this.miniBox.setPosition(b.r - m - this.mw / 2 - 4, b.t + m + 66 + this.mh / 2 + 4);
    this.runBtn.setPosition(b.r - 76, b.b - 80);
    this.actBtn.setPosition(b.r - 190, b.b - 112);
    this.banner.setPosition(b.cx, b.cy - 70);
    this.bannerSub.setPosition(b.cx, b.cy - 20);
    this.toastText.setPosition(b.cx, b.t + 96);
    this.defStick = { x: b.l + 120, y: b.b - 100 };
  }

  showBanner(text, sub, ms) {
    this.banner.setText(text).setAlpha(1);
    this.bannerSub.setText(sub || '').setAlpha(1);
    this.tweens.killTweensOf([this.banner, this.bannerSub]);
    this.tweens.add({ targets: [this.banner, this.bannerSub], alpha: 0, delay: ms, duration: 500 });
  }

  toast(msg, color) {
    if (!this.toastText || !this.toastText.active) return;
    this.toastText.setText(msg).setColor(color || '#ffffff').setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 2000, duration: 500 });
  }

  update() {
    const hs = this.gs.hs;
    if (!hs) return;

    // hearts
    this.hearts.forEach((h, i) => h.setAlpha(i < hs.hearts ? 1 : 0.22).setTint(i < hs.hearts ? 0xffffff : 0x222222));
    this.friendText.setText('Kaibigan: ' + hs.free + '/' + hs.total);
    // timer
    this.timerText.setText(U.fmtTime(hs.timeLeft));
    this.timerText.setColor(hs.timeLeft < 20 ? '#ff8a8a' : '#ffffff');

    // countdown banner while Taya counts
    if (hs.countdown > 0) {
      this.banner.setText(String(Math.ceil(hs.countdown))).setAlpha(1);
      this.bannerSub.setText('Magtago na! Nagbibilang si Taya...').setAlpha(1);
      this.tweens.killTweensOf([this.banner, this.bannerSub]);
      const n = Math.ceil(hs.countdown);
      if (n !== this._lastN) { this._lastN = n; if (n <= 3) Sfx.play('tick'); }
    } else if (this._lastN !== undefined && this._lastN !== 0) {
      this._lastN = 0;
      this.showBanner('GO!', '', 600);
    }

    // minimap dots
    const T = CONFIG.TILE, g = this.dots;
    g.clear();
    const s = 3 / T, ox = -this.mw / 2, oy = -this.mh / 2;
    const base = this.gs.model.base;
    g.fillStyle(0xf6c945, 1); g.fillRect(ox + base.x * s - 3, oy + base.y * s - 3, 6, 6);
    g.fillStyle(0xff4040, 1); g.fillCircle(ox + hs.seeker.x * s, oy + hs.seeker.y * s, 3.5);
    g.fillStyle(0xffffff, 1); g.fillCircle(ox + hs.player.x * s, oy + hs.player.y * s, 3);
    g.lineStyle(1, 0x0b1020, 1); g.strokeCircle(ox + hs.player.x * s, oy + hs.player.y * s, 3);

    // buttons
    const ctx = hs.ctx;
    this.actBtn.t.setText(ctx ? ctx.label : 'TAGO');
    this.actBtn.enabled = !!ctx;
    this.actBtn.color = ctx ? (ctx.kind === 'save' ? 0xe8a317 : (ctx.kind === 'out' ? 0x2f6fe0 : 0x37b24d)) : 0x37b24d;
    this.actBtn.redraw();
    this.actBtn.setAlpha(ctx ? 1 : 0.6);
    this.runBtn.enabled = !hs.exhausted;
    this.runBtn.redraw();
    this.runBtn.t.setText(hs.exhausted ? 'PAGOD' : 'RUN').setFontSize(hs.exhausted ? 16 : 20);

    // stamina ring around RUN
    const rg = this.runRing;
    rg.clear();
    const f = U.clamp(hs.stamina / CONFIG.STAMINA_MAX, 0, 1);
    rg.setPosition(this.runBtn.x, this.runBtn.y);
    rg.lineStyle(6, 0x000000, 0.35); rg.beginPath(); rg.arc(0, 0, 54, 0, Math.PI * 2); rg.strokePath();
    if (f > 0) {
      rg.lineStyle(6, hs.exhausted ? 0xe03131 : (f < 0.3 ? 0xf08c2a : 0x9ff0b0), 1);
      rg.beginPath(); rg.arc(0, 0, 54, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); rg.strokePath();
    }

    // joystick
    const st = this.stick, sg = this.stickG;
    sg.clear();
    const R = 58;
    if (st.id !== null) {
      let dx = st.x - st.ox, dy = st.y - st.oy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      CTRL.touchX = Math.abs(dx) / R < 0.12 ? 0 : dx / R;
      CTRL.touchY = Math.abs(dy) / R < 0.12 ? 0 : dy / R;
      sg.fillStyle(0xffffff, 0.14); sg.fillCircle(st.ox, st.oy, R + 6);
      sg.lineStyle(3, 0xffffff, 0.5); sg.strokeCircle(st.ox, st.oy, R + 6);
      sg.fillStyle(0xffffff, 0.55); sg.fillCircle(st.ox + dx, st.oy + dy, 26);
    } else if (this.defStick) {
      sg.fillStyle(0xffffff, 0.07); sg.fillCircle(this.defStick.x, this.defStick.y, R + 6);
      sg.lineStyle(3, 0xffffff, 0.22); sg.strokeCircle(this.defStick.x, this.defStick.y, R + 6);
      sg.fillStyle(0xffffff, 0.2); sg.fillCircle(this.defStick.x, this.defStick.y, 26);
    }
  }
}
