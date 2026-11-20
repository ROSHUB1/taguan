// Draws a map model onto a canvas. Used by the game (ground layer), the map select cards and the minimap.
// Canvas only, no Phaser.
const MapRender = {
  // Whole map: ground + decals + all objects, back to front. For previews and map cards.
  full(model) {
    const T = CONFIG.TILE;
    const c = Ground.build(model);
    const ctx = c.getContext('2d');
    const list = model.objects.slice().sort((a, b) => a.ty - b.ty);
    for (const o of list) {
      const d = o.def;
      ctx.drawImage(Objects.canvas(o.type, o.v), (o.tx - d.ax) * T, (o.ty - d.ay) * T, d.w * T, d.h * T);
    }
    return c;
  },

  // Tiny map: one block of `px` pixels per tile
  mini(model, px) {
    const c = PX.canvas(model.cols * px, model.rows * px);
    const ctx = c.getContext('2d');
    for (let y = 0; y < model.rows; y++) for (let x = 0; x < model.cols; x++) {
      ctx.fillStyle = Ground.mini[model.ground[y * model.cols + x]];
      ctx.fillRect(x * px, y * px, px, px);
    }
    for (const o of model.objects) {
      for (const [dx, dy] of o.def.solid) {
        ctx.fillStyle = o.def.opaque.length ? '#8b6b52' : (o.def.hide ? '#2f7d38' : '#4a4f66');
        if (o.type === 'tree' || o.type === 'palm') ctx.fillStyle = '#2c6a35';
        ctx.fillRect((o.tx + dx) * px, (o.ty + dy) * px, px, px);
      }
    }
    return c;
  }
};
