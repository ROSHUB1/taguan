extends CanvasLayer
## HUD on top of the game: hearts, timer, minimap, touch joystick and buttons, toasts, pause menu.
## Touch is read directly from screen-touch events so several fingers work at once
## (one on the joystick, another on RUN or the action button).

var game: Node = null

var move_vec := Vector2.ZERO
var run_held := false
var _action_flag := false

var pad: Control
var menu: Control = null
var toast_label: Label
var banner_label: Label
var banner_sub: Label
var paused := false

var _stick_idx := -1
var _stick_origin := Vector2.ZERO
var _stick_cur := Vector2.ZERO
var _run_idx := -1
var _act_idx := -1
var _size := Vector2(960, 540)
var _last_count := -1
var _icon_heart: AtlasTexture
var _mini: Texture2D
var _shake := 0.0

const STICK_R := 58.0
const RUN_R := 46.0
const ACT_R := 56.0

func _ready() -> void:
	layer = 5
	process_mode = Node.PROCESS_MODE_ALWAYS
	_icon_heart = AtlasTexture.new()
	_icon_heart.atlas = Data.tex("res://art/ui/icons.png")
	_icon_heart.region = Rect2(UI.ICONS.find("heart") * 64, 0, 64, 64)
	_mini = Data.tex("res://art/maps/%s_mini.png" % game.map_id)
	pad = Control.new()
	pad.set_anchors_preset(Control.PRESET_FULL_RECT)
	pad.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pad.draw.connect(_draw_pad)
	add_child(pad)
	toast_label = _make_label(20, 640.0)
	banner_label = _make_label(64, 700.0)
	banner_sub = _make_label(22, 700.0)
	get_viewport().size_changed.connect(_layout)
	_layout()
	_banner("Magtago na!", "Nagbibilang si Taya...", 2.2)

func _make_label(size: int, w: float) -> Label:
	var l := Label.new()
	l.size = Vector2(w, size * 1.6)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_outline_color", UI.OUTLINE)
	l.add_theme_constant_override("outline_size", 8 if size > 40 else 5)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.modulate.a = 0.0
	pad.add_child(l)
	return l

func _layout() -> void:
	_size = get_viewport().get_visible_rect().size
	toast_label.position = Vector2(_size.x / 2.0 - toast_label.size.x / 2.0, 96)
	banner_label.position = Vector2(_size.x / 2.0 - banner_label.size.x / 2.0, _size.y / 2.0 - 130)
	banner_sub.position = Vector2(_size.x / 2.0 - banner_sub.size.x / 2.0, _size.y / 2.0 - 60)
	if menu != null:
		menu.position = (_size - Cfg.DESIGN) / 2.0

func _run_center() -> Vector2:
	return Vector2(_size.x - 76.0, _size.y - 80.0)

func _act_center() -> Vector2:
	return Vector2(_size.x - 190.0, _size.y - 112.0)

func _pause_center() -> Vector2:
	return Vector2(_size.x - 44.0, 44.0)

func _default_stick() -> Vector2:
	return Vector2(120.0, _size.y - 100.0)

# ------------------------------------------------------------------ interface used by the game
func take_action() -> bool:
	var a := _action_flag
	_action_flag = false
	return a

func toast(msg: String, color: Color = Color.WHITE) -> void:
	toast_label.text = msg
	toast_label.add_theme_color_override("font_color", color)
	toast_label.modulate.a = 1.0
	var tw := toast_label.create_tween()
	tw.tween_interval(2.0)
	tw.tween_property(toast_label, "modulate:a", 0.0, 0.5)

func _banner(text: String, sub: String, hold: float) -> void:
	banner_label.text = text
	banner_label.add_theme_color_override("font_color", Color("ffe27a"))
	banner_label.modulate.a = 1.0
	banner_sub.text = sub
	banner_sub.add_theme_color_override("font_color", Color.WHITE)
	banner_sub.modulate.a = 1.0
	var tw := create_tween()
	tw.tween_interval(hold)
	tw.tween_property(banner_label, "modulate:a", 0.0, 0.5)
	tw.parallel().tween_property(banner_sub, "modulate:a", 0.0, 0.5)

func shake() -> void:
	_shake = 0.22

func set_pause(on: bool) -> void:
	if on == paused or game.over:
		return
	paused = on
	move_vec = Vector2.ZERO
	run_held = false
	_stick_idx = -1
	_run_idx = -1
	_act_idx = -1
	get_tree().paused = on
	if on:
		Sfx.stop_music()
		_open_menu()
	else:
		Sfx.start_music("game")
		if menu != null:
			menu.queue_free()
			menu = null

