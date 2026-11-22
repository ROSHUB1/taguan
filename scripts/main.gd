extends Node
## Entry point: apply saved settings and open the menu.
## `godot --headless --path . -- --smoke` runs a self-test instead (used by the GitHub build).

func _ready() -> void:
	Sfx.apply_settings()
	if "--smoke" in OS.get_cmdline_user_args():
		_smoke.call_deferred()
	else:
		Nav.go.call_deferred("menu")

func _frames(n: int = 2) -> void:
	for i in n:
		await get_tree().process_frame

func _smoke() -> void:
	print("SMOKE start")
	for s in ["menu", "mapselect", "customize", "howto", "settings"]:
		Nav.go(s)
		await _frames()
	Nav.go("result", {
		"won": true, "stars": 3, "map_id": "barangay", "difficulty": "normal", "hearts": 2, "freed": 3, "friends": 5,
		"caught": 1, "saved": true, "improved": true, "unlocked": [{"label": "Cap"}],
	})
	await _frames()
	var rnd := RandomNumberGenerator.new()
	rnd.seed = 5
	for map_id in ["barangay", "school", "court"]:
		for d in ["easy", "normal", "hard"]:
			Nav.go("game", {"map_id": map_id, "difficulty": d})
			await _frames()
			var g: Node = Nav.current
			var steps := 0
			var dir := Vector2.ZERO
			var did_hide := 0
			while not g.over and steps < 6000:
				if steps % 40 == 0:
					dir = Vector2.from_angle(rnd.randf() * TAU)
					g.hud.run_held = rnd.randf() < 0.3
				g.hud.move_vec = Vector2.ZERO if g.player.hidden else dir * 0.8
				if g.ctx != null and g.ctx["kind"] == "hide" and rnd.randf() < 0.05:
					g._do_action()
					did_hide += 1
				elif g.player.hidden and rnd.randf() < 0.004:
					g._do_action()
				elif g.ctx != null and g.ctx["kind"] == "save":
					g._do_action()
				g._process(0.05)
				steps += 1
			print("SMOKE %s/%s steps=%d over=%s hearts=%d hides=%d" % [map_id, d, steps, str(g.over), g.player.hearts, did_hide])
			await _frames()
	print("SMOKE OK")
	get_tree().quit()
