// Customize the hider: hoodie colour and accessory. Accessories unlock with stars.
class CustomizeScene extends Phaser.Scene {
  constructor() { super('Customize'); }

  create() {
    UI.fit(this);
    UI.nightSky(this);
    this.n = 0;
    UI.text(this, 480, 44, 'DAMIT', 34, '#ffffff', { title: true, stroke: '#0b1020', strokeW: 6 });
    const total = Save.totalStars();
    UI.icon(this, 'star', 836, 44, 28);
    UI.text(this, 880, 44, String(total), 24, '#ffe27a', { stroke: '#0b1020', strokeW: 3 });

    // preview
    UI.panel(this, 220, 290, 300, 380);
    this.add.ellipse(220, 440, 120, 22, 0x000000, 0.3);
    this.preview = this.add.sprite(220, 444, 'menu_hider', 0).setOrigin(0.5, 0.98).setScale(3.0);
    this.previewKey = null;
    this.tweens.add({ targets: this.preview, scaleY: 3.07, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // hoodie colours
    UI.panel(this, 690, 180, 440, 200);
    UI.text(this, 690, 106, 'Kulay ng Hoodie', 20, '#c9d2ff');
    this.swatches = [];
    HOODIES.forEach((h, i) => {
      const x = 540 + (i % 4) * 100, y = 158 + Math.floor(i / 4) * 82;
      const g = this.add.graphics();
      const draw = () => {
        g.clear();
        const sel = Save.data.outfit.hoodie === h.id;
        g.fillStyle(0x000000, 0.35); g.fillCircle(x + 1, y + 4, 29);
        g.fillStyle(Phaser.Display.Color.HexStringToColor(h.css).color, 1); g.fillCircle(x, y, 28);
        g.lineStyle(sel ? 5 : 3, sel ? 0xffffff : 0x0b1020, 1); g.strokeCircle(x, y, 28);
      };
      draw();
      const z = this.add.zone(x, y, 64, 64).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => Sfx.unlock());
      z.on('pointerup', () => { Sfx.play('click'); Save.data.outfit.hoodie = h.id; Save.write(); this.refresh(); });
      this.swatches.push(draw);
    });

    // accessories
    UI.panel(this, 690, 394, 440, 170);
    UI.text(this, 690, 330, 'Accessory', 20, '#c9d2ff');
    this.accChips = [];
    ACCESSORIES.forEach((a, i) => {
      const x = 560 + (i % 3) * 130, y = 372 + Math.floor(i / 3) * 66;
      const locked = !Save.isUnlockedAcc(a);
      const label = locked ? a.label + '  ' + a.stars + '★' : a.label;
      const chip = UI.chip(this, x, y, 122, 54, label, () => {
        if (locked) { Sfx.play('deny'); this.flash('Kailangan ng ' + a.stars + ' bituin'); return; }
        Save.data.outfit.acc = a.id; Save.write(); this.refresh();
      }, false);
      chip.label.setFontSize(locked ? 15 : 19);
      if (locked) chip.setEnabled(false);
      this.accChips.push([a, chip, locked]);
    });
    this.note = UI.text(this, 690, 462, '', 16, '#ffe27a');

    UI.button(this, 90, 498, 140, 52, 'BALIK', () => this.scene.start('Menu'), { size: 22, back: true, fill: 0x3a4278, icon: 'back' });
    this.refresh();
  }

  flash(msg) {
    this.note.setText(msg);
    this.time.delayedCall(1600, () => this.note && this.note.active && this.note.setText(''));
  }

  refresh() {
    this.swatches.forEach(d => d());
    this.accChips.forEach(([a, chip, locked]) => {
      if (!locked) chip.setFill(Save.data.outfit.acc === a.id ? PALETTE.blue : 0x3a4278);
    });
    // rebuild the preview sheet under a fresh key so the old texture can be dropped safely
    const key = 'prev_' + (this.n++);
    UI.sheetTexture(this, key, CharArt.makeSheet('hider', Save.data.outfit, ASSETS.anchors.hider));
    this.preview.setTexture(key, 0);
    if (this.previewKey && this.textures.exists(this.previewKey)) this.textures.remove(this.previewKey);
    this.previewKey = key;
    // the menu and game pick up the new outfit when they rebuild their own sheets
  }
}
