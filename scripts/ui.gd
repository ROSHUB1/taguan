class_name UI
extends RefCounted
## Helpers that build the menu widgets in code. All positions are in the 960x540 design space.

const ICONS := ["play", "gear", "shirt", "trophy", "star", "back", "boot", "shield", "crown", "heart"]
const OUTLINE := Color(0.0431, 0.0627, 0.1255)

static func box(fill: Color, radius: int = 14, border: Color = OUTLINE, bw: int = 3, shadow: bool = true) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.set_corner_radius_all(radius)
	s.set_border_width_all(bw)
	s.border_color = border
	if shadow:
		s.shadow_color = Color(0, 0, 0, 0.35)
		s.shadow_size = 6
		s.shadow_offset = Vector2(0, 4)
	return s

## A text label centred on `center` (or left-aligned starting at center.x - w/2 when opts.left).
## opts: w (box width), h, left, wrap, outline, color_outline
static func text(parent: Node, center: Vector2, msg: String, size: int = 20, color: Color = Color.WHITE, opts: Dictionary = {}) -> Label:
	var l := Label.new()
	var w: float = opts.get("w", 700.0)
	var h: float = opts.get("h", size * 1.5)
	l.text = msg
	l.size = Vector2(w, h)
	l.position = center - l.size / 2.0
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", OUTLINE)
	l.add_theme_constant_override("outline_size", opts.get("outline", 4))
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT if opts.get("left", false) else HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	if opts.get("wrap", false):
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(l)
	return l

static func panel(parent: Node, center: Vector2, size: Vector2, fill: Color = Cfg.PANEL, border: Color = Color("5f72c8"), radius: int = 16) -> Panel:
	var p := Panel.new()
	p.size = size
	p.position = center - size / 2.0
	p.add_theme_stylebox_override("panel", box(fill, radius, border, 3))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(p)
	return p

static func icon(parent: Node, icon_name: String, center: Vector2, size: float) -> TextureRect:
	var at := AtlasTexture.new()
	at.atlas = Data.tex("res://art/ui/icons.png")
	at.region = Rect2(ICONS.find(icon_name) * 64, 0, 64, 64)
	var t := TextureRect.new()
	t.texture = at
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_SCALE
	t.size = Vector2(size, size)
	t.position = center - t.size / 2.0
	t.pivot_offset = t.size / 2.0
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(t)
	return t

static func set_fill(b: Button, fill: Color) -> void:
	b.add_theme_stylebox_override("normal", box(fill))
	b.add_theme_stylebox_override("hover", box(fill.lightened(0.1)))
	b.add_theme_stylebox_override("pressed", box(fill.darkened(0.2)))
	b.add_theme_stylebox_override("focus", box(fill))
	b.add_theme_stylebox_override("disabled", box(Color("4a4f66")))

## A pressable button. cb is called on release.
static func button(parent: Node, center: Vector2, size: Vector2, label: String, cb: Callable, fill: Color = Cfg.BLUE, font: int = 24, icon_name: String = "", back: bool = false) -> Button:
	var b := Button.new()
	b.size = size
	b.position = center - size / 2.0
	b.text = label
	b.focus_mode = Control.FOCUS_NONE
	set_fill(b, fill)
	b.add_theme_font_size_override("font_size", font)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_disabled_color", "font_focus_color"]:
		b.add_theme_color_override(c, Color.WHITE)
	b.add_theme_color_override("font_outline_color", OUTLINE)
	b.add_theme_constant_override("outline_size", 4)
	b.pressed.connect(func():
		Sfx.play("back" if back else "click")
		cb.call())
	parent.add_child(b)
	if icon_name != "":
		var ic := icon(b, icon_name, Vector2(34, size.y / 2.0), minf(size.y - 14.0, 44.0))
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.alignment = HORIZONTAL_ALIGNMENT_CENTER
	return b

## Sprite showing one frame of a 7x2 character sheet, feet on `pos`.
static func char_sprite(parent: Node, path: String, pos: Vector2, frame: int, scale: float) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = Data.tex(path)
	s.hframes = Cfg.SHEET_COLS
	s.vframes = 2
	s.frame = frame
	s.centered = false
	s.offset = Vector2(-32, -Cfg.FEET_Y)
	s.position = pos
	s.scale = Vector2(scale, scale)
	s.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	parent.add_child(s)
	return s

static func ellipse(parent: Node, center: Vector2, rx: float, ry: float, color: Color) -> Polygon2D:
	var pts := PackedVector2Array()
	for i in 24:
		var a := TAU * i / 24.0
		pts.append(Vector2(cos(a) * rx, sin(a) * ry))
	var p := Polygon2D.new()
	p.polygon = pts
	p.color = color
	p.position = center
	parent.add_child(p)
	return p

static func outfit_sheet(who: String = "hider", hoodie: String = "", acc: String = "") -> String:
	if who == "seeker":
		return "res://art/chars/seeker.png"
	var o: Dictionary = Data.save["outfit"]
	return "res://art/chars/hider_%s_%s.png" % [hoodie if hoodie != "" else o["hoodie"], acc if acc != "" else o["acc"]]
