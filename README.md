# TAGUAN

Indie 2D hide-and-seek for Android, inspired by Filipino *tagu-taguan*. You are the Hider. **Taya** is the Seeker.
Phaser 3 + Capacitor. The Android APK is built by GitHub Actions, so you only need Termux and git.

## Game
- 3 Filipino maps: Barangay (dusk), Paaralan (school playground), Basketball Court (night). Maps unlock with stars.
- 3 difficulties (Madali / Katamtaman / Mahirap): Taya's speed, sight, hearing and the number of other kids change.
- Hide in bushes, saging, drums, crates, sacks and tires. Don't hide while Taya is watching.
- 3 hearts, stamina for running (running makes noise), sneak when moving the stick gently.
- Other kids get caught: run to the flag and press **SAVE!** while Taya is far away.
- Stars (max 3 per map) unlock accessories (salakot, cap, headphones, crown). 8 hoodie colours.
- All sound is synthesized (no audio files). Settings: music, sfx, vibration.

Controls on phone: drag on the left side = move, RUN (right) = run, big button = TAGO / LABAS / SAVE!.
Keyboard (desktop test): WASD/arrows, Shift run, Ctrl sneak, Space or E action, Esc pause.

## Get the APK (Termux)
1. Make a NEW empty repo on GitHub (for example `taguan`). Do not reuse another project's repo.
2. In Termux, in this folder:
   ```
   git init
   git add .
   git commit -m "TAGUAN"
   git branch -M main
   git remote add origin https://github.com/<you>/taguan.git
   git push -u origin main
   ```
   Use a personal access token (scopes: `repo` and `workflow`) as the password, not your account password.
3. GitHub, Actions tab, "Build Android APK". When it finishes (about 6-10 minutes) download the `taguan-debug-apk` artifact, unzip it, install `app-debug.apk`.

## Project layout
```
www/                 the game (this is what ends up inside the APK)
  index.html         script order
  js/config.js       all tuning numbers (speeds, hearts, difficulty, accessories)
  js/core/           pure logic, no Phaser: grid + A*, SeekerBrain, HiderBrain, save data
  js/art/            canvas pixel art: ground, objects (houses, jeepney, saging...), characters, map render
  js/world/          map builder and the 3 map recipes
  js/assets.js       sprites and icons cut from the concept art (generated, base64)
  js/audio.js        WebAudio sfx + music
  js/scenes/         boot, menu, mapselect, customize, info (how to / settings), game, hud, result
tools/build_assets.py   regenerates assets.js and launcher icons from reference/*.png
android-res/        launcher icons copied into the Android project by CI
scripts/            copy-phaser.js (offline Phaser), patch-android.js (icons, landscape, fullscreen)
tests/              node tests: core logic, maps, and a full-round smoke test with a fake Phaser
```

## Dev
- `npm install` then `npm test` (logic, maps, scene smoke tests).
- Open `www/index.html` in a browser after `npm install` to play on desktop.
- Tune the game in `www/js/config.js`. Add a map in `www/js/world/maps.js`.
- Debug APK is unsigned for the Play Store. A release build needs your own keystore.
