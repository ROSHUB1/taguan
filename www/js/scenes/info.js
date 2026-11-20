// How to play and Settings.
class HowToScene extends Phaser.Scene {
  constructor() { super('HowTo'); }

  create() {
    UI.fit(this);
    UI.nightSky(this);
    UI.text(this, 480, 44, 'PAANO LARUIN', 34, '#ffffff', { title: true, stroke: '#0b1020', strokeW: 6 });
    const rows = [
      ['boot', 'Gumalaw', 'Hawakan at i-drag ang kaliwang bahagi ng screen. Dahan-dahan = sneak (tahimik). Hawak ang RUN = takbo, pero napapagod ka at maririnig ka ni Taya.'],
      ['shield', 'Magtago', 'Lumapit sa halaman, drum, kahon, sako, saging o gulong at pindutin ang TAGO. Huwag magtago habang nakatingin si Taya, kasi alam na niya kung nasaan ka.'],
      ['heart', '3 Buhay', 'Kapag nahuli ka, mawawalan ka ng puso at may sandaling proteksyon. Kapag naubos ang puso, talo ka. Kapag nahanap ka sa taguan, huli ka rin.'],
      ['star', 'Bahay (Save!)', 'Kapag nahuli ang mga kaibigan mo, pumunta sa bandila at pindutin ang SAVE! habang malayo si Taya. Makakalaya silang lahat.'],
      ['trophy', 'Manalo', 'Tumagal hanggang maubos ang oras. Mas maraming puso, mas maraming bituin. Ang bituin ay nag-a-unlock ng mapa at accessories.']
    ];
    rows.forEach((r, i) => {
      const y = 112 + i * 76;
      UI.panel(this, 480, y + 14, 860, 68, { r: 12 });
      UI.icon(this, r[0], 82, y + 14, 44);
      UI.text(this, 130, y - 4, r[1], 20, '#ffe27a', { ox: 0 });
      UI.text(this, 130, y + 28, r[2], 14, '#e3e8ff', { ox: 0, wrap: 760, bold: false, oy: 0.5 });
    });
    UI.button(this, 90, 498, 140, 52, 'BALIK', () => this.scene.start('Menu'), { size: 22, back: true, fill: 0x3a4278, icon: 'back' });
  }
}

class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }

  create() {
    UI.fit(this);
    UI.nightSky(this);
    UI.text(this, 480, 44, 'SETTINGS', 34, '#ffffff', { title: true, stroke: '#0b1020', strokeW: 6 });
    UI.panel(this, 480, 230, 560, 300);

    const S = Save.data.settings;
    const toggles = [['music', 'Music'], ['sfx', 'Sound effects'], ['vibrate', 'Vibration']];
    toggles.forEach(([key, label], i) => {
      const y = 126 + i * 70;
      UI.text(this, 260, y, label, 24, '#ffffff', { ox: 0 });
      const b = UI.button(this, 640, y, 130, 50, S[key] ? 'ON' : 'OFF', () => {
        S[key] = !S[key];
        b.setLabel(S[key] ? 'ON' : 'OFF');
        b.setFill(S[key] ? PALETTE.green : 0x6b2c3a);
        Save.write();
        Sfx.apply(S);
        if (key === 'music' && S.music) Sfx.startMusic('menu');
      }, { size: 22, fill: S[key] ? PALETTE.green : 0x6b2c3a });
    });

    const st = Save.data.stats;
    UI.text(this, 480, 330, 'Laro: ' + st.played + '   Panalo: ' + st.wins + '   Na-save: ' + st.saves + '   Huli: ' + st.caught, 17, '#c9d2ff');

    this.armed = false;
    const reset = UI.button(this, 480, 396, 300, 50, 'I-RESET ANG PROGRESS', () => {
      if (!this.armed) {
        this.armed = true;
        reset.setLabel('SIGURADO KA BA? PINDOT ULIT');
        reset.setFill(0x9a2a3a);
        this.time.delayedCall(3000, () => { if (reset.active) { this.armed = false; reset.setLabel('I-RESET ANG PROGRESS'); reset.setFill(0x3a4278); } });
      } else {
        Save.data = Save.defaults();
        Save.write();
        Sfx.apply(Save.data.settings);
        this.scene.restart();
      }
    }, { size: 17, fill: 0x3a4278 });

    UI.button(this, 90, 498, 140, 52, 'BALIK', () => this.scene.start('Menu'), { size: 22, back: true, fill: 0x3a4278, icon: 'back' });
  }
}
