class_name Grid
extends RefCounted
## Collision grid: solid tiles block walking, opaque tiles block sight. Also path finding.

var cols: int
var rows: int
var tile: int
var solid := PackedByteArray()
var opaque := PackedByteArray()
var astar: AStarGrid2D

func _init(c: int, r: int, t: int) -> void:
	cols = c
	rows = r
	tile = t
	solid.resize(c * r)
	opaque.resize(c * r)

## Fill from the exported map json: arrays of strings of "0"/"1"
func load_rows(solid_rows: Array, opaque_rows: Array) -> void:
	for y in rows:
		var sr: String = solid_rows[y]
		var orow: String = opaque_rows[y]
		for x in cols:
			solid[y * cols + x] = 1 if sr[x] == "1" else 0
			opaque[y * cols + x] = 1 if orow[x] == "1" else 0
	_build_astar()

func _build_astar() -> void:
	astar = AStarGrid2D.new()
	astar.region = Rect2i(0, 0, cols, rows)
	astar.cell_size = Vector2(1, 1)
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	astar.default_compute_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	astar.default_estimate_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	astar.update()
	for y in rows:
		for x in cols:
			if solid[y * cols + x] == 1:
				astar.set_point_solid(Vector2i(x, y), true)

func in_bounds(tx: int, ty: int) -> bool:
	return tx >= 0 and ty >= 0 and tx < cols and ty < rows

func is_solid(tx: int, ty: int) -> bool:
	return not in_bounds(tx, ty) or solid[ty * cols + tx] == 1

func is_opaque(tx: int, ty: int) -> bool:
	return not in_bounds(tx, ty) or opaque[ty * cols + tx] == 1

func tile_of(p: float) -> int:
	return int(floor(p / tile))

func center_of(t: int) -> float:
	return t * tile + tile / 2.0

func solid_at(p: Vector2) -> bool:
	return is_solid(tile_of(p.x), tile_of(p.y))

## Is a box centred at p with half sizes hw, hh free of solid tiles?
func box_free(p: Vector2, hw: float, hh: float) -> bool:
	var x0 := tile_of(p.x - hw)
	var x1 := tile_of(p.x + hw - 0.001)
	var y0 := tile_of(p.y - hh)
	var y1 := tile_of(p.y + hh - 0.001)
	for ty in range(y0, y1 + 1):
		for tx in range(x0, x1 + 1):
			if is_solid(tx, ty):
				return false
	return true

## Move a box by d, sliding along walls. Returns the new position.
func move_box(p: Vector2, d: Vector2, hw: float, hh: float) -> Vector2:
	var steps := maxi(1, int(ceil(maxf(absf(d.x), absf(d.y)) / 2.0)))
	var sx := d.x / steps
	var sy := d.y / steps
	for i in steps:
		if sx != 0.0 and box_free(Vector2(p.x + sx, p.y), hw, hh):
			p.x += sx
		if sy != 0.0 and box_free(Vector2(p.x, p.y + sy), hw, hh):
			p.y += sy
	return p

## Can a see b? Only opaque tiles (houses, walls) block sight.
func has_los(a: Vector2, b: Vector2) -> bool:
	var d := a.distance_to(b)
	var n := int(ceil(d / 8.0))
	for i in range(1, n):
		var t := float(i) / n
		var q := a.lerp(b, t)
		if is_opaque(tile_of(q.x), tile_of(q.y)):
			return false
	return true

## Farthest distance along a ray before it hits an opaque tile (used for the vision cone).
func ray_length(p: Vector2, angle: float, max_len: float) -> float:
	var dir := Vector2.from_angle(angle)
	var d := 6.0
	while d < max_len:
		var q := p + dir * d
		if is_opaque(tile_of(q.x), tile_of(q.y)):
			return d - 6.0
		d += 6.0
	return max_len

## Nearest walkable tile to (tx, ty) within max_r tiles, or Vector2i(-1, -1).
func nearest_free(tx: int, ty: int, max_r: int) -> Vector2i:
	for r in range(0, max_r + 1):
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if maxi(absi(dx), absi(dy)) != r:
					continue
				if not is_solid(tx + dx, ty + dy):
					return Vector2i(tx + dx, ty + dy)
	return Vector2i(-1, -1)

## Flood fill: which tiles can be reached on foot from (tx, ty)?
func reachable_from(tx: int, ty: int) -> PackedByteArray:
	var seen := PackedByteArray()
	seen.resize(cols * rows)
	if is_solid(tx, ty):
		return seen
	var q: Array[int] = [tx + ty * cols]
	seen[q[0]] = 1
	var h := 0
	while h < q.size():
		var i: int = q[h]
		h += 1
		var x := i % cols
		var y := i / cols
		for nb in [Vector2i(x + 1, y), Vector2i(x - 1, y), Vector2i(x, y + 1), Vector2i(x, y - 1)]:
			if is_solid(nb.x, nb.y):
				continue
			var j: int = nb.x + nb.y * cols
			if seen[j] == 0:
				seen[j] = 1
				q.append(j)
	return seen

## Is a straight walk from a to b clear for a body of this size?
func segment_free(a: Vector2, b: Vector2, hw: float, hh: float) -> bool:
	var d := a.distance_to(b)
	var n := maxi(1, int(ceil(d / 4.0)))
	for i in range(0, n + 1):
		if not box_free(a.lerp(b, float(i) / n), hw, hh):
			return false
	return true

## Path from s to e in world pixels as a list of waypoints (Vector2), or null if there is none.
func find_path(s: Vector2, e: Vector2, hw: float = 8.0, hh: float = 6.0):
	var st := Vector2i(tile_of(s.x), tile_of(s.y))
	var en := Vector2i(tile_of(e.x), tile_of(e.y))
	if is_solid(st.x, st.y):
		st = nearest_free(st.x, st.y, 3)
		if st.x < 0:
			return null
	if is_solid(en.x, en.y):
		en = nearest_free(en.x, en.y, 3)
		if en.x < 0:
			return null
	if st == en:
		return [e]
	var ids: Array[Vector2i] = astar.get_id_path(st, en)
	if ids.is_empty():
		return null
	var pts: Array[Vector2] = [s]
	for k in range(1, ids.size()):
		pts.append(Vector2(center_of(ids[k].x), center_of(ids[k].y)))
	# last point: the exact target when it is inside the end tile and free
	if tile_of(e.x) == en.x and tile_of(e.y) == en.y and box_free(e, hw, hh):
		pts[pts.size() - 1] = e
	# string pulling: skip waypoints that can be reached in a straight line
	var out: Array[Vector2] = []
	var i := 0
	while i < pts.size() - 1:
		var j := pts.size() - 1
		while j > i + 1 and not segment_free(pts[i], pts[j], hw, hh):
			j -= 1
		out.append(pts[j])
		i = j
	return out
