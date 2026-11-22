class_name NightSky
extends Control
## Starry night backdrop drawn well past the 960x540 design area so it fills any phone screen.

func _draw() -> void:
	draw_rect(Rect2(-600, -400, 2200, 1400), Color("121836"))
	draw_rect(Rect2(-600, 300, 2200, 700), Color("1a2350"))
	draw_rect(Rect2(-600, 420, 2200, 600), Color("222d66"))
	var rnd := RandomNumberGenerator.new()
	rnd.seed = 3
	for i in 120:
		var s := 3.0 if rnd.randf() < 0.2 else 2.0
		var c := Color(1, 1, 1, 0.3 + rnd.randf() * 0.6)
		draw_rect(Rect2(-300 + rnd.randf() * 1560, -150 + rnd.randf() * 450, s, s), c)
	draw_circle(Vector2(820, 90), 34, Color("fff3c4"))
	draw_circle(Vector2(836, 82), 30, Color("121836"))
