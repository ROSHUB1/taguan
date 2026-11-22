// End-of-round screen.
class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data) { this.r = data; }

  create() {
    const r = this.r;
    UI.fit(this);
    UI.nightSky(this);
    Sfx.startMusic('menu');

    UI.panel(this, 480, 270, 560, 440);
    UI.text(this, 480, 98, r.won ? 'NANALO KA!' : 'TALO...', 44, r.won ? '#9ff0b0' : '#ff8a8a', { title: true, stroke: '#0b1020', strokeW: 8 });
    UI.text(this, 480, 142, r.won ? 'Hindi ka nahanap ni Taya hanggang matapos ang oras.' : 'Naubos ang puso mo. Subukan ulit!', 16, '#c9d2ff', { wrap: 500, align: 'center' });

    // stars pop in one by one
    for (let i = 0; i < 3; i++) {
      const x = 380 + i * 100, y = 215;
      const star = UI.icon(this, 'star', x, y, 84);
      const earned = i < r.stars;
      if (!earned) star.setTint(0x2a2e48);
      star.setScale(0.01);
      this.time.delayedCall(400 + i * 450, () => {
        if (!star.active) return;
        this.tweens.add({ targets: star, scale: (84 / 64) * (earned ? 1.0 : 0.9), duration: 320, ease: 'Back.easeOut' });
        if (earned) Sfx.play('star');
      });
    }

    const lines = [
      'Puso na natira: ' + r.hearts + '/' + CONFIG.HEARTS,
      'Kaibigang malaya: ' + r.freed + '/' + r.friends + (r.saved ? '  (nag-SAVE ka!)' : ''),
      'Beses na nahuli: ' + r.caught
    ];
    lines.forEach((t, i) => UI.text(this, 480, 290 + i * 28, t, 19, '#ffffff', { stroke: '#0b1020', strokeW: 3 }));

    let note = '';
    if (r.improved) note = 'Bagong best sa mapang ito!';
    if (r.unlocked && r.unlocked.length) {
      note = 'Na-unlock: ' + r.unlocked.map(a => a.label).join(', ') + '!';
      this.time.delayedCall(1800, () => Sfx.play('unlock'));
    }
    if (note) UI.text(this, 480, 384, note, 20, '#ffe27a', { stroke: '#0b1020', strokeW: 4 });
    const def = MAPS.find(m => m.id === r.mapId);
    const next = MAPS[MAPS.indexOf(def) + 1];
    const nextOk = next && Save.totalStars() >= next.unlock;
    UI.text(this, 480, 418, def.name + '  •  ' + DIFFICULTY[r.difficulty].label, 15, '#9fb0ff');

    UI.button(this, 330, 470, 180, 56, 'ULIT', () => { Sfx.stopMusic(); this.scene.start('Game', { mapId: r.mapId, difficulty: r.difficulty }); }, { size: 24, fill: PALETTE.green });
    if (nextOk && r.won) {
      UI.button(this, 530, 470, 180, 56, 'SUSUNOD', () => { Sfx.stopMusic(); this.scene.start('Game', { mapId: next.id, difficulty: r.difficulty }); }, { size: 22 });
      UI.button(this, 706, 470, 120, 56, 'MENU', () => this.scene.start('MapSelect'), { size: 20, fill: 0x3a4278, back: true });
    } else {
      UI.button(this, 560, 470, 200, 56, 'MGA MAPA', () => this.scene.start('MapSelect'), { size: 22, fill: 0x3a4278, back: true });
    }
  }
}
