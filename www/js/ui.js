// Shared UI helpers for the Phaser scenes: fitting the 960x540 design canvas to any screen, buttons, panels, icons.

// Live controls state, written by the HUD scene (touch) and the game scene (keyboard), read by the game.
const CTRL = {
  touchX: 0, touchY: 0,    // virtual joystick, -1..1
  runHeld: false,          // RUN button held
  action: false,           // set true for one frame when ACTION / HIDE / SAVE is pressed
  pause: false
};

const UI = {
  TEXT_RES: 3,             // text is rendered at 3x so it stays sharp when the camera zooms

  // Zoom the scene's camera so the 960x540 design canvas fits the screen. Returns visible bounds in design units.
  fit(scene) {
    const cam = scene.cameras.main;
    const W = scene.scale.width, H = scene.scale.height;
    const s = Math.min(W / CONFIG.DESIGN_W, H / CONFIG.DESIGN_H);
    cam.setZoom(s);
    cam.centerOn(CONFIG.DESIGN_W / 2, CONFIG.DESIGN_H / 2);
    return UI.bounds(scene);
  },

  bounds(scene) {
    const W = scene.scale.width, H = scene.scale.height;
    const s = Math.min(W / CONFIG.DESIGN_W, H / CONFIG.DESIGN_H);
    const cx = CONFIG.DESIGN_W / 2, cy = CONFIG.DESIGN_H / 2;
    return { s, l: cx - W / (2 * s), r: cx + W / (2 * s), t: cy - H / (2 * s), b: cy + H / (2 * s), w: W / s, h: H / s, cx, cy };
  },

  // Full-screen background that also covers the letterbox areas around the design canvas
  background(scene, color) {
    return scene.add.rectangle(CONFIG.DESIGN_W / 2, CONFIG.DESIGN_H / 2, 6000, 4000, color === undefined ? PALETTE.navy : color).setDepth(-1000);
  },

  text(scene, x, y, str, size, color, opts) {
    opts = opts || {};
    const style = {
      fontFamily: opts.title ? FONT.title : FONT.ui,
      fontSize: size + 'px',
      color: color || '#ffffff',
      fontStyle: opts.bold === false ? 'normal' : 'bold'
    };
    if (opts.stroke) { style.stroke = opts.stroke; style.strokeThickness = opts.strokeW || 4; }
    if (opts.wrap) style.wordWrap = { width: opts.wrap };
    if (opts.align) style.align = opts.align;
    const t = scene.add.text(x, y, str, style);
    t.setOrigin(opts.ox === undefined ? 0.5 : opts.ox, opts.oy === undefined ? 0.5 : opts.oy);
    t.setResolution(UI.TEXT_RES);
    if (opts.shadow) t.setShadow(0, 3, '#000000', 4, false, true);
    return t;
  },

  // Rounded panel drawn with Graphics (origin = centre)
  panel(scene, x, y, w, h, o) {
    o = o || {};
    const g = scene.add.graphics();
    g.setPosition(x, y);
    const r = o.r === undefined ? 14 : o.r;
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, r);
    g.fillStyle(o.fill === undefined ? PALETTE.panel : o.fill, o.alpha === undefined ? 0.96 : o.alpha);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.lineStyle(o.line === undefined ? 3 : o.line, o.border === undefined ? 0x5f72c8 : o.border, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    return g;
  },

  // Icon from the concept art icon sheet: play gear shirt trophy star back boot shield crown heart
  icon(scene, name, x, y, size) {
    const i = ASSET_META.icons.indexOf(name);
    const img = scene.add.image(x, y, 'icons', i);
    img.setDisplaySize(size, size);
    return img;
  },

  // A pressable button. Returns a container with .setLabel(), .setEnabled(), .setFill().
  button(scene, x, y, w, h, label, onClick, o) {
    o = o || {};
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    c._fill = o.fill === undefined ? PALETTE.blue : o.fill;
    c._enabled = true;
    const draw = (state) => {
      g.clear();
      const base = c._enabled ? c._fill : 0x4a4f66;
      const col = state === 'down' ? Phaser.Display.Color.ValueToColor(base).darken(18).color
        : state === 'over' ? Phaser.Display.Color.ValueToColor(base).lighten(10).color : base;
      const dy = state === 'down' ? 3 : 0;
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(-w / 2 + 2, -h / 2 + 6, w, h, 14);
      g.fillStyle(col, 1);
      g.fillRoundedRect(-w / 2, -h / 2 + dy, w, h, 14);
      g.fillStyle(0xffffff, 0.16);
      g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4 + dy, w - 8, h * 0.38, 10);
      g.lineStyle(3, o.border === undefined ? 0x0b1020 : o.border, 1);
      g.strokeRoundedRect(-w / 2, -h / 2 + dy, w, h, 14);
    };
    draw('up');
    const t = UI.text(scene, o.icon ? 14 : 0, 0, label, o.size || 24, '#ffffff', { stroke: '#0b1020', strokeW: 3 });
    c.add([g, t]);
    if (o.icon) {
      const ic = UI.icon(scene, o.icon, -w / 2 + 34, 0, Math.min(h - 14, 44));
      c.add(ic);
    }
    const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    c.add(zone);
    zone.on('pointerover', () => draw('over'));
    zone.on('pointerout', () => draw('up'));
    zone.on('pointerdown', () => { draw('down'); Sfx.unlock(); });
    zone.on('pointerup', () => {
      draw('over');
      if (!c._enabled) { Sfx.play('deny'); return; }
      Sfx.play(o.back ? 'back' : 'click');
      onClick();
    });
    c.setLabel = (s) => t.setText(s);
    c.setEnabled = (v) => { c._enabled = v; draw('up'); t.setAlpha(v ? 1 : 0.6); };
    c.setFill = (f) => { c._fill = f; draw('up'); };
    c.label = t;
    return c;
  },

  // Small round toggle chip (used for difficulty and settings)
  chip(scene, x, y, w, h, label, onClick, selected) {
    const b = UI.button(scene, x, y, w, h, label, onClick, { size: 20, fill: selected ? PALETTE.blue : 0x3a4278 });
    b.setSelected = (v) => b.setFill(v ? PALETTE.blue : 0x3a4278);
    return b;
  },

  // Make a texture from a canvas, replacing any older one with the same key.
  canvasTexture(scene, key, canvas, filter) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.addCanvas(key, canvas);
    tex.setFilter(filter === undefined ? Phaser.Textures.FilterMode.NEAREST : filter);
    return tex;
  },

  // Character sheets are 14 frames: add them by hand so numbered frame names work
  sheetTexture(scene, key, canvas) {
    const M = ASSET_META;
    const tex = UI.canvasTexture(scene, key, canvas, Phaser.Textures.FilterMode.LINEAR);
    for (let i = 0; i < 14; i++) tex.add(i, 0, (i % M.cols) * M.cellW, Math.floor(i / M.cols) * M.cellH, M.cellW, M.cellH);
    return tex;
  },

  // Starry night backdrop for menu scenes
  nightSky(scene) {
    UI.background(scene, 0x121836);
    const g = scene.add.graphics().setDepth(-900);
    g.fillStyle(0x1a2350, 1); g.fillRect(-1500, 300, 4000, 1500);
    g.fillStyle(0x222d66, 1); g.fillRect(-1500, 420, 4000, 1500);
    const rnd = U.rng(3);
    for (let i = 0; i < 90; i++) {
      const s = rnd() < 0.2 ? 3 : 2;
      g.fillStyle(0xffffff, 0.3 + rnd() * 0.6);
      g.fillRect(-300 + rnd() * 1560, -150 + rnd() * 450, s, s);
    }
    g.fillStyle(0xfff3c4, 1); g.fillCircle(820, 90, 34);
    g.fillStyle(0x121836, 1); g.fillCircle(836, 82, 30);
  }
};
