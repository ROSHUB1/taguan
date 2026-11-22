extends Node2D
## The round itself: the world, the player, Taya and the other kids.
## Taya and the other kids are driven by SeekerBrain / HiderBrain (core/); this script moves bodies and
## applies the rules (catching, hiding, saving, hearts, timer).

var args := {}
var map_id := ""
var diff_id := ""
var diff: Dictionary
var map: Dictionary
var grid: Grid
var rnd := RandomNumberGenerator.new()

var world: Node2D
var overlay: Node2D
var cam: Camera2D
var hud: Node

var player: Actor
var taya: Actor
var npcs: Array = []
var by_id := {}
var spot_by_id := {}
var spot_sprite := {}
var fade_objs: Array = []

var over := false
var game_time := 0.0
var time_left := 0.0
var times_caught := 0
var saved_any := false
var foot_t := 0.0
var tension_now := 0.0
var ctx = null
var _prev_keys := {}
var result_args := {}

func _ready() -> void:
	map_id = args.get("map_id", "barangay")
	diff_id = args.get("difficulty", "normal")
	diff = Cfg.DIFFICULTY[diff_id]
	map = Data.build_map(map_id)
	grid = map["grid"]
	rnd.randomize()
	for s in map["spots"]:
		spot_by_id[s["id"]] = s
	time_left = diff["time"]
	RenderingServer.set_default_clear_color(Color("0b1020"))
	_build_world()
	_build_actors()
	_build_camera()
	var hud_script: GDScript = load("res://scripts/hud.gd")
	hud = hud_script.new()
	hud.set("game", self)
	add_child(hud)
	Sfx.start_music("game")
	Sfx.tension = 0.0

# ------------------------------------------------------------------ building
func _build_world() -> void:
	var T := Cfg.TILE
	world = Node2D.new()
	add_child(world)
	var ground := Sprite2D.new()
	ground.texture = Data.tex("res://art/maps/%s_ground.png" % map_id)
	ground.centered = false
	ground.z_index = -100
	ground.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	world.add_child(ground)

	for o in map["objects"]:
		var d: Dictionary = Data.catalog[o["type"]]
		var sp := Sprite2D.new()
		sp.texture = Data.tex("res://art/objects/%s_%d.png" % [o["type"], o["v"]])
		sp.centered = false
		sp.scale = Vector2(0.5, 0.5)                 # object art is drawn at 64 px per tile, the world uses 32
		sp.position = Vector2((o["tx"] - int(d["ax"])) * T, (o["ty"] - int(d["ay"])) * T)
		sp.z_index = (o["ty"] + 1) * T
		sp.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		world.add_child(sp)
		if o["spot"] != "":
			spot_sprite[o["spot"]] = sp
		if d["fade"]:
			fade_objs.append({
				"sprite": sp, "x0": sp.position.x, "y0": sp.position.y,
				"w": float(d["w"]) * T, "h": float(d["h"]) * T, "base": float((o["ty"] + 1) * T),
			})

	if map["tint_alpha"] > 0.0:
		var tint := ColorRect.new()
		tint.color = Color(map["tint_color"].r, map["tint_color"].g, map["tint_color"].b, map["tint_alpha"])
		tint.size = Vector2(map["cols"] * T, map["rows"] * T)
		tint.z_index = 3500
		tint.mouse_filter = Control.MOUSE_FILTER_IGNORE
		world.add_child(tint)

	overlay = Node2D.new()
	overlay.z_index = 3000
	overlay.draw.connect(_draw_overlay)
	world.add_child(overlay)

func _make_actor(sheet: String, pos: Vector2, id: String, kind: String) -> Actor:
	var a := Actor.new()
	a.id = id
	a.kind = kind
	a.setup(sheet)
	a.position = pos
	world.add_child(a)
	return a

func _build_actors() -> void:
	player = _make_actor(UI.outfit_sheet(), map["player_spawn"], "player", "player")
	by_id["player"] = player

	taya = _make_actor(UI.outfit_sheet("seeker"), map["seeker_start"], "taya", "seeker")
	taya.brain = SeekerBrain.new(grid, diff, rnd)
	taya.face = "up"

	var spawns: Array = Util.shuffle(map["npc_spawns"].duplicate(), rnd)
	var hoodies: Array = []
	for h in Cfg.HOODIES:
		if h["id"] != Data.save["outfit"]["hoodie"]:
			hoodies.append(h)
	var accs := ["none", "none", "salakot", "cap"]
	var n := mini(int(diff["hiders"]), spawns.size())
	for i in n:
		var h: Dictionary = hoodies[i % hoodies.size()]
		var acc: String = accs[(i * 3 + 1) % accs.size()]
		var e := _make_actor(UI.outfit_sheet("hider", h["id"], acc), spawns[i], "npc%d" % i, "npc")
		e.npc_name = Cfg.NPC_NAMES[i % Cfg.NPC_NAMES.size()]
		e.brain = HiderBrain.new(grid, rnd, e.id)
		npcs.append(e)
		by_id[e.id] = e

