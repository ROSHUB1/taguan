extends Screen
## How to play.

func build() -> void:
	title("PAANO LARUIN")
	var rows := [
		["boot", "Gumalaw", "Hawakan at i-drag ang kaliwang bahagi ng screen. Dahan-dahan = sneak (tahimik). Hawak ang RUN = takbo, pero napapagod ka at maririnig ka ni Taya."],
		["shield", "Magtago", "Lumapit sa halaman, drum, kahon, sako, saging o gulong at pindutin ang TAGO. Huwag magtago habang nakatingin si Taya, kasi alam na niya kung nasaan ka."],
		["heart", "3 Buhay", "Kapag nahuli ka, mawawalan ka ng puso at may sandaling proteksyon. Kapag naubos ang puso, talo ka. Kapag nahanap ka sa taguan, huli ka rin."],
		["star", "Bahay (Save!)", "Kapag nahuli ang mga kaibigan mo, pumunta sa bandila at pindutin ang SAVE! habang malayo si Taya. Makakalaya silang lahat."],
		["trophy", "Manalo", "Tumagal hanggang maubos ang oras. Mas maraming puso, mas maraming bituin. Ang bituin ay nag-a-unlock ng mapa at accessories."],
	]
	for i in rows.size():
		var y := 126.0 + i * 76.0
		UI.panel(ui, Vector2(480, y), Vector2(860, 68), Cfg.PANEL, Color("5f72c8"), 12)
		UI.icon(ui, rows[i][0], Vector2(82, y), 44)
		UI.text(ui, Vector2(130 + 380, y - 18), rows[i][1], 20, Color("ffe27a"), {"w": 760, "left": true})
		UI.text(ui, Vector2(130 + 380, y + 12), rows[i][2], 14, Color("e3e8ff"), {"w": 760, "h": 40, "left": true, "wrap": true, "outline": 2})
	back_button()
