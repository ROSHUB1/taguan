class_name SeekerBrain
extends RefCounted
## The brain of Taya (the seeker). Pure logic: it is told what is in the world and answers with where to walk.
## The game moves the body and applies the events.
##
## States: wait (counting at base), patrol (walking to the next spot), search (standing at a spot),
## investigate (walking to where something was seen or heard), chase, stunned.

var grid: Grid
var diff: Dictionary
var rnd: RandomNumberGenerator

var state := "wait"
var wait_t := Cfg.COUNTDOWN
var facing := PI / 2.0
var sight := 0.0              # 0..1, how close Taya is to noticing a hider
var alert := 0                # 0 calm, 1 curious (?), 2 chasing (!)
var target = null             # Dictionary or null
var last_known = null         # Vector2 or null
var lost_t := 0.0
var spot = null               # Dictionary or null (the spot being checked)
var certain := false          # true when Taya watched someone hide: the search will find them
var search_t := 0.0
var arrive_t := 0.0
var searched := {}            # spot id -> time of last check
var focus = null              # {pos, until}: prefer spots near here
var stun_t := 0.0
var base_facing := 0.0
var hear_cd := 0.0
var time := 0.0
var _dt := 0.016
var _last_pos = null
var stuck_t := 0.0
var stuck_n := 0
var path: Array = []
var path_i := 0
var path_dest = null
var repath_t := 0.0
var has_path := false

func _init(g: Grid, d: Dictionary, r: RandomNumberGenerator) -> void:
	grid = g
	diff = d
	rnd = r

func _clear_path() -> void:
	path = []
	has_path = false
	path_i = 0
	path_dest = null
	repath_t = 0.0

## Freeze after a catch.
func stun(t: float) -> void:
	stun_t = t
	state = "stunned"
	target = null
	sight = 0.0
	_clear_path()

## Someone hid in plain sight: the next search of that spot is certain to find them.
func notify_hide(s: Dictionary) -> void:
	spot = s
	certain = true
	state = "patrol"
	target = null
	sight = 0.0
	lost_t = 0.0
	_clear_path()

## Can Taya see this target right now? t = {pos, hidden, gone}
func sees(me: Vector2, t: Dictionary) -> bool:
	if t["hidden"] or t["gone"]:
		return false
	return _can_see(me, t["pos"], me.distance_to(t["pos"]))

func _can_see(me: Vector2, tp: Vector2, d: float) -> bool:
	if d > diff["vision"]:
		return false
	if d > 30.0:
		var a := (tp - me).angle()
		if absf(Util.angle_diff(facing, a)) > deg_to_rad(diff["fov"]) / 2.0:
			return false
	return grid.has_los(me, tp)

## w = {time, self: Vector2, targets: [{id, kind, pos, hidden, gone, invuln, noise}], spots: [{id, pos, ap}]}
func update(dt: float, w: Dictionary) -> Dictionary:
	_dt = dt
	time = w["time"]
	var ev: Array = []
	var me: Vector2 = w["self"]
	if hear_cd > 0.0:
		hear_cd -= dt

	if stun_t > 0.0:
		stun_t -= dt
		alert = 0
		if stun_t <= 0.0:
			stun_t = 0.0
			arrive_t = 0.0
			state = "investigate" if last_known != null else "patrol"
			_clear_path()
		return _out(Vector2.ZERO, 0.0, ev)

	if state == "wait":
		wait_t -= dt
		facing = -PI / 2.0     # back turned, eyes covered
		if wait_t <= 0.0:
			state = "patrol"
			ev.append({"type": "go"})
		return _out(Vector2.ZERO, 0.0, ev)

	# what can Taya see and hear?
	var seen = null
	var seen_d := INF
	for t in w["targets"]:
		if t["gone"] or t["hidden"] or t["invuln"]:
			continue
		var d := me.distance_to(t["pos"])
		if d < seen_d and _can_see(me, t["pos"], d):
			seen = t
			seen_d = d
	var was_chasing := state == "chase"
	if seen != null:
		var gain := dt / maxf(0.05, diff["react"]) * (2.5 if seen_d < 60.0 else 1.0)
		sight = minf(1.0, sight + gain)
		last_known = seen["pos"]
	else:
		sight = maxf(0.0, sight - dt * 0.7)

	if seen != null and (sight >= 1.0 or was_chasing):
		if not was_chasing:
			ev.append({"type": "spotted", "id": seen["id"], "kind": seen["kind"]})
			_clear_path()
			spot = null
			certain = false
		state = "chase"
		target = seen
		lost_t = 0.0
	elif was_chasing:
		lost_t += dt
		if lost_t > diff["lose"]:
			state = "investigate"
			arrive_t = 0.0
			target = null
			_clear_path()

	# footsteps
	if state != "chase" and hear_cd <= 0.0:
		var heard = null
		var hd := INF
		for t in w["targets"]:
			if t["gone"] or t["hidden"] or not (t["noise"] > 0.0):
				continue
			var d2 := me.distance_to(t["pos"])
			if d2 <= t["noise"] and d2 < hd:
				heard = t
				hd = d2
		if heard != null:
			last_known = heard["pos"]
			state = "investigate"
			arrive_t = 0.0
			hear_cd = 2.5
			spot = null
			_clear_path()
			ev.append({"type": "heard", "id": heard["id"]})

	# act on the current state
	var out: Dictionary
	match state:
		"chase":
			out = _do_chase(me, seen, seen_d, dt, ev)
		"investigate":
			out = _do_investigate(me, dt)
		"search":
			out = _do_search(me, dt, ev)
		_:
			out = _do_patrol(me, w, dt)

	if state == "chase":
		alert = 2
	elif sight > 0.15 or state == "investigate":
		alert = 1
	else:
		alert = 0
	_track_stuck(me, out["speed"], dt)
	return _out(out["dir"], out["speed"], ev)

