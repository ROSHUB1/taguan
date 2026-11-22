extends Screen
## Main menu.

func build() -> void:
	Sfx.start_music("menu")
	var hider := UI.char_sprite(ui, UI.outfit_sheet(), Vector2(150, 520), 3, 2.3)
	var seeker := UI.char_sprite(ui, UI.outfit_sheet("seeker"), Vector2(810, 520), 2, 2.3)
	UI.ellipse(ui, Vector2(150, 520), 46, 9, Color(0, 0, 0, 0.3))
	UI.ellipse(ui, Vector2(810, 520), 46, 9, Color(0, 0, 0, 0.3))
	ui.move_child(hider, ui.get_child_count() - 1)
	ui.move_child(seeker, ui.get_child_count() - 1)
	var i := 0
	for s in [hider, seeker]:
		var tw: Tween = s.create_tween().set_loops()
		tw.tween_property(s, "scale", Vector2(2.3, 2.36), 0.9 + i * 0.15).set_trans(Tween.TRANS_SINE)
		tw.tween_property(s, "scale", Vector2(2.3, 2.3), 0.9 + i * 0.15).set_trans(Tween.TRANS_SINE)
		i += 1

	var banner := TextureRect.new()
	banner.texture = Data.tex("res://art/ui/banner.png")
	banner.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	banner.stretch_mode = TextureRect.STRETCH_SCALE
	var bt: Texture2D = banner.texture
	banner.size = Vector2(520, 520.0 * bt.get_height() / bt.get_width())
	banner.position = Vector2(480 - 260, 118 - banner.size.y / 2.0)
	ui.add_child(banner)
	var btw := banner.create_tween().set_loops()
	btw.tween_property(banner, "position:y", banner.position.y + 6, 1.8).set_trans(Tween.TRANS_SINE)
	btw.tween_property(banner, "position:y", banner.position.y, 1.8).set_trans(Tween.TRANS_SINE)

	UI.button(ui, Vector2(480, 292), Vector2(320, 70), "MAGLARO", func(): Nav.go("mapselect"), Cfg.GREEN, 30, "play")
	UI.button(ui, Vector2(480, 366), Vector2(320, 58), "DAMIT", func(): Nav.go("customize"), Cfg.BLUE, 24, "shirt")
	UI.button(ui, Vector2(400, 436), Vector2(156, 54), "PAANO", func(): Nav.go("howto"), Color("3a4278"), 20)
	UI.button(ui, Vector2(560, 436), Vector2(156, 54), "SETTINGS", func(): Nav.go("settings"), Color("3a4278"), 20)
	total_stars_chip(Vector2(880, 36))
	UI.text(ui, Vector2(480, 516), "v1.0  •  Tagu-taguan, pero laro na!", 14, Color("7f8cc4"), {"outline": 2})
