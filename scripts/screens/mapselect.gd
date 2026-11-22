extends Screen
## Choose a map and the difficulty.

var chips := {}

func build() -> void:
	Sfx.start_music("menu")
	title("PUMILI NG LUGAR")
	total_stars_chip(Vector2(860, 44))
	var total := Data.total_stars()
	var i := 0
	for m in Data.maps_meta:
		var id: String = m["id"]
		var x := 170.0 + i * 310.0
		var y := 270.0
		var locked: bool = total < int(m["unlock"])
		UI.panel(ui, Vector2(x, y), Vector2(276, 330), Cfg.PANEL, Color("4a4f66") if locked else Color("5f72c8"))
		var img := TextureRect.new()
		img.texture = Data.tex("res://art/maps/%s_mini.png" % id)
		img.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		img.stretch_mode = TextureRect.STRETCH_SCALE
		img.size = Vector2(240, 171)
		img.position = Vector2(x - 120, y - 150)
		ui.add_child(img)
		UI.text(ui, Vector2(x, y + 38), m["name"], 26, Color("8b93b8") if locked else Color.WHITE, {"w": 260})
		UI.text(ui, Vector2(x, y + 64), m["sub"], 15, Color("9fb0ff"), {"w": 260, "outline": 2})
		UI.text(ui, Vector2(x, y + 100), m["desc"], 13, Color("c9d2ff"), {"w": 240, "h": 50, "wrap": true, "outline": 2})
		var best := Data.best_stars(id)
		for s in 3:
			var st := UI.icon(ui, "star", Vector2(x - 34 + s * 34, y + 138), 28)
			if s >= best:
				st.modulate = Color(0.2, 0.22, 0.34)
		if locked:
			var shade := ColorRect.new()
			shade.color = Color(0.04, 0.06, 0.12, 0.62)
			shade.size = Vector2(276, 330)
			shade.position = Vector2(x - 138, y - 165)
			ui.add_child(shade)
			UI.icon(ui, "shield", Vector2(x, y - 20), 56)
			UI.text(ui, Vector2(x, y + 30), "Kailangan ng %d ★" % int(m["unlock"]), 20, Color("ffe27a"), {"w": 260})
			UI.text(ui, Vector2(x, y + 58), "(%d/%d)" % [total, int(m["unlock"])], 16, Color("c9d2ff"), {"w": 260})
			var lb := Button.new()
			lb.flat = true
			lb.size = Vector2(276, 330)
			lb.position = Vector2(x - 138, y - 165)
			lb.pressed.connect(func(): Sfx.play("deny"))
			ui.add_child(lb)
		else:
			var b := Button.new()
			b.flat = true
			b.focus_mode = Control.FOCUS_NONE
			b.size = Vector2(276, 330)
			b.position = Vector2(x - 138, y - 165)
			b.pressed.connect(func(): _start(id))
			ui.add_child(b)
		i += 1

	UI.text(ui, Vector2(340, 488), "Hirap:", 20, Color("c9d2ff"), {"w": 100})
	var j := 0
	for d in Cfg.DIFFICULTY_ORDER:
		var did: String = d
		var chip := UI.button(ui, Vector2(450 + j * 150, 488), Vector2(140, 44), Cfg.DIFFICULTY[did]["label"], func(): _set_diff(did), Cfg.BLUE if Data.save["settings"]["difficulty"] == did else Color("3a4278"), 20)
		chips[did] = chip
		j += 1
	back_button()

func _set_diff(id: String) -> void:
	Data.save["settings"]["difficulty"] = id
	Data.write_save()
	for k in chips:
		UI.set_fill(chips[k], Cfg.BLUE if k == id else Color("3a4278"))

func _start(map_id: String) -> void:
	Sfx.play("click")
	Sfx.stop_music()
	Nav.go("game", {"map_id": map_id, "difficulty": Data.save["settings"]["difficulty"]})
