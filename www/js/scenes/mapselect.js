// Choose a map and difficulty.
class MapSelectScene extends Phaser.Scene {
  constructor() { super('MapSelect'); }

  create() {
    UI.fit(this);
    UI.nightSky(this);
    UI.text(this, 480, 44, 'PUMILI NG LUGAR', 34, '#ffffff', { title: true, stroke: '#0b1020', strokeW: 6 });

    const total = Save.totalStars();
    UI.icon(this, 'star', 836, 44, 28);
    UI.text(this, 880, 44, String(total), 24, '#ffe27a', { stroke: '#0b1020', strokeW: 3 });

    MAPS.forEach((def, i) => {
      const x = 170 + i * 310, y = 270;
      const locked = total < def.unlock;
      const key = 'mini_' + def.id;
      if (!this.textures.exists(key)) {
        const model = buildMap(def.id);
        UI.canvasTexture(this, key, MapRender.mini(model, 4));
      }
      UI.panel(this, x, y, 276, 330, { border: locked ? 0x4a4f66 : 0x5f72c8 });
      const img = this.add.image(x, y - 66, key);
      img.setDisplaySize(240, 240 * 160 / 224);
      UI.text(this, x, y + 38, def.name, 26, locked ? '#8b93b8' : '#ffffff', { title: true, stroke: '#0b1020', strokeW: 4 });
      UI.text(this, x, y + 64, def.sub, 15, '#9fb0ff');
      UI.text(this, x, y + 98, def.desc, 13, '#c9d2ff', { wrap: 240, align: 'center', bold: false, oy: 0.5 });

      const best = Save.data.stars[def.id] || 0;
      for (let s = 0; s < 3; s++) {
        const st = UI.icon(this, 'star', x - 34 + s * 34, y + 136, 28);
        if (s >= best) st.setTint(0x30344f);
      }

      if (locked) {
        this.add.rectangle(x, y, 276, 330, 0x0b1020, 0.62);
        UI.icon(this, 'shield', x, y - 20, 56).setAlpha(0.9);
        UI.text(this, x, y + 30, 'Kailangan ng ' + def.unlock + ' ★', 20, '#ffe27a', { stroke: '#0b1020', strokeW: 4 });
        UI.text(this, x, y + 58, '(' + total + '/' + def.unlock + ')', 16, '#c9d2ff');
        const z = this.add.zone(x, y, 276, 330).setInteractive();
        z.on('pointerup', () => Sfx.play('deny'));
      } else {
        const z = this.add.zone(x, y, 276, 330).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => Sfx.unlock());
        z.on('pointerup', () => { Sfx.play('click'); this.start(def.id); });
      }
    });

    // difficulty
    UI.text(this, 340, 488, 'Hirap:', 20, '#c9d2ff');
    this.chips = {};
    DIFFICULTY_ORDER.forEach((id, i) => {
      const chip = UI.chip(this, 450 + i * 150, 488, 140, 44, DIFFICULTY[id].label, () => this.setDiff(id), Save.data.settings.difficulty === id);
      this.chips[id] = chip;
    });

    UI.button(this, 90, 498, 140, 52, 'BALIK', () => this.scene.start('Menu'), { size: 22, back: true, fill: 0x3a4278, icon: 'back' });
  }

  setDiff(id) {
    Save.data.settings.difficulty = id;
    Save.write();
    DIFFICULTY_ORDER.forEach(k => this.chips[k].setSelected(k === id));
  }

  start(mapId) {
    Save.data.settings.difficulty = Save.data.settings.difficulty || 'normal';
    Sfx.stopMusic();
    this.scene.start('Game', { mapId, difficulty: Save.data.settings.difficulty });
  }
}
