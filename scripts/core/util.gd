class_name Util
extends RefCounted
## Small shared helpers.

static func angle_diff(a: float, b: float) -> float:
	# shortest signed difference between two angles
	var d := fmod(b - a, TAU)
	if d > PI:
		d -= TAU
	if d <= -PI:
		d += TAU
	return d

static func turn_toward(cur: float, target: float, max_step: float) -> float:
	var d := angle_diff(cur, target)
	if absf(d) <= max_step:
		return target
	return cur + signf(d) * max_step

static func fmt_time(sec: float) -> String:
	var s := maxi(0, int(ceil(sec)))
	return "%d:%02d" % [floori(s / 60.0), s % 60]

static func shuffle(arr: Array, rnd: RandomNumberGenerator) -> Array:
	for i in range(arr.size() - 1, 0, -1):
		var j := rnd.randi_range(0, i)
		var t = arr[i]
		arr[i] = arr[j]
		arr[j] = t
	return arr