func _open_menu() -> void:
	menu = Control.new()
	menu.size = Cfg.DESIGN
	menu.position = (_size - Cfg.DESIGN) / 2.0
	add_child(menu)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.6)
	dim.position = Vector2(-2000, -2000)
	dim.size = Vector2(5000, 5000)
	menu.add_child(dim)
	UI.panel(menu, Vector2(480, 270), Vector2(380, 340))
	UI.text(menu, Vector2(480, 152), "PAUSE", 36, Color.WHITE, {"w": 300, "outline": 6})
	UI.button(menu, Vector2(480, 226), Vector2(280, 58), "TULOY", func(): set_pause(false), Cfg.GREEN, 26)
	UI.button(menu, Vector2(480, 298), Vector2(280, 54), "ULITIN", _restart, Color("3a4278"), 22)
	UI.button(menu, Vector2(480, 366), Vector2(280, 54), "LUMABAS", _quit, Color("6b2c3a"), 22, "", true)

func _restart() -> void:
	get_tree().paused = false
	Nav.go("game", {"map_id": game.map_id, "difficulty": game.diff_id})

func _quit() -> void:
	get_tree().paused = false
	Sfx.stop_music()
	Nav.go("mapselect")

# ------------------------------------------------------------------ touch input
func _input(event: InputEvent) -> void:
	if paused:
		return
	if event is InputEventScreenTouch:
		var t: InputEventScreenTouch = event
		if t.pressed:
			_touch_down(t.index, t.position)
		else:
			_touch_up(t.index)
	elif event is InputEventScreenDrag:
		var d: InputEventScreenDrag = event
		if d.index == _stick_idx:
			_stick_cur = d.position
	elif event is InputEventKey:
		var k: InputEventKey = event
		if k.pressed and not k.echo and (k.keycode == KEY_ESCAPE or k.keycode == KEY_P):
			set_pause(true)

func _touch_down(idx: int, pos: Vector2) -> void:
	if pos.distance_to(_pause_center()) <= 34.0:
		set_pause(true)
	elif pos.distance_to(_run_center()) <= RUN_R + 14.0:
		_run_idx = idx
		run_held = true
	elif pos.distance_to(_act_center()) <= ACT_R + 14.0:
		_act_idx = idx
		_action_flag = true
	elif pos.x < _size.x * 0.55 and _stick_idx == -1:
		_stick_idx = idx
		_stick_origin = pos
		_stick_cur = pos

func _touch_up(idx: int) -> void:
	if idx == _stick_idx:
		_stick_idx = -1
		move_vec = Vector2.ZERO
	if idx == _run_idx:
		_run_idx = -1
		run_held = false
	if idx == _act_idx:
		_act_idx = -1

# ------------------------------------------------------------------ per frame
func _process(delta: float) -> void:
	if game == null:
		return
	if _stick_idx != -1:
		var d := _stick_cur - _stick_origin
		var v := d / STICK_R
		if v.length() > 1.0:
			v = v.normalized()
		move_vec = Vector2.ZERO if v.length() < 0.12 else v
	# countdown banner while Taya counts
	var brain: SeekerBrain = game.taya.brain
	if brain.state == "wait":
		var n := int(ceil(maxf(0.0, brain.wait_t)))
		banner_label.text = str(n)
		banner_label.modulate.a = 1.0
		banner_sub.text = "Magtago na! Nagbibilang si Taya..."
		banner_sub.modulate.a = 1.0
		if n != _last_count:
			_last_count = n
			if n <= 3 and n > 0:
				Sfx.play("tick")
	elif _last_count != 0 and _last_count != -1:
		_last_count = 0
		_banner("GO!", "", 0.6)
	# camera shake
	if _shake > 0.0:
		_shake -= delta
		game.cam.offset = Vector2(randf_range(-4, 4), randf_range(-4, 4)) * (_shake / 0.22)
	else:
		game.cam.offset = Vector2.ZERO
	pad.queue_redraw()

# ------------------------------------------------------------------ drawing
func _text_center(font: Font, text: String, c: Vector2, size: int, color: Color) -> void:
	var w := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var p := Vector2(c.x - w / 2.0, c.y + size * 0.35)
	pad.draw_string_outline(font, p, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 6, UI.OUTLINE)
	pad.draw_string(font, p, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)

func _round_button(c: Vector2, r: float, color: Color, label: String, size: int, pressed: bool, enabled: bool) -> void:
	var col := color if enabled else Color("4a4f66")
	var dy := 3.0 if pressed else 0.0
	pad.draw_circle(c + Vector2(2, 6), r, Color(0, 0, 0, 0.4))
	pad.draw_circle(c + Vector2(0, dy), r + 3.0, UI.OUTLINE)
	pad.draw_circle(c + Vector2(0, dy), r, col.darkened(0.2) if pressed else col)
	pad.draw_circle(c + Vector2(-r * 0.2, dy - r * 0.35), r * 0.5, Color(1, 1, 1, 0.14))
	_text_center(ThemeDB.fallback_font, label, c + Vector2(0, dy), size, Color.WHITE if enabled else Color(1, 1, 1, 0.6))

