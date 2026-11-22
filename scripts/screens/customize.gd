extends Screen
## Hoodie colour and accessory. Accessories unlock with stars.

var preview: Sprite2D
var swatch_buttons := {}
var acc_buttons := {}
var note: Label

func build() -> void:
	Sfx.start_music("menu")
	title("DAMIT")
	total_stars_chip(Vector2(860, 44))
	UI.panel(ui, Vector2(220, 290), Vector2(300, 380))
	UI.ellipse(ui, Vector2(220, 444), 60, 11, Color(0, 0, 0, 0.3))
	preview = UI.char_sprite(ui, UI.outfit_sheet(), Vector2(220, 444), 0, 3.0)
	var tw := preview.create_tween().set_loops()
	tw.tween_property(preview, "scale", Vector2(3.0, 3.07), 0.9).set_trans(Tween.TRANS_SINE)
	tw.tween_property(preview, "scale", Vector2(3.0, 3.0), 0.9).set_trans(Tween.TRANS_SINE)

	UI.panel(ui, Vector2(690, 180), Vector2(440, 200))
	UI.text(ui, Vector2(690, 106), "Kulay ng Hoodie", 20, Color("c9d2ff"), {"w": 300})
	var i := 0
	for h in Cfg.HOODIES:
		var hid: String = h["id"]
		var c := Vector2(540 + (i % 4) * 100, 158 + (i / 4) * 82)
		var b := Button.new()
		b.size = Vector2(56, 56)
		b.position = c - b.size / 2.0
		b.focus_mode = Control.FOCUS_NONE
		b.pressed.connect(func(): _pick_hoodie(hid))
		ui.add_child(b)
		swatch_buttons[hid] = b
		i += 1

	UI.panel(ui, Vector2(690, 394), Vector2(440, 170))
	UI.text(ui, Vector2(690, 330), "Accessory", 20, Color("c9d2ff"), {"w": 300})
	i = 0
	for a in Cfg.ACCESSORIES:
		var aid: String = a["id"]
		var locked := not Data.acc_unlocked(a)
		var label: String = a["label"] if not locked else "%s %d★" % [a["label"], int(a["stars"])]
		var ab := UI.button(ui, Vector2(560 + (i % 3) * 130, 372 + (i / 3) * 66), Vector2(122, 54), label, func(): _pick_acc(aid, a), Color("3a4278"), 15 if locked else 19)
		acc_buttons[aid] = ab
		i += 1
	note = UI.text(ui, Vector2(690, 462), "", 16, Color("ffe27a"), {"w": 400})
	back_button()
	_refresh()

func _pick_hoodie(id: String) -> void:
	Sfx.play("click")
	Data.save["outfit"]["hoodie"] = id
	Data.write_save()
	_refresh()

func _pick_acc(id: String, a: Dictionary) -> void:
	if not Data.acc_unlocked(a):
		Sfx.play("deny")
		note.text = "Kailangan ng %d bituin" % int(a["stars"])
		get_tree().create_timer(1.6).timeout.connect(func():
			if is_instance_valid(note):
				note.text = "")
		return
	Sfx.play("click")
	Data.save["outfit"]["acc"] = id
	Data.write_save()
	_refresh()

func _refresh() -> void:
	var o: Dictionary = Data.save["outfit"]
	for h in Cfg.HOODIES:
		var hid: String = h["id"]
		var sel: bool = o["hoodie"] == hid
		var sb := UI.box(h["color"], 28, Color.WHITE if sel else UI.OUTLINE, 5 if sel else 3)
		var b: Button = swatch_buttons[hid]
		for st in ["normal", "hover", "pressed", "focus"]:
			b.add_theme_stylebox_override(st, sb)
	for a in Cfg.ACCESSORIES:
		var aid: String = a["id"]
		var b2: Button = acc_buttons[aid]
		if Data.acc_unlocked(a):
			UI.set_fill(b2, Cfg.BLUE if o["acc"] == aid else Color("3a4278"))
		else:
			UI.set_fill(b2, Color("2b3050"))
	preview.texture = Data.tex(UI.outfit_sheet())
