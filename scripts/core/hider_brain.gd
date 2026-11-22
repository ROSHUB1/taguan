class_name HiderBrain
extends RefCounted
## Brain of an AI hider (one of the other kids). States: go (walking to a free spot), flee (saw Taya, running
## to a far spot), hidden.

var grid: Grid
var rnd: RandomNumberGenerator
var id: String
var state := "go"
var spot = null
var hidden_t := 0.0
var relocate_at := 0.0
var path: Array = []
var has_path := false
var path_i := 0
var stuck_t := 0.0
var _last_pos = null
var delay := 0.0

func _init(g: Grid, r: RandomNumberGenerator, i: String) -> void:
	grid = g
	rnd = r
	id = i
	relocate_at = 16.0 + rnd.randf() * 22.0
	delay = rnd.randf() * 1.2     # not everyone sets off at the same instant

func _clear_path() -> void:
	path = []
	has_path = false
	path_i = 0

func _idle(ev: Array) -> Dictionary:
	return {"dir": Vector2.ZERO, "speed": 0.0, "events": ev}

## w = {time, self: Vector2, seeker: Vector2, spots: [{id, pos, ap, owner}]}
func update(dt: float, w: Dictionary) -> Dictionary:
	var ev: Array = []
	var me: Vector2 = w["self"]
	var sk: Vector2 = w["seeker"]
	var sd := me.distance_to(sk)

	if delay > 0.0:
		delay -= dt
		return _idle(ev)

	if state == "hidden":
		hidden_t += dt
		if hidden_t > relocate_at:
			relocate_at = hidden_t + 14.0 + rnd.randf() * 14.0
			# sometimes sneak off to a new spot, but only when Taya is far away
			if sd > 280.0 and rnd.randf() < 0.35:
				ev.append({"type": "unhide", "spot_id": spot["id"]})
				ev.append({"type": "release", "spot_id": spot["id"]})
				spot = null
				state = "go"
				_clear_path()
		return _idle(ev)

	# Taya nearby and in sight: run
	if state == "go" and sd < 140.0 and grid.has_los(me, sk):
		state = "flee"
		if spot != null:
			ev.append({"type": "release", "spot_id": spot["id"]})
			spot = null
		_clear_path()

	if spot == null:
		spot = _pick_spot(me, sk, w["spots"], state == "flee")
		if spot == null:
			return _idle(ev)
		ev.append({"type": "claim", "spot_id": spot["id"]})
		_clear_path()

	var r := _walk_to(me, spot["ap"])
	if r["failed"]:
		ev.append({"type": "release", "spot_id": spot["id"]})
		spot = null
		return _idle(ev)
	if r["arrived"]:
		state = "hidden"
		hidden_t = 0.0
		ev.append({"type": "hide", "spot_id": spot["id"]})
		return _idle(ev)
	_track_stuck(me, dt)
	return {"dir": r["dir"], "speed": 150.0 if state == "flee" else 92.0, "events": ev}

func _pick_spot(me: Vector2, sk: Vector2, spots: Array, fleeing: bool):
	var free: Array = []
	for s in spots:
		if s["owner"] == "":
			free.append(s)
	if free.is_empty():
		return null
	var weights: Array = []
	var total := 0.0
	for s in free:
		var d_me := me.distance_to(s["pos"])
		var d_sk := sk.distance_to(s["pos"])
		var wt := 1.0 / (d_me + 120.0)
		if d_sk < 200.0:
			wt *= 0.02 if fleeing else 0.35
		wt *= 0.5 + rnd.randf()
		weights.append(wt)
		total += wt
	var r := rnd.randf() * total
	for i in free.size():
		r -= weights[i]
		if r <= 0.0:
			return free[i]
	return free[free.size() - 1]

func _walk_to(me: Vector2, dest: Vector2) -> Dictionary:
	var d := me.distance_to(dest)
	if d < 6.0:
		return {"dir": Vector2.ZERO, "arrived": true, "failed": false}
	if grid.segment_free(me, dest, 8.0, 6.0):
		_clear_path()
		return {"dir": (dest - me) / d, "arrived": false, "failed": false}
	if not has_path:
		var p = grid.find_path(me, dest)
		path_i = 0
		if p == null:
			return {"dir": Vector2.ZERO, "arrived": false, "failed": true}
		path = p
		has_path = true
	while path_i < path.size() and me.distance_to(path[path_i]) < 6.0:
		path_i += 1
	if path_i >= path.size():
		return {"dir": Vector2.ZERO, "arrived": true, "failed": false}
	var wp: Vector2 = path[path_i]
	var pd := maxf(me.distance_to(wp), 0.001)
	return {"dir": (wp - me) / pd, "arrived": false, "failed": false}

func _track_stuck(me: Vector2, dt: float) -> void:
	if _last_pos != null and me.distance_to(_last_pos) < 0.4:
		stuck_t += dt
	else:
		stuck_t = 0.0
	_last_pos = me
	if stuck_t > 0.7:
		stuck_t = 0.0
		_clear_path()
