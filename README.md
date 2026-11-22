# TAGUAN (Godot 4)

Indie 2D hide-and-seek for Android, inspired by Filipino *tagu-taguan*. You are the Hider. **Taya** is the Seeker.
Made with Godot 4.4 (GDScript). GitHub Actions builds the APK, so you only need Termux and git.

## Game
- 3 Filipino maps: Barangay (dusk), Paaralan (school playground), Basketball Court (night). Maps unlock with stars.
- 3 difficulties (Madali / Katamtaman / Mahirap): Taya's speed, sight, hearing and the number of other kids change.
- Hide in bushes, saging, drums, crates, sacks and tires. Don't hide while Taya is watching.
- 3 hearts, stamina for running (running is noisy), sneak by moving the stick gently.
- Caught friends wait at the flag: reach it and press **SAVE!** while Taya is far away.
- Stars unlock accessories (salakot, cap, headphones, crown). 8 hoodie colours.
- All sound is synthesized in code. Settings: music, sfx, vibration. Progress is saved on the phone.

Phone controls: drag on the left = move, RUN = run, big round button = TAGO / LABAS / SAVE!, II = pause.
Desktop test: WASD/arrows, Shift run, Ctrl sneak, Space or E action, Esc pause.

## Get the APK (Termux)
1. Make a NEW empty GitHub repo (for example `taguan`). Do not reuse another project's repo.
2. In Termux, in this folder:
   ```
   git init
   git add .
   git commit -m "TAGUAN"
   git branch -M main
   git remote add origin https://github.com/<you>/taguan.git
   git push -u origin main
   ```
   Use a personal access token (scopes `repo` and `workflow`) as the password, never your account password.
3. GitHub, Actions tab, "Build Android APK (Godot)". After about 5-10 minutes download the `taguan-debug-apk` artifact, unzip, install `taguan.apk`.
4. The `build-logs` artifact has `smoke.log` (a headless self-test that plays full rounds on all 3 maps) and `export.log`. If something fails, send me those.

## Layout
```
project.godot, export_presets.cfg     engine and Android export settings
scenes/main.tscn                      only entry point; every screen is built in code
scripts/core/                         cfg.gd (all tuning numbers), grid.gd (collision + A*), seeker_brain.gd, hider_brain.gd
scripts/screens/                      menu, mapselect, customize, howto, settings, result
scripts/game.gd, hud.gd, actor.gd     the round, touch HUD, characters
scripts/data.gd, sfx.gd, nav.gd       autoloads: maps + save data, synthesized audio, screen switching
art/                                  characters (8 hoodies x 5 accessories), 38 object sprites, 3 maps, UI icons
data/                                 map and object data (json)
tools (in the old JS project)         export_godot.py regenerates art/ and data/
```
Tune the game in `scripts/core/cfg.gd`.
The debug APK is for testing; a Play Store release needs your own keystore.
