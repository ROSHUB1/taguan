extends Node
## Autoload "Sfx": every sound effect and the music are synthesized in code at start-up (no audio files).

const RATE := 22050
const MUSIC_RATE := 11025

var music_on := true
var sfx_on := true
var vibrate_on := true
var tension := 0.0            # 0..1, speeds up the game music

var _streams := {}
var _pool: Array = []
var _pool_i := 0
var _music: AudioStreamPlayer
var _music_mode := ""
var _music_cache := {}

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in 8:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_pool.append(p)
	_music = AudioStreamPlayer.new()
	_music.volume_db = -9.0
	add_child(_music)
	_build_effects()

func apply_settings() -> void:
	var s: Dictionary = Data.save["settings"]
	music_on = bool(s["music"])
	sfx_on = bool(s["sfx"])
	vibrate_on = bool(s["vibrate"])
	if not music_on:
		_music.stop()
	elif _music_mode != "":
		start_music(_music_mode)

func vibrate(ms: int) -> void:
	if vibrate_on:
		Input.vibrate_handheld(ms)

func play(sound: String) -> void:
	if not sfx_on or not _streams.has(sound):
		return
	var p: AudioStreamPlayer = _pool[_pool_i]
	_pool_i = (_pool_i + 1) % _pool.size()
	p.stream = _streams[sound]
	p.play()

func start_music(mode: String) -> void:
	_music_mode = mode
	if not music_on:
		return
	if not _music_cache.has(mode):
		_music_cache[mode] = _render_music(mode)
	if _music.stream != _music_cache[mode] or not _music.playing:
		_music.stream = _music_cache[mode]
		_music.play()

func stop_music() -> void:
	_music_mode = ""
	_music.stop()

func _process(_dt: float) -> void:
	if _music.playing:
		_music.pitch_scale = 1.0 + 0.22 * tension if _music_mode == "game" else 1.0

# ------------------------------------------------------------------ synthesis
## note = [freq, duration, wave, volume, start, slide_to]   wave: "sine" "square" "saw" "tri" "noise"
func _render(notes: Array, total: float, rate: int) -> PackedFloat32Array:
	var n := int(total * rate)
	var buf := PackedFloat32Array()
	buf.resize(n)
	var noise_state := 0.0
	for note in notes:
		var f0: float = note[0]
		var dur: float = note[1]
		var wave: String = note[2]
		var vol: float = note[3]
		var start: float = note[4]
		var f1: float = note[5] if note.size() > 5 and note[5] > 0.0 else f0
		var i0 := int(start * rate)
		var cnt := int(dur * rate)
		var phase := 0.0
		for k in cnt:
			var idx := i0 + k
			if idx >= n:
				break
			var t := float(k) / cnt
			var f := f0 + (f1 - f0) * t
			phase += f / rate
			var ph := phase - floorf(phase)
			var s := 0.0
			match wave:
				"sine":
					s = sin(ph * TAU)
				"square":
					s = 1.0 if ph < 0.5 else -1.0
				"saw":
					s = ph * 2.0 - 1.0
				"tri":
					s = 4.0 * absf(ph - 0.5) - 1.0
				"noise":
					noise_state = noise_state * 0.6 + (randf() * 2.0 - 1.0) * 0.4
					s = noise_state * 2.0
			var attack := minf(1.0, float(k) / (0.012 * rate))
			var env := attack * (1.0 - t) * (1.0 - t)
			buf[idx] += s * vol * env
	return buf

func _wav(buf: PackedFloat32Array, rate: int, loop: bool = false) -> AudioStreamWAV:
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = rate
	w.stereo = false
	var bytes := PackedByteArray()
	bytes.resize(buf.size() * 2)
	for i in buf.size():
		bytes.encode_s16(i * 2, int(clampf(buf[i], -1.0, 1.0) * 32000.0))
	w.data = bytes
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = buf.size()
	return w

func _fx(sound: String, notes: Array, total: float) -> void:
	_streams[sound] = _wav(_render(notes, total, RATE), RATE)

