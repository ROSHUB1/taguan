// Saved progress and settings. Uses localStorage when it works, memory otherwise.
const Save = {
  KEY: 'taguan.save.v1',
  data: null,

  defaults() {
    return {
      settings: { music: true, sfx: true, vibrate: true, difficulty: 'normal' },
      outfit: { hoodie: 'blue', acc: 'none' },
      stars: {},                       // best stars per map id
      stats: { played: 0, wins: 0, caught: 0, saves: 0 },
      seenTips: false
    };
  },

  load() {
    const d = Save.defaults();
    try {
      const raw = window.localStorage.getItem(Save.KEY);
      if (raw) {
        const o = JSON.parse(raw);
        Object.assign(d.settings, o.settings || {});
        Object.assign(d.outfit, o.outfit || {});
        Object.assign(d.stats, o.stats || {});
        d.stars = o.stars || {};
        d.seenTips = !!o.seenTips;
      }
    } catch (e) { /* private mode or blocked storage: keep defaults */ }
    Save.data = d;
    return d;
  },

  write() {
    try { window.localStorage.setItem(Save.KEY, JSON.stringify(Save.data)); } catch (e) { /* ignore */ }
  },

  totalStars() {
    let n = 0;
    for (const k in Save.data.stars) n += Save.data.stars[k] || 0;
    return n;
  },

  // Record a finished round. Returns what changed so the result screen can show it.
  recordRound(mapId, won, stars, saved, caught) {
    const s = Save.data;
    const before = Save.totalStars();
    s.stats.played++;
    if (won) s.stats.wins++;
    if (saved) s.stats.saves++;
    s.stats.caught += caught;
    const prev = s.stars[mapId] || 0;
    if (stars > prev) s.stars[mapId] = stars;
    Save.write();
    const after = Save.totalStars();
    const unlocked = ACCESSORIES.filter(a => a.stars > before && a.stars <= after);
    return { improved: stars > prev, unlocked };
  },

  isUnlockedAcc(acc) { return Save.totalStars() >= acc.stars; }
};
