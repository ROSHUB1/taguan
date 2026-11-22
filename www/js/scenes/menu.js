// Main menu.
class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    UI.fit(this);
    UI.nightSky(this);
    Sfx.startMusic('menu');

    // the player's own hider (with their outfit) and Taya, idling on either side
    UI.sheetTexture(this, 'menu_hider', CharArt.makeSheet('hider', Save.data.outfit, ASSETS.anchors.hider));
    UI.sheetTexture(this, 'menu_seeker', CharArt.makeSheet('seeker', null, ASSETS.anchors.seeker));
    const hider = this.add.sprite(150, 520, 'menu_hider', 3).setOrigin(0.5, 0.98).setScale(2.3);
    const seeker = this.add.sprite(810, 520, 'menu_seeker', 2).setOrigin(0.5, 0.98).setScale(2.3);
    [hider, seeker].forEach((s, i) => this.tweens.add({ targets: s, scaleY: 2.3 * 1.025, duration: 900 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    this.add.ellipse(150, 520, 90, 18, 0x000000, 0.3).setDepth(-1);
    this.add.ellipse(810, 520, 90, 18, 0x000000, 0.3).setDepth(-1);

    const banner = this.add.image(480, 118, 'banner');
    banner.setDisplaySize(520, 520 * banner.height / banner.width);
    this.tweens.add({ targets: banner, y: 124, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    UI.button(this, 480, 292, 320, 70, 'MAGLARO', () => this.scene.start('MapSelect'), { icon: 'play', size: 30, fill: PALETTE.green });
    UI.button(this, 480, 366, 320, 58, 'DAMIT', () => this.scene.start('Customize'), { icon: 'shirt', size: 24 });
    UI.button(this, 400, 436, 156, 54, 'PAANO', () => this.scene.start('HowTo'), { size: 20, fill: 0x3a4278 });
    UI.button(this, 560, 436, 156, 54, 'SETTINGS', () => this.scene.start('Settings'), { size: 20, fill: 0x3a4278 });

    // total stars
    UI.panel(this, 880, 36, 130, 44, { r: 12 });
    UI.icon(this, 'star', 836, 36, 30);
    this.starText = UI.text(this, 888, 36, String(Save.totalStars()), 24, '#ffe27a', { stroke: '#0b1020', strokeW: 3 });

    UI.text(this, 480, 516, 'v1.0  •  Tagu-taguan, pero laro na!', 14, '#7f8cc4');

    // the first touch unlocks audio in the browser / WebView
    this.input.once('pointerdown', () => Sfx.unlock());
  }
}