func _idle() -> Dictionary:
	return {"dir": Vector2.ZERO, "speed": 0.0}

func _do_chase(me: Vector2, seen, seen_d: float, dt: float, ev: Array) -> Dictionary:
	if seen != null and seen_d <= Cfg.CATCH_RADIUS:
		ev.append({"type": "catch", "id": seen["id"], "kind": seen["kind"]})
		stun(diff["stun"])
		return _idle()
	var dest: Vector2 = me
	if seen != null:
		dest = seen["pos"]
	elif last_known != null:
		dest = last_known
	var r := _walk_to(me, dest, dt)
	if r["arrived"] or r["failed"]:
		return _idle()
	return {"dir": r["dir"], "speed": diff["chase"]}

func _do_investigate(me: Vector2, dt: float) -> Dictionary:
	if last_known == null:
		state = "patrol"
		return _idle()
	var r := _walk_to(me, last_known, dt)
	if r["arrived"] or r["failed"]:
		arrive_t += dt
		facing = base_facing + sin(arrive_t * 3.0) * 1.1
		if arrive_t > 1.4:
			focus = {"pos": last_known, "until": time + 14.0}
			last_known = null
			state = "patrol"
			spot = null
			_clear_path()
		return {"dir": Vector2.ZERO, "speed": 0.0, "keep_facing": true}
	base_facing = r["dir"].angle()
	return {"dir": r["dir"], "speed": diff["patrol"] * 1.25}

func _do_search(_me: Vector2, dt: float, ev: Array) -> Dictionary:
	search_t += dt
	facing = base_facing + sin(search_t * 3.2) * 0.8
	if search_t >= Cfg.SEARCH_TIME:
		ev.append({"type": "search", "spot_id": spot["id"], "certain": certain})
		searched[spot["id"]] = time
		spot = null
		certain = false
		state = "patrol"
		_clear_path()
	return {"dir": Vector2.ZERO, "speed": 0.0, "keep_facing": true}

func _do_patrol(me: Vector2, w: Dictionary, dt: float) -> Dictionary:
	if spot == null:
		spot = _pick_spot(me, w)
		_clear_path()
		if spot == null:
			return _idle()
	var r := _walk_to(me, spot["ap"], dt)
	if r["failed"]:
		searched[spot["id"]] = time
		spot = null
		certain = false
		return _idle()
	if r["arrived"]:
		state = "search"
		search_t = 0.0
		base_facing = (spot["pos"] - me).angle()
		return {"dir": Vector2.ZERO, "speed": 0.0, "keep_facing": true}
	return {"dir": r["dir"], "speed": diff["patrol"]}

func _pick_spot(me: Vector2, w: Dictionary):
	var pool: Array = []
	for s in w["spots"]:
		if not searched.has(s["id"]) or time - searched[s["id"]] >= Cfg.SPOT_COOLDOWN:
			pool.append(s)
	if pool.is_empty():
		pool = w["spots"].duplicate()
	if pool.is_empty():
		return null
	var f = null
	if focus != null and focus["until"] > time:
		f = focus
	var weights: Array = []
	var total := 0.0
	for s in pool:
		var wt: float = 1.0 / (me.distance_to(s["pos"]) + 90.0)
		if f != null and s["pos"].distance_to(f["pos"]) < 160.0:
			wt *= 5.0
		wt *= 0.6 + rnd.randf() * 0.8
		weights.append(wt)
		total += wt
	var r := rnd.randf() * total
	for i in pool.size():
		r -= weights[i]
		if r <= 0.0:
			return pool[i]
	return pool[pool.size() - 1]

## Direction to walk toward dest. Straight if the way is clear, otherwise along an A* path.
func _walk_to(me: Vector2, dest: Vector2, dt: float) -> Dictionary:
	var d := me.distance_to(dest)
	if d < 6.0:
		return {"dir": Vector2.ZERO, "arrived": true, "failed": false}
	if grid.segment_free(me, dest, 8.0, 6.0):
		_clear_path()
		return {"dir": (dest - me) / d, "arrived": false, "failed": false}
	repath_t -= dt
	var moved: bool = path_dest == null or path_dest.distance_to(dest) > 20.0
	if not has_path or (moved and repath_t <= 0.0):
		var p = grid.find_path(me, dest)
		path_i = 0
		path_dest = dest
		repath_t = 0.3
		if p == null:
			has_path = false
			path = []
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

## If Taya is walking but not getting anywhere, throw the path away and eventually give up on that spot.
func _track_stuck(me: Vector2, speed: float, dt: float) -> void:
	if speed > 0.0 and _last_pos != null:
		if me.distance_to(_last_pos) < speed * dt * 0.2:
			stuck_t += dt
		else:
			stuck_t = 0.0
	else:
		stuck_t = 0.0
	_last_pos = me
	if stuck_t > 0.6:
		stuck_t = 0.0
		_clear_path()
		stuck_n += 1
		if stuck_n >= 3 and state == "patrol" and spot != null:
			searched[spot["id"]] = time
			spot = null
			stuck_n = 0

func _out(dir: Vector2, speed: float, ev: Array) -> Dictionary:
	if speed > 0.0:
		facing = Util.turn_toward(facing, dir.angle(), 9.0 * _dt)
	return {"dir": dir, "speed": speed, "facing": facing, "state": state, "sight": sight, "alert": alert, "events": ev}
