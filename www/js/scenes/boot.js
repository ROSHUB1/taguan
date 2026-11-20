// Boot: decodes the embedded art, registers textures, then opens the menu.
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    UI.fit(this);
    UI.background(this, 0x121836);
    const msg = UI.text(this, 480, 270, 'TAGUAN', 54, '#ffffff', { title: true, stroke: '#0b1020', strokeW: 8 });
    const sub = UI.text(this, 480, 330, 'Naglo-load...', 22, '#9fb0ff');

    const load = (src, name) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Hindi ma-load ang ' + name));
      img.src = src;
    });

    Promise.all([
      load(ASSETS.hider, 'hider'), load(ASSETS.seeker, 'seeker'),
      load(ASSETS.icons, 'icons'), load(ASSETS.banner, 'banner')
    ]).then(([hider, seeker, icons, banner]) => {
      CharArt.images.hider = hider;
      CharArt.images.seeker = seeker;
      this.textures.addImage('banner', banner);
      const tex = this.textures.addImage('icons', icons);
      const s = ASSET_META.iconSize;
      ASSET_META.icons.forEach((n, i) => tex.add(i, 0, i * s, 0, s, s));
      this.scene.start('Menu');
    }).catch((e) => {
      msg.setText('Error');
      sub.setText(String(e && e.message || e));
    });
  }
}
