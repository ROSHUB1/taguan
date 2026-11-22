extends Node
## Autoload "Nav": switches between screens. Every screen is a script that builds its own nodes.

var current: Node = null

func go(screen: String, args: Dictionary = {}) -> void:
	var script: GDScript = load("res://scripts/screens/%s.gd" % screen)
	var node: Node = script.new()
	node.set("args", args)
	if current != null and is_instance_valid(current):
		current.queue_free()
	current = node
	get_tree().root.add_child(node)
