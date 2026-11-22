// Drawing helpers for the procedural pixel art. Canvas only (no Phaser), so it can be previewed in any browser.
const PX = {
  OUT: '#17142b',

  r(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  },

  // filled circle drawn as horizontal runs, so edges stay pixel-sharp
  disc(ctx, cx, cy, rad, c) {
    ctx.fillStyle = c;
    for (let y = -rad; y <= rad; y++) {
      const w = Math.floor(Math.sqrt(rad * rad - y * y));
      ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  },

  ellipse(ctx, cx, cy, rx, ry, c) {
    ctx.fillStyle = c;
    for (let y = -ry; y <= ry; y++) {
      const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  },

  // dark outline first, then the fill on top (outline = 2px wider each side)
  ellipseO(ctx, cx, cy, rx, ry, fill, outline) {
    PX.ellipse(ctx, cx, cy, rx + 2, ry + 2, outline || PX.OUT);
    PX.ellipse(ctx, cx, cy, rx, ry, fill);
  },
  discO(ctx, cx, cy, rad, fill, outline) {
    PX.disc(ctx, cx, cy, rad + 2, outline || PX.OUT);
    PX.disc(ctx, cx, cy, rad, fill);
  },

  // rectangle with a 2px outline, a light top edge and a dark bottom edge
  box(ctx, x, y, w, h, fill, light, dark) {
    PX.r(ctx, x - 2, y - 2, w + 4, h + 4, PX.OUT);
    PX.r(ctx, x, y, w, h, fill);
    if (light !== null) PX.r(ctx, x, y, w, 3, light || PX.shade(fill, 1.25));
    if (dark !== null) PX.r(ctx, x, y + h - 3, w, 3, dark || PX.shade(fill, 0.72));
  },

  shadow(ctx, cx, cy, rx, ry, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.28 : alpha;
    PX.ellipse(ctx, cx, cy, rx, ry, '#000000');
    ctx.restore();
  },

  poly(ctx, pts, fill, outline) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (outline) { ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = outline; ctx.stroke(); }
    ctx.fillStyle = fill;
    ctx.fill();
  },

  // multiply a #rrggbb colour's brightness
  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * f)));
    g = Math.max(0, Math.min(255, Math.round(g * f)));
    b = Math.max(0, Math.min(255, Math.round(b * f)));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  },

  canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
};