func _build_effects() -> void:
	_fx("click", [[880.0, 0.05, "square", 0.25, 0.0]], 0.08)
	_fx("back", [[520.0, 0.07, "square", 0.25, 0.0]], 0.1)
	_fx("step", [[700.0, 0.04, "noise", 0.3, 0.0]], 0.06)
	_fx("hide", [[1900.0, 0.28, "noise", 0.4, 0.0], [300.0, 0.18, "sine", 0.3, 0.0, 180.0]], 0.32)
	_fx("unhide", [[1400.0, 0.18, "noise", 0.35, 0.0]], 0.22)
	_fx("heard", [[330.0, 0.12, "tri", 0.3, 0.0]], 0.15)
	_fx("spotted", [[660.0, 0.12, "square", 0.3, 0.0], [990.0, 0.2, "square", 0.3, 0.1]], 0.35)
	_fx("hurt", [[240.0, 0.4, "saw", 0.4, 0.0, 70.0], [500.0, 0.3, "noise", 0.3, 0.0]], 0.45)
	_fx("tick", [[1000.0, 0.05, "square", 0.2, 0.0]], 0.08)
	_fx("go", [[523.0, 0.14, "square", 0.25, 0.0], [659.0, 0.14, "square", 0.25, 0.07], [784.0, 0.2, "square", 0.25, 0.14]], 0.4)
	_fx("caught", [[520.0, 0.1, "square", 0.25, 0.0], [390.0, 0.18, "square", 0.25, 0.09]], 0.3)
	_fx("win", [[523.0, 0.22, "tri", 0.4, 0.0], [659.0, 0.22, "tri", 0.4, 0.13], [784.0, 0.22, "tri", 0.4, 0.26], [1047.0, 0.4, "tri", 0.4, 0.39]], 0.85)
	_fx("lose", [[392.0, 0.4, "saw", 0.3, 0.0, 196.0], [262.0, 0.6, "saw", 0.3, 0.35, 131.0]], 1.0)
	_fx("save", [[659.0, 0.18, "tri", 0.4, 0.0], [784.0, 0.18, "tri", 0.4, 0.08], [988.0, 0.18, "tri", 0.4, 0.16], [1319.0, 0.3, "tri", 0.4, 0.24]], 0.6)
	_fx("star", [[1175.0, 0.2, "tri", 0.4, 0.0], [1568.0, 0.3, "tri", 0.35, 0.08]], 0.45)
	_fx("unlock", [[784.0, 0.2, "sine", 0.4, 0.0], [988.0, 0.2, "sine", 0.4, 0.09], [1175.0, 0.2, "sine", 0.4, 0.18], [1568.0, 0.35, "sine", 0.4, 0.27]], 0.7)
	_fx("deny", [[180.0, 0.15, "square", 0.25, 0.0]], 0.2)

func _render_music(mode: String) -> AudioStreamWAV:
	var a := [220.0, 261.63, 293.66, 329.63, 392.0]       # A minor pentatonic
	var notes: Array = []
	if mode == "menu":
		var step := 0.36
		var pat := [0, 2, 4, 2, 3, 1, 2, 0]
		for i in 16:
			var f: float = a[pat[i % 8]] * (2.0 if i >= 8 else 1.0)
			notes.append([f, step * 1.8, "tri", 0.2, i * step])
			if i % 8 == 0:
				notes.append([110.0, step * 6.0, "sine", 0.28, i * step])
		return _wav(_render(notes, 16 * step, MUSIC_RATE), MUSIC_RATE, true)
	var step2 := 0.34
	for i in 16:
		if i % 2 == 0:
			notes.append([55.0 if i % 8 == 0 else 58.3, step2 * 1.4, "sine", 0.3, i * step2])
		if i % 4 == 3:
			notes.append([a[(i * 7) % 5] * 2.0, step2 * 2.0, "tri", 0.1, i * step2])
		if i % 2 == 1:
			notes.append([440.0, 0.07, "saw", 0.05, i * step2])
	return _wav(_render(notes, 16 * step2, MUSIC_RATE), MUSIC_RATE, true)