func _build_camera() -> void:
	cam = Camera2D.new()
	cam.limit_left = 0
	cam.limit_top = 0
	cam.limit_right = int(map["cols"]) * Cfg.TILE
	cam.limit_bottom = int(map["rows"]) * Cfg.TILE
	cam.position_smoothing_enabled = true
	cam.position_smoothing_speed = 9.0
	cam.position = player.position
	add_child(cam)
	cam.make_current()
	cam.reset_smoothing()
	_update_zoom()
	get_viewport().size_changed.connect(_update_zoom)

func _update_zoom() -> void:
	var h := get_viewport_rect().size.y
	cam.zoom = Vector2.ONE * (h / Cfg.VIEW_HEIGHT)

# ------------------------------------------------------------------ main loop
func _process(delta: float) -> void:
	var dt := minf(delta, 0.05)
	if not over:
		if taya.brain.state != "wait":
			game_time += dt
			time_left -= dt
		player.invuln = maxf(0.0, player.invuln - dt)
		for e in npcs:
			e.invuln = maxf(0.0, e.invuln - dt)
		_update_player(dt)
		_update_npcs(dt)
		_update_taya(dt)
		_update_context()
		_update_music()
		if time_left <= 0.0:
			_finish(true)
	_update_visuals()

func _key_just(k: Key) -> bool:
	var now := Input.is_key_pressed(k)
	var was: bool = _prev_keys.get(k, false)
	_prev_keys[k] = now
	return now and not was

func _read_move() -> Dictionary:
	var v := Vector2.ZERO
	var from_touch := false
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		v.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		v.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		v.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		v.y += 1.0
	if hud.move_vec.length() > 0.01:
		v = hud.move_vec
		from_touch = true
	var mag := minf(1.0, v.length())
	return {"dir": v.normalized() if v.length() > 0.001 else Vector2.ZERO, "mag": mag, "touch": from_touch}

func _update_player(dt: float) -> void:
	var p := player
	var act: bool = hud.take_action()
	if _key_just(KEY_SPACE) or _key_just(KEY_E):
		act = true
	if act:
		_do_action()
	if p.hidden:
		p.noise = 0.0
		return
	var m := _read_move()
	var moving: bool = m["mag"] > 0.12
	var want_run: bool = moving and (hud.run_held or Input.is_key_pressed(KEY_SHIFT))
	var want_sneak: bool = moving and not want_run and (Input.is_key_pressed(KEY_CTRL) or Input.is_key_pressed(KEY_C) or (m["touch"] and m["mag"] < 0.45))

	var run: bool = want_run and not p.exhausted and p.stamina > 0.0
	if run:
		p.stamina -= Cfg.STAMINA_DRAIN * dt
		p.regen_delay = Cfg.STAMINA_DELAY
		if p.stamina <= 0.0:
			p.stamina = 0.0
			p.exhausted = true
	else:
		p.regen_delay -= dt
		if p.regen_delay <= 0.0:
			p.stamina = minf(Cfg.STAMINA_MAX, p.stamina + Cfg.STAMINA_REGEN * dt)
		if p.exhausted and p.stamina >= Cfg.STAMINA_MIN_RUN:
			p.exhausted = false

	var spd := 0.0
	if moving:
		spd = Cfg.RUN if run else (Cfg.SNEAK if want_sneak else Cfg.WALK)
		p.position = grid.move_box(p.position, m["dir"] * spd * dt, Cfg.BODY_HW, Cfg.BODY_HH)
		p.set_face(m["dir"])
	p.animate(spd, dt)
	p.speed = spd
	if run:
		p.noise = 130.0 * diff["hear_run"]
	elif spd >= Cfg.WALK:
		p.noise = 70.0 * diff["hear_walk"]
	else:
		p.noise = 0.0
	if run:
		foot_t -= dt
		if foot_t <= 0.0:
			Sfx.play("step")
			foot_t = 0.24

