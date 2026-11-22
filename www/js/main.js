// Starts Phaser. Scenes are classic scripts, so they are plain globals here.
(function () {
  Save.load();
  Sfx.apply(Save.data.settings);

  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#121836',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    input: { activePointers: 3 },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    fps: { target: 60 },
    scene: [BootScene, MenuScene, MapSelectScene, CustomizeScene, HowToScene, SettingsScene, GameScene, HudScene, ResultScene]
  };
  window.TAGUAN = new Phaser.Game(config);

  // no long-press menu or text selection on phones
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  // pause audio when the app goes to the background
  document.addEventListener('visibilitychange', () => {
    try {
      if (!Sfx.ctx) return;
      if (document.hidden) Sfx.ctx.suspend(); else Sfx.ctx.resume();
    } catch (e) { /* ignore */ }
  });
})();
