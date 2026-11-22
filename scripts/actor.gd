class_name Actor
extends Node2D
## One kid on the map (the player, Taya or another hider). `position` is where the feet are.

var id := ""
var kind := ""                # "player", "seeker" or "npc"
var npc_name := ""
var face := "down"
var anim_t := 0.0
var frame := 0
var bob := 0.0
var hidden := false
var gone := false             # caught and waiting at the flag
var invuln := 0.0
var noise := 0.0              # radius Taya can hear
var spot = null               # Dictionary of the hiding spot we are in
var brain = null
var stamina := Cfg.STAMINA_MAX
var exhausted := false
var regen_delay := 0.0
var hearts := Cfg.HEARTS
var speed := 0.0
var sprite: Sprite2D
var shadow: Polygon2D

func setup(sheet_path: String) -> void:
	shadow = UI.ellipse(self, Vector2.ZERO, 8, 3, Color(0, 0, 0, 0.3))
	shadow.z_index = -1
	sprite = Sprite2D.new()
	sprite.texture = Data.tex(sheet_path)
	sprite.hframes = Cfg.SHEET_COLS
	sprite.vframes = 2
	sprite.centered = false
	sprite.offset = Vector2(-32, -Cfg.FEET_Y)
	sprite.scale = Vector2(Cfg.ACTOR_SCALE, Cfg.ACTOR_SCALE)
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	add_child(sprite)

func set_face(d: Vector2) -> void:
	if absf(d.x) < 0.001 and absf(d.y) < 0.001:
		return
	if absf(d.x) > absf(d.y):
		face = "right" if d.x > 0.0 else "left"
	else:
		face = "down" if d.y > 0.0 else "up"

func animate(spd: float, dt: float) -> void:
	bob = 0.0
	if spd > 1.0:
		anim_t += dt * (spd / 11.0)
		if face == "right":
			frame = 4 + (int(anim_t) % 5)
		elif face == "left":
			frame = 9 + (int(anim_t) % 5)
		else:
			frame = 0 if face == "down" else 1
			bob = absf(sin(anim_t * 1.3)) * 2.0
	else:
		match face:
			"down":
				frame = 0
			"up":
				frame = 1
			"left":
				frame = 2
			_:
				frame = 3

func set_hidden(v: bool) -> void:
	hidden = v
	visible = not v

func refresh(now_ms: int) -> void:
	z_index = int(position.y)
	sprite.frame = frame
	sprite.position = Vector2(0, -bob)
	if invuln > 0.0:
		sprite.modulate.a = 1.0 if sin(now_ms / 45.0) > 0.0 else 0.3
	elif not gone:
		sprite.modulate.a = 1.0