func _update_npcs(dt: float) -> void:
	for e in npcs:
		if e.gone:
			e.noise = 0.0
			continue
		var out: Dictionary = e.brain.update(dt, {"time": game_time, "self": e.position, "seeker": taya.position, "spots": map["spots"]})
		for ev in out["events"]:
			_on_hider_event(e, ev)
		if e.hidden:
			e.noise = 0.0
			continue
		var spd: float = out["speed"]
		if spd > 0.0:
			e.position = grid.move_box(e.position, out["dir"] * spd * dt, Cfg.BODY_HW, Cfg.BODY_HH)
			e.set_face(out["dir"])
		e.animate(spd, dt)
		e.noise = 70.0 * diff["hear_run"] if spd > 120.0 else 0.0

func _taya_watching(a: Actor) -> bool:
	var st: String = taya.brain.state
	if st == "wait" or st == "stunned" or st == "chase":
		return false
	return taya.brain.sees(taya.position, {"pos": a.position, "hidden": a.hidden, "gone": a.gone})

func _on_hider_event(e: Actor, ev: Dictionary) -> void:
	var spot = spot_by_id.get(ev.get("spot_id", ""), null)
	match ev["type"]:
		"claim":
			if spot != null:
				spot["owner"] = e.id
		"release":
			if spot != null and spot["owner"] == e.id:
				spot["owner"] = ""
		"hide":
			if spot == null:
				return
			spot["owner"] = e.id
			if _taya_watching(e):
				taya.brain.notify_hide(spot)     # she saw where they went
			e.spot = spot
			e.set_hidden(true)
			_rustle(spot)
			if e.position.distance_to(player.position) < 260.0:
				Sfx.play("hide")
		"unhide":
			e.spot = null
			if spot != null:
				e.position = spot["ap"]
			e.set_hidden(false)
			_rustle(spot)

func _rustle(spot) -> void:
	if spot == null or not spot_sprite.has(spot["id"]):
		return
	var sp: Sprite2D = spot_sprite[spot["id"]]
	var x := sp.position.x
	var tw := sp.create_tween()
	for i in 3:
		tw.tween_property(sp, "position:x", x + 2.0, 0.05)
		tw.tween_property(sp, "position:x", x - 2.0, 0.05)
	tw.tween_property(sp, "position:x", x, 0.04)

func _update_taya(dt: float) -> void:
	var brain: SeekerBrain = taya.brain
	var targets: Array = []
	var all: Array = [player]
	all.append_array(npcs)
	for a in all:
		targets.append({"id": a.id, "kind": a.kind, "pos": a.position, "hidden": a.hidden, "gone": a.gone, "invuln": a.invuln > 0.0, "noise": a.noise})
	var out: Dictionary = brain.update(dt, {"time": game_time, "self": taya.position, "targets": targets, "spots": map["spots"]})
	var spd: float = out["speed"]
	var fdir := Vector2.from_angle(out["facing"])
	if spd > 0.0:
		taya.position = grid.move_box(taya.position, out["dir"] * spd * dt, Cfg.BODY_HW, Cfg.BODY_HH)
	taya.set_face(fdir)
	taya.animate(spd, dt)
	for ev in out["events"]:
		match ev["type"]:
			"go":
				Sfx.play("go")
				hud.toast("Taya: \"Handa na ba kayo? Hahanapin ko na kayo!\"", Color("ffe27a"))
			"spotted":
				if ev["kind"] == "player":
					Sfx.play("spotted")
					Sfx.vibrate(40)
			"heard":
				if ev["id"] == "player":
					Sfx.play("heard")
			"catch":
				_catch(by_id[ev["id"]], false)
			"search":
				_resolve_search(ev)

func _resolve_search(ev: Dictionary) -> void:
	var spot = spot_by_id.get(ev["spot_id"], null)
	if spot == null or spot["owner"] == "":
		return
	var e: Actor = by_id.get(spot["owner"], null)
	if e == null or e.gone:
		return
	var chance: float = float(Cfg.SPOT_FIND.get(spot["type"], 0.4)) * float(diff["find"])
	if ev["certain"] or rnd.randf() < chance:
		_catch(e, true)
		taya.brain.stun(diff["stun"])
	elif e == player:
		hud.toast("Muntik na! Hindi ka nakita ni Taya.", Color("9ff0b0"))
		_rustle(spot)

