extends Screen
## Music, effects, vibration and progress reset.

var armed := false

func build() -> void:
	Sfx.start_music("menu")
	title("SETTINGS")
	UI.panel(ui, Vector2(480, 230), Vector2(560, 300))
	var s: Dictionary = Data.save["settings"]
	var i := 0
	for t in [["music", "Music"], ["sfx", "Sound effects"], ["vibrate", "Vibration"]]:
		var key: String = t[0]
		var y := 126.0 + i * 70.0
		UI.text(ui, Vector2(260 + 150, y), t[1], 24, Color.WHITE, {"w": 300, "left": true})
		var b := UI.button(ui, Vector2(640, y), Vector2(130, 50), "ON" if s[key] else "OFF", func(): pass, Cfg.GREEN if s[key] else Color("6b2c3a"), 22)
		b.pressed.connect(func(): _toggle(key, b))
		i += 1
	var st: Dictionary = Data.save["stats"]
	UI.text(ui, Vector2(480, 330), "Laro: %d   Panalo: %d   Na-save: %d   Huli: %d" % [int(st["played"]), int(st["wins"]), int(st["saves"]), int(st["caught"])], 17, Color("c9d2ff"), {"w": 540})
	var reset: Button = UI.button(ui, Vector2(480, 396), Vector2(300, 50), "I-RESET ANG PROGRESS", func(): pass, Color("3a4278"), 17)
	reset.pressed.connect(func(): _reset(reset))
	back_button()

func _toggle(key: String, b: Button) -> void:
	var s: Dictionary = Data.save["settings"]
	s[key] = not s[key]
	b.text = "ON" if s[key] else "OFF"
	UI.set_fill(b, Cfg.GREEN if s[key] else Color("6b2c3a"))
	Data.write_save()
	Sfx.apply_settings()
	if key == "music" and s[key]:
		Sfx.start_music("menu")

func _reset(b: Button) -> void:
	if not armed:
		armed = true
		b.text = "SIGURADO KA BA? PINDOT ULIT"
		UI.set_fill(b, Color("9a2a3a"))
		get_tree().create_timer(3.0).timeout.connect(func():
			if is_instance_valid(b):
				armed = false
				b.text = "I-RESET ANG PROGRESS"
				UI.set_fill(b, Color("3a4278")))
	else:
		Data.reset_save()
		Sfx.apply_settings()
		Nav.go("settings")