func _draw_pad() -> void:
	if game == null or game.player == null:
		return
	var font := ThemeDB.fallback_font
	var p: Actor = game.player

	# hearts
	for i in Cfg.HEARTS:
		var rect := Rect2(18 + i * 36, 14, 32, 32)
		pad.draw_texture_rect(_icon_heart, rect, false, Color.WHITE if i < p.hearts else Color(0.13, 0.13, 0.13, 0.45))
	# friends
	var free := 0
	for e in game.npcs:
		if not e.gone:
			free += 1
	var ftxt := "Kaibigan: %d/%d" % [free, game.npcs.size()]
	pad.draw_string_outline(font, Vector2(20, 72), ftxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, 5, UI.OUTLINE)
	pad.draw_string(font, Vector2(20, 72), ftxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color.WHITE)

	# timer
	var tw := 124.0
	pad.draw_style_box(UI.box(Color(0.14, 0.16, 0.32, 0.88), 12, Color("5f72c8"), 3, false), Rect2(_size.x / 2.0 - tw / 2.0, 14, tw, 44))
	_text_center(font, Util.fmt_time(game.time_left), Vector2(_size.x / 2.0, 36), 28, Color("ff8a8a") if game.time_left < 20.0 else Color.WHITE)

	# pause button
	_round_button(_pause_center(), 28.0, Color("3a4278"), "II", 22, false, true)

	# minimap
	var msize := Vector2(168, 120)
	var mpos := Vector2(_size.x - 14.0 - msize.x, 86.0)
	pad.draw_rect(Rect2(mpos - Vector2(4, 4), msize + Vector2(8, 8)), Color(0.04, 0.06, 0.12, 0.9))
	pad.draw_texture_rect(_mini, Rect2(mpos, msize), false, Color(1, 1, 1, 0.9))
	var sx := msize.x / (game.map["cols"] * Cfg.TILE)
	var sy := msize.y / (game.map["rows"] * Cfg.TILE)
	var mp := func(w: Vector2) -> Vector2: return mpos + Vector2(w.x * sx, w.y * sy)
	pad.draw_rect(Rect2(mp.call(game.map["base"]) - Vector2(3, 3), Vector2(6, 6)), Color("f6c945"))
	pad.draw_circle(mp.call(game.taya.position), 3.5, Color("ff4040"))
	pad.draw_circle(mp.call(p.position), 3.0, Color.WHITE)

	# RUN button with stamina ring
	var rc := _run_center()
	pad.draw_arc(rc, RUN_R + 9.0, 0.0, TAU, 40, Color(0, 0, 0, 0.35), 6.0)
	var f := clampf(p.stamina / Cfg.STAMINA_MAX, 0.0, 1.0)
	if f > 0.0:
		var ring := Color("e03131") if p.exhausted else (Color("f08c2a") if f < 0.3 else Color("9ff0b0"))
		pad.draw_arc(rc, RUN_R + 9.0, -PI / 2.0, -PI / 2.0 + TAU * f, 40, ring, 6.0)
	_round_button(rc, RUN_R, Cfg.BLUE, "PAGOD" if p.exhausted else "RUN", 16 if p.exhausted else 20, run_held, not p.exhausted)

	# action button
	var c = game.ctx
	var ac := Color("37b24d")
	var label := "TAGO"
	if c != null:
		label = c["label"]
		if c["kind"] == "save":
			ac = Color("e8a317")
		elif c["kind"] == "out":
			ac = Color("2f6fe0")
	_round_button(_act_center(), ACT_R, ac, label, 22, _act_idx != -1, c != null)

	# joystick
	if _stick_idx != -1:
		var d := _stick_cur - _stick_origin
		if d.length() > STICK_R:
			d = d.normalized() * STICK_R
		pad.draw_circle(_stick_origin, STICK_R + 6.0, Color(1, 1, 1, 0.14))
		pad.draw_arc(_stick_origin, STICK_R + 6.0, 0.0, TAU, 40, Color(1, 1, 1, 0.5), 3.0)
		pad.draw_circle(_stick_origin + d, 26.0, Color(1, 1, 1, 0.55))
	else:
		var sc := _default_stick()
		pad.draw_circle(sc, STICK_R + 6.0, Color(1, 1, 1, 0.07))
		pad.draw_arc(sc, STICK_R + 6.0, 0.0, TAU, 40, Color(1, 1, 1, 0.22), 3.0)
		pad.draw_circle(sc, 26.0, Color(1, 1, 1, 0.2))