# ------------------------------------------------------------------ catching and saving
func _catch(e: Actor, from_hiding: bool) -> void:
	if e == null or e.gone:
		return
	if e.hidden:
		var sp = e.spot
		e.set_hidden(false)
		if sp != null:
			e.position = sp["ap"]
			sp["owner"] = ""
		e.spot = null
		_rustle(sp)
	if e == player:
		times_caught += 1
		e.hearts -= 1
		e.invuln = Cfg.INVULN
		Sfx.play("hurt")
		Sfx.vibrate(120)
		hud.shake()
		hud.toast("Nahanap ka sa taguan!" if from_hiding else "Nahuli ka ni Taya!", Color("ff8a8a"))
		if e.hearts <= 0:
			_finish(false)
		return
	# a friend is caught: they wait by the flag until somebody shouts SAVE
	e.gone = true
	if e.spot != null:
		e.spot["owner"] = ""
		e.spot = null
	e.brain = HiderBrain.new(grid, rnd, e.id)
	Sfx.play("caught")
	hud.toast("%s ay nahuli!" % e.npc_name, Color("ffd27a"))
	_place_caught()

func _place_caught() -> void:
	var list: Array = []
	for e in npcs:
		if e.gone:
			list.append(e)
	for i in list.size():
		var e: Actor = list[i]
		var a := float(i) / maxf(1.0, list.size()) * TAU + 0.6
		e.position = map["base"] + Vector2(cos(a) * 42.0, sin(a) * 34.0 + 6.0)
		e.face = "down"
		e.frame = 0
		e.bob = 0.0
		e.sprite.modulate = Color(0.6, 0.64, 0.84, 0.85)

func _save_friends() -> void:
	var caught: Array = []
	for e in npcs:
		if e.gone:
			caught.append(e)
	if caught.is_empty():
		return
	if taya.position.distance_to(map["base"]) <= Cfg.BASE_SAFE_DIST:
		Sfx.play("deny")
		hud.toast("Masyadong malapit si Taya!", Color("ff8a8a"))
		return
	for e in caught:
		e.gone = false
		e.sprite.modulate = Color.WHITE
		e.brain = HiderBrain.new(grid, rnd, e.id)
	saved_any = true
	Sfx.play("save")
	Sfx.vibrate(60)
	hud.toast("SAVE! Nakalaya ang %d kaibigan!" % caught.size(), Color("9ff0b0"))

# ------------------------------------------------------------------ player action (hide / out / save)
func _update_context() -> void:
	ctx = null
	var p := player
	if p.hidden:
		ctx = {"kind": "out", "label": "LABAS"}
		return
	var any_caught := false
	for e in npcs:
		if e.gone:
			any_caught = true
	if any_caught and p.position.distance_to(map["base"]) <= Cfg.BASE_RANGE:
		ctx = {"kind": "save", "label": "SAVE!"}
		return
	var best = null
	var bd := Cfg.HIDE_RANGE
	for s in map["spots"]:
		if s["owner"] != "":
			continue
		var d := p.position.distance_to(s["pos"])
		if d < bd:
			bd = d
			best = s
	if best != null:
		ctx = {"kind": "hide", "label": "TAGO", "spot": best}

func _do_action() -> void:
	if ctx == null:
		return
	var p := player
	match ctx["kind"]:
		"save":
			_save_friends()
		"out":
			var s = p.spot
			p.set_hidden(false)
			if s != null:
				p.position = s["ap"]
				s["owner"] = ""
			p.spot = null
			Sfx.play("unhide")
			_rustle(s)
		"hide":
			var s2: Dictionary = ctx["spot"]
			if s2["owner"] != "":
				return
			if _taya_watching(p):
				taya.brain.notify_hide(s2)
				hud.toast("Nakita ka ni Taya na nagtago!", Color("ff8a8a"))
			s2["owner"] = "player"
			p.spot = s2
			p.set_hidden(true)
			Sfx.play("hide")
			_rustle(s2)

func _update_music() -> void:
	var prog := 1.0 - time_left / float(diff["time"])
	var target := 1.0 if taya.brain.state == "chase" else clampf(0.15 + prog * 0.6, 0.0, 0.8)
	tension_now += (target - tension_now) * 0.03
	Sfx.tension = tension_now

# ------------------------------------------------------------------ visuals
func _update_visuals() -> void:
	var now := Time.get_ticks_msec()
	player.refresh(now)
	taya.refresh(now)
	for e in npcs:
		e.refresh(now)
	cam.position = player.position
	# tall objects fade when the player is behind them
	for o in fade_objs:
		var p := player.position
		var behind: bool = p.x > o["x0"] and p.x < o["x0"] + o["w"] and p.y > o["y0"] and p.y < o["base"]
		var sp: Sprite2D = o["sprite"]
		sp.modulate.a = lerpf(sp.modulate.a, 0.42 if behind else 1.0, 0.25)
	overlay.queue_redraw()

