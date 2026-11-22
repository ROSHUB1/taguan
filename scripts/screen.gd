class_name Screen
extends Control
## Base class of every menu screen. `ui` is a 960x540 design area kept centred on any screen shape.
## Override build() to add widgets to `ui`.

var args := {}
var ui: Control
var use_sky := true

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Cfg.SKY
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	ui = Control.new()
	ui.size = Cfg.DESIGN
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(ui)
	if use_sky:
		ui.add_child(NightSky.new())
	get_viewport().size_changed.connect(_relayout)
	_relayout()
	build()

func _relayout() -> void:
	ui.position = ((get_viewport_rect().size - Cfg.DESIGN) / 2.0).floor()

func build() -> void:
	pass

func total_stars_chip(center: Vector2) -> void:
	UI.panel(ui, center, Vector2(130, 44), Cfg.PANEL, Color("5f72c8"), 12)
	UI.icon(ui, "star", center + Vector2(-44, 0), 30)
	UI.text(ui, center + Vector2(14, 0), str(Data.total_stars()), 24, Color("ffe27a"), {"w": 80})

func back_button(target: String = "menu") -> void:
	UI.button(ui, Vector2(90, 498), Vector2(140, 52), "BALIK", func(): Nav.go(target), Color("3a4278"), 22, "back", true)

func title(msg: String) -> void:
	UI.text(ui, Vector2(480, 44), msg, 34, Color.WHITE, {"w": 600, "outline": 7})
