extends Screen
## End-of-round screen.

func build() -> void:
	var r: Dictionary = args
	Sfx.start_music("menu")
	var won: bool = r["won"]
	UI.panel(ui, Vector2(480, 270), Vector2(560, 440))
	UI.text(ui, Vector2(480, 98), "NANALO KA!" if won else "TALO...", 44, Color("9ff0b0") if won else Color("ff8a8a"), {"w": 540, "outline": 8})
	UI.text(ui, Vector2(480, 142), "Hindi ka nahanap ni Taya hanggang matapos ang oras." if won else "Naubos ang puso mo. Subukan ulit!", 16, Color("c9d2ff"), {"w": 500, "wrap": true, "h": 40, "outline": 2})

	for i in 3:
		var star := UI.icon(ui, "star", Vector2(380 + i * 100, 215), 84)
		var earned: bool = i < int(r["stars"])
		if not earned:
			star.modulate = Color(0.16, 0.18, 0.28)
		star.scale = Vector2(0.01, 0.01)
		get_tree().create_timer(0.4 + i * 0.45).timeout.connect(func():
			if not is_instance_valid(star):
				return
			var tw := star.create_tween()
			tw.tween_property(star, "scale", Vector2.ONE, 0.32).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
			if earned:
				Sfx.play("star"))

	var lines := [
		"Puso na natira: %d/%d" % [int(r["hearts"]), Cfg.HEARTS],
		"Kaibigang malaya: %d/%d%s" % [int(r["freed"]), int(r["friends"]), "  (nag-SAVE ka!)" if r["saved"] else ""],
		"Beses na nahuli: %d" % int(r["caught"]),
	]
	for i in lines.size():
		UI.text(ui, Vector2(480, 290 + i * 28), lines[i], 19, Color.WHITE, {"w": 500, "outline": 3})

	var note := ""
	if r["improved"]:
		note = "Bagong best sa mapang ito!"
	var unlocked: Array = r["unlocked"]
	if not unlocked.is_empty():
		var names: Array = []
		for a in unlocked:
			names.append(a["label"])
		note = "Na-unlock: %s!" % ", ".join(names)
		get_tree().create_timer(1.8).timeout.connect(func(): Sfx.play("unlock"))
	if note != "":
		UI.text(ui, Vector2(480, 384), note, 20, Color("ffe27a"), {"w": 520})
	var meta := Data.map_meta(r["map_id"])
	UI.text(ui, Vector2(480, 418), "%s  •  %s" % [meta["name"], Cfg.DIFFICULTY[r["difficulty"]]["label"]], 15, Color("9fb0ff"), {"w": 520, "outline": 2})

	# next map, when it is unlocked
	var next_id := ""
	for k in Data.maps_meta.size():
		if Data.maps_meta[k]["id"] == r["map_id"] and k + 1 < Data.maps_meta.size():
			var nm: Dictionary = Data.maps_meta[k + 1]
			if Data.total_stars() >= int(nm["unlock"]):
				next_id = nm["id"]
	UI.button(ui, Vector2(330, 470), Vector2(180, 56), "ULIT", func(): _play(r["map_id"], r["difficulty"]), Cfg.GREEN, 24)
	if won and next_id != "":
		UI.button(ui, Vector2(530, 470), Vector2(180, 56), "SUSUNOD", func(): _play(next_id, r["difficulty"]), Cfg.BLUE, 22)
		UI.button(ui, Vector2(706, 470), Vector2(120, 56), "MENU", func(): Nav.go("mapselect"), Color("3a4278"), 20, "", true)
	else:
		UI.button(ui, Vector2(560, 470), Vector2(200, 56), "MGA MAPA", func(): Nav.go("mapselect"), Color("3a4278"), 22, "", true)

func _play(map_id: String, difficulty: String) -> void:
	Sfx.stop_music()
	Nav.go("game", {"map_id": map_id, "difficulty": difficulty})
