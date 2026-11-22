extends Node
## Autoload "Data": map loading, texture cache and saved progress.

const SAVE_PATH := "user://taguan_save.json"

var save := {}
var maps_meta: Array = []
var catalog := {}
var _tex := {}

func _ready() -> void:
	maps_meta = read_json("res://data/maps.json")
	catalog = read_json("res://data/objects.json")
	load_save()

func read_json(path: String):
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("Cannot open " + path)
		return null
	return JSON.parse_string(f.get_as_text())

func tex(path: String) -> Texture2D:
	if not _tex.has(path):
		_tex[path] = load(path)
	return _tex[path]

# ------------------------------------------------------------------ save data
func defaults() -> Dictionary:
	return {
		"settings": {"music": true, "sfx": true, "vibrate": true, "difficulty": "normal"},
		"outfit": {"hoodie": "blue", "acc": "none"},
		"stars": {},
		"stats": {"played": 0, "wins": 0, "caught": 0, "saves": 0},
	}

func load_save() -> void:
	save = defaults()
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		return
	var o = JSON.parse_string(f.get_as_text())
	if typeof(o) != TYPE_DICTIONARY:
		return
	for k in ["settings", "outfit", "stats"]:
		if o.has(k) and typeof(o[k]) == TYPE_DICTIONARY:
			for kk in o[k]:
				save[k][kk] = o[k][kk]
	if o.has("stars") and typeof(o["stars"]) == TYPE_DICTIONARY:
		save["stars"] = o["stars"]

func write_save() -> void:
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(save))

func reset_save() -> void:
	save = defaults()
	write_save()

func total_stars() -> int:
	var n := 0
	for k in save["stars"]:
		n += int(save["stars"][k])
	return n

func best_stars(map_id: String) -> int:
	return int(save["stars"].get(map_id, 0))

func acc_unlocked(acc: Dictionary) -> bool:
	return total_stars() >= int(acc["stars"])

## Record a finished round. Returns {improved, unlocked: [accessory dicts]}
func record_round(map_id: String, won: bool, stars: int, saved: bool, caught: int) -> Dictionary:
	var st: Dictionary = save["stats"]
	var before := total_stars()
	st["played"] = int(st["played"]) + 1
	if won:
		st["wins"] = int(st["wins"]) + 1
	if saved:
		st["saves"] = int(st["saves"]) + 1
	st["caught"] = int(st["caught"]) + caught
	var prev := best_stars(map_id)
	if stars > prev:
		save["stars"][map_id] = stars
	write_save()
	var after := total_stars()
	var unlocked: Array = []
	for a in Cfg.ACCESSORIES:
		if int(a["stars"]) > before and int(a["stars"]) <= after:
			unlocked.append(a)
	return {"improved": stars > prev, "unlocked": unlocked}

# ------------------------------------------------------------------ maps
func map_meta(id: String) -> Dictionary:
	for m in maps_meta:
		if m["id"] == id:
			return m
	return {}

## Full map model: collision grid, objects, hiding spots, base and spawn points.
func build_map(id: String) -> Dictionary:
	var d: Dictionary = read_json("res://data/%s.json" % id)
	var cols := int(d["cols"])
	var rows := int(d["rows"])
	var grid := Grid.new(cols, rows, Cfg.TILE)
	grid.load_rows(d["solid"], d["opaque"])
	var spots: Array = []
	for s in d["spots"]:
		spots.append({
			"id": s["id"], "type": s["type"], "tx": int(s["tx"]), "ty": int(s["ty"]),
			"pos": Vector2(s["x"], s["y"]), "ap": Vector2(s["ax"], s["ay"]), "owner": "",
		})
	var objects: Array = []
	for o in d["objects"]:
		objects.append({"type": o["type"], "v": int(o["v"]), "tx": int(o["tx"]), "ty": int(o["ty"]), "spot": o["spot"]})
	var npc: Array = []
	for p in d["npcSpawns"]:
		npc.append(Vector2(p["x"], p["y"]))
	var tint: Dictionary = d["tint"]
	return {
		"id": id, "name": d["name"], "sub": d["sub"], "desc": d["desc"], "unlock": int(d["unlock"]),
		"cols": cols, "rows": rows, "grid": grid, "objects": objects, "spots": spots,
		"base": Vector2(d["base"]["x"], d["base"]["y"]),
		"player_spawn": Vector2(d["playerSpawn"]["x"], d["playerSpawn"]["y"]),
		"seeker_start": Vector2(d["seekerStart"]["x"], d["seekerStart"]["y"]),
		"npc_spawns": npc,
		"tint_color": Color.hex(int(tint["color"]) * 256 + 255), "tint_alpha": float(tint["alpha"]),
	}