func _draw_overlay() -> void:
	var now := Time.get_ticks_msec()
	var pulse := 0.5 + 0.5 * sin(now / 220.0)
	var brain: SeekerBrain = taya.brain
	# vision cone
	if brain.state != "wait" and brain.state != "stunned":
		var fov := deg_to_rad(diff["fov"])
		var a0 := brain.facing - fov / 2.0
		var apex := taya.position + Vector2(0, -10)
		var col := Color(1, 0.25, 0.25, 0.2) if brain.state == "chase" else Color(1, 0.89, 0.48, 0.15)
		var prev := apex
		var have_prev := false
		for i in range(0, 15):
			var ang := a0 + fov * i / 14.0
			var reach := grid.ray_length(apex, ang, diff["vision"])
			var pt := apex + Vector2.from_angle(ang) * reach
			if have_prev and absf((prev - apex).cross(pt - apex)) > 0.5:
				overlay.draw_colored_polygon(PackedVector2Array([apex, prev, pt]), col)
			prev = pt
			have_prev = true
	# hints
	if ctx != null and ctx.has("spot"):
		overlay.draw_arc(ctx["spot"]["pos"], 17.0 + pulse * 2.0, 0.0, TAU, 28, Color(1, 1, 1, 0.5 + 0.4 * pulse), 3.0)
	if player.hidden and player.spot != null:
		overlay.draw_arc(player.spot["pos"], 18.0 + pulse * 3.0, 0.0, TAU, 28, Color(0.62, 0.94, 0.69, 0.4 + 0.5 * pulse), 3.0)
	for e in npcs:
		if e.gone:
			overlay.draw_arc(map["base"], Cfg.BASE_RANGE - 4.0 + pulse * 3.0, 0.0, TAU, 40, Color(1, 0.89, 0.48, 0.4 + 0.5 * pulse), 3.0)
			break
	# arrow over the player
	if not player.hidden:
		var mx := player.position.x
		var my := player.position.y - 58.0 + sin(now / 200.0) * 2.0
		overlay.draw_colored_polygon(PackedVector2Array([Vector2(mx - 6, my - 1), Vector2(mx + 6, my - 1), Vector2(mx, my + 8)]), Color(0, 0, 0, 0.45))
		overlay.draw_colored_polygon(PackedVector2Array([Vector2(mx - 5, my - 3), Vector2(mx + 5, my - 3), Vector2(mx, my + 5)]), Color.WHITE)
	# Taya: sight meter and ! / ?
	if brain.sight > 0.04 and brain.state != "chase":
		overlay.draw_rect(Rect2(taya.position.x - 12, taya.position.y - 52, 24, 4), Color(0, 0, 0, 0.5))
		overlay.draw_rect(Rect2(taya.position.x - 12, taya.position.y - 52, 24.0 * brain.sight, 4), Color("ffe27a"))
	if brain.alert > 0:
		var txt := "!" if brain.alert == 2 else "?"
		var font := ThemeDB.fallback_font
		var tp := taya.position + Vector2(-5, -62.0 - (sin(now / 70.0) * 2.0 if brain.alert == 2 else 0.0))
		overlay.draw_string_outline(font, tp, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 26, 6, Color("0b1020"))
		overlay.draw_string(font, tp, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 26, Color("ff5a5a") if brain.alert == 2 else Color("ffe27a"))

# ------------------------------------------------------------------ end of round
func _finish(won: bool) -> void:
	if over:
		return
	over = true
	var still_caught := 0
	for e in npcs:
		if e.gone:
			still_caught += 1
	var stars := 0
	if won:
		stars = 1 + (1 if player.hearts >= 2 else 0) + (1 if still_caught == 0 else 0)
	Sfx.stop_music()
	Sfx.play("win" if won else "lose")
	hud.toast("Tapos ang oras! Nanalo ka!" if won else "Naubos ang puso mo...", Color("9ff0b0") if won else Color("ff8a8a"))
	var res := Data.record_round(map_id, won, stars, saved_any, times_caught)
	result_args = {
		"won": won, "stars": stars, "map_id": map_id, "difficulty": diff_id,
		"hearts": maxi(0, player.hearts), "freed": npcs.size() - still_caught, "friends": npcs.size(),
		"caught": times_caught, "saved": saved_any, "improved": res["improved"], "unlocked": res["unlocked"],
	}
	get_tree().create_timer(1.5).timeout.connect(_to_result)

func _to_result() -> void:
	get_tree().paused = false
	Nav.go("result", result_args)

func _notification(what: int) -> void:
	if hud == null or over:
		return
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_APPLICATION_PAUSED:
		hud.set_pause(true)
	elif what == NOTIFICATION_WM_GO_BACK_REQUEST:
		hud.set_pause(not get_tree().paused)
