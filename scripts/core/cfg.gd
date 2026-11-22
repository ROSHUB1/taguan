class_name Cfg
extends RefCounted
## All tuning numbers in one place. Change numbers here, not in the game code.

const TILE := 32                 # world pixels per map tile
const VIEW_HEIGHT := 400.0       # world pixels visible top to bottom
const DESIGN := Vector2(960, 540)

const SNEAK := 52.0
const WALK := 100.0
const RUN := 168.0
const ACTOR_SCALE := 0.5         # character frames are 100px tall, shown about 50 world px

const STAMINA_MAX := 100.0
const STAMINA_DRAIN := 30.0
const STAMINA_REGEN := 22.0
const STAMINA_DELAY := 0.7
const STAMINA_MIN_RUN := 14.0

const HEARTS := 3
const COUNTDOWN := 9.0
const CATCH_RADIUS := 19.0
const INVULN := 2.2
const HIDE_RANGE := 42.0
const BASE_RANGE := 54.0
const BASE_SAFE_DIST := 170.0
const SEARCH_TIME := 1.5
const SPOT_COOLDOWN := 24.0
const BODY_HW := 7.0
const BODY_HH := 5.0

# Taya settings per difficulty. patrol/chase = speeds, vision px, fov degrees, react = seconds of seeing you
# before a chase, lose = seconds she keeps chasing after losing sight, find = multiplier on spot find chance,
# hear_run / hear_walk = noise radius multipliers, hiders = number of AI kids, time = round seconds.
const DIFFICULTY := {
	"easy": {"id": "easy", "label": "Madali", "patrol": 62.0, "chase": 112.0, "vision": 150.0, "fov": 84.0, "react": 0.75, "lose": 0.6, "find": 0.65, "hear_run": 0.7, "hear_walk": 0.0, "hiders": 4, "time": 150.0, "stun": 2.8},
	"normal": {"id": "normal", "label": "Katamtaman", "patrol": 72.0, "chase": 126.0, "vision": 175.0, "fov": 96.0, "react": 0.5, "lose": 1.0, "find": 1.0, "hear_run": 1.0, "hear_walk": 0.6, "hiders": 5, "time": 165.0, "stun": 2.4},
	"hard": {"id": "hard", "label": "Mahirap", "patrol": 82.0, "chase": 140.0, "vision": 200.0, "fov": 108.0, "react": 0.3, "lose": 1.5, "find": 1.3, "hear_run": 1.25, "hear_walk": 1.0, "hiders": 7, "time": 180.0, "stun": 2.0},
}
const DIFFICULTY_ORDER := ["easy", "normal", "hard"]

# Chance that one search of a hiding spot finds someone inside (before the difficulty multiplier).
const SPOT_FIND := {"bush": 0.50, "saging": 0.45, "barrel": 0.35, "crates": 0.50, "sako": 0.40, "tire": 0.50}

const NPC_NAMES := ["Mina", "Jun", "Bea", "Totoy", "Pepe", "Lisa", "Ramon", "Dindo", "Aling Nena", "Kuya Ben"]

# Hoodie colours are free. Accessories unlock with total stars.
const HOODIES := [
	{"id": "blue", "label": "Asul", "color": Color(0.1843, 0.4353, 0.8784)},
	{"id": "pink", "label": "Rosas", "color": Color(0.8784, 0.3137, 0.6039)},
	{"id": "green", "label": "Berde", "color": Color(0.2157, 0.6980, 0.3020)},
	{"id": "yellow", "label": "Dilaw", "color": Color(0.9490, 0.7608, 0.1882)},
	{"id": "orange", "label": "Kahel", "color": Color(0.9412, 0.5490, 0.1647)},
	{"id": "red", "label": "Pula", "color": Color(0.8784, 0.1922, 0.1922)},
	{"id": "purple", "label": "Lila", "color": Color(0.6118, 0.3020, 0.8588)},
	{"id": "white", "label": "Puti", "color": Color(0.9098, 0.9255, 0.9608)},
]
const ACCESSORIES := [
	{"id": "none", "label": "Wala", "stars": 0},
	{"id": "salakot", "label": "Salakot", "stars": 0},
	{"id": "cap", "label": "Cap", "stars": 2},
	{"id": "headphones", "label": "Headphones", "stars": 4},
	{"id": "crown", "label": "Korona", "stars": 8},
]

# Character sheet layout: 7 columns x 2 rows of 64x100 cells
const CELL_W := 64
const CELL_H := 100
const SHEET_COLS := 7
const FEET_Y := 98
# Frames: 0 down, 1 up, 2 left, 3 right, 4-8 run right, 9-13 run left

# Palette
const NAVY := Color(0.1020, 0.1216, 0.2275)
const SKY := Color(0.0706, 0.0941, 0.2118)
const PANEL := Color(0.1373, 0.1647, 0.3216)
const BLUE := Color(0.1843, 0.4353, 0.8784)
const GREEN := Color(0.2157, 0.6980, 0.3020)
const GOLD := Color(0.9647, 0.7882, 0.2706)
const RED := Color(0.8784, 0.1922, 0.1922)
