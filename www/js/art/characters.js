// Character sheets: takes the sprite sheet cut from the concept art and applies a hoodie colour and a hat.
// Canvas only (no Phaser). The result is a canvas with the same 14 frame layout as the source sheet.
//
// Frame index: 0 down, 1 up, 2 left, 3 right, 4-8 run right, 9-13 run left.
const CharArt = {
  images: {},        // 'hider' / 'seeker' -> HTMLImageElement, filled by the boot scene

  faceOf(i) {
    if (i === 0) return 'down';
    if (i === 1) return 'up';
    if (i === 2 || i >= 9) return 'left';
    return 'right';
  },

  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  },

  hslToRgb(h, s, l) {
    const f = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [Math.round(f(p, q, h + 1 / 3) * 255), Math.round(f(p, q, h) * 255), Math.round(f(p, q, h - 1 / 3) * 255)];
  },

  // Change the blue hoodie (and blue shoe details) to another colour. Head and dark trousers are left alone.
  recolor(ctx, hoodie, anchors, M) {
    if (!hoodie || (hoodie.hue === null && !hoodie.desat)) return;
    const W = M.cols * M.cellW, H = 2 * M.cellH;
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const delta = hoodie.hue === null ? 0 : (hoodie.hue - 222) / 360;
    for (let i = 0; i < 14; i++) {
      const cx0 = (i % M.cols) * M.cellW, cy0 = Math.floor(i / M.cols) * M.cellH;
      const a = anchors[i];
      const cutY = Math.floor(cy0 + a.top + a.h * (i < 4 ? 0.46 : 0.5));
      for (let y = cutY; y < cy0 + M.cellH; y++) {
        for (let x = cx0; x < cx0 + M.cellW; x++) {
          const p = (y * W + x) * 4;
          if (d[p + 3] < 10) continue;
          const hsl = CharArt.rgbToHsl(d[p], d[p + 1], d[p + 2]);
          const hue = hsl[0] * 360;
          if (hue < 190 || hue > 250 || hsl[1] < 0.5 || hsl[2] < 0.22) continue;
          let nh = hsl[0], ns = hsl[1], nl = hsl[2];
          if (hoodie.desat) { ns *= 0.1; nl = Math.min(0.97, nl * 1.35 + 0.28); }
          else { nh = (nh + delta + 1) % 1; if (hoodie.light) nl = Math.min(0.9, nl + hoodie.light); }
          const rgb = CharArt.hslToRgb(nh, ns, nl);
          d[p] = rgb[0]; d[p + 1] = rgb[1]; d[p + 2] = rgb[2];
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  },

  // Draw a hat on top of the head of one frame. A = {cx, top, w, h} measured from the sprite, face = direction.
  accessory(ctx, id, A, face, ox, oy) {
    if (!id || id === 'none') return;
    const cx = ox + A.cx, top = oy + A.top, w = A.w;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (id === 'salakot') {
      const by = top + w * 0.7;
      ctx.fillStyle = '#17142b';
      ctx.beginPath(); ctx.ellipse(cx, by, w * 0.7, w * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e2b95b';
      ctx.beginPath(); ctx.ellipse(cx, by, w * 0.66, w * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#17142b'; ctx.lineWidth = 2;
      ctx.fillStyle = '#e9c76f';
      ctx.beginPath(); ctx.moveTo(cx - w * 0.4, by - 1); ctx.lineTo(cx, by - w * 0.5); ctx.lineTo(cx + w * 0.4, by - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#b68a35';
      ctx.beginPath(); ctx.moveTo(cx + w * 0.08, by - 1); ctx.lineTo(cx, by - w * 0.5); ctx.lineTo(cx + w * 0.4, by - 1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a77a2c'; ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - w * 0.4 * (1 - i / 4), by - w * 0.125 * i); ctx.lineTo(cx + w * 0.4 * (1 - i / 4), by - w * 0.125 * i); ctx.stroke(); }
      ctx.fillStyle = '#8a2f2f'; ctx.fillRect(cx - w * 0.4, by - 4, w * 0.8, 4);
    } else if (id === 'cap') {
      const by = top + w * 0.56;
      ctx.fillStyle = '#17142b';
      ctx.beginPath(); ctx.ellipse(cx, by - w * 0.04, w * 0.56, w * 0.46, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#d63a3a';
      ctx.beginPath(); ctx.ellipse(cx, by - w * 0.04, w * 0.51, w * 0.41, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f26a6a';
      ctx.beginPath(); ctx.ellipse(cx - w * 0.12, by - w * 0.22, w * 0.18, w * 0.09, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a82424';
      ctx.fillRect(cx - w * 0.5, by - w * 0.08, w, w * 0.07);
      if (face !== 'up') {
        ctx.fillStyle = '#17142b';
        if (face === 'down') { ctx.beginPath(); ctx.ellipse(cx, by + w * 0.02, w * 0.46, w * 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
        else { const dir = face === 'right' ? 1 : -1; ctx.beginPath(); ctx.ellipse(cx + dir * w * 0.5, by, w * 0.3, w * 0.1, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#bd2f2f';
        if (face === 'down') { ctx.beginPath(); ctx.ellipse(cx, by + w * 0.01, w * 0.42, w * 0.09, 0, 0, Math.PI * 2); ctx.fill(); }
        else { const dir = face === 'right' ? 1 : -1; ctx.beginPath(); ctx.ellipse(cx + dir * w * 0.5, by - 1, w * 0.26, w * 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
      }
    } else if (id === 'headphones') {
      const cy = top + w * 0.8;
      ctx.strokeStyle = '#17142b'; ctx.lineWidth = Math.max(4, w * 0.12);
      ctx.beginPath(); ctx.arc(cx, cy, w * 0.52, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
      ctx.strokeStyle = '#4a5068'; ctx.lineWidth = Math.max(2.5, w * 0.07);
      ctx.beginPath(); ctx.arc(cx, cy, w * 0.52, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
      const cup = (x) => {
        ctx.fillStyle = '#17142b'; ctx.beginPath(); ctx.ellipse(x, cy + w * 0.02, w * 0.14, w * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e03131'; ctx.beginPath(); ctx.ellipse(x, cy + w * 0.02, w * 0.1, w * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff8a8a'; ctx.beginPath(); ctx.ellipse(x - w * 0.03, cy - w * 0.04, w * 0.03, w * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      };
      if (face === 'left' || face === 'right') cup(cx + (face === 'left' ? 1 : -1) * w * 0.06);
      else { cup(cx - w * 0.52); cup(cx + w * 0.52); }
    } else if (id === 'crown') {
      const y1 = top - w * 0.12, y2 = top + w * 0.3;
      const pts = [[-0.42, y2], [-0.42, y1 + w * 0.1], [-0.21, y1 + w * 0.2], [0, y1], [0.21, y1 + w * 0.2], [0.42, y1 + w * 0.1], [0.42, y2]];
      ctx.fillStyle = '#f6c945'; ctx.strokeStyle = '#17142b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx + pts[0][0] * w, pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(cx + pts[i][0] * w, pts[i][1]);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff0a8'; ctx.fillRect(cx - w * 0.38, y2 - w * 0.12, w * 0.76, 2);
      [[-0.21, '#e03131'], [0, '#339af0'], [0.21, '#e03131']].forEach(([dx, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + dx * w, y2 - w * 0.07, w * 0.05, 0, Math.PI * 2); ctx.fill(); });
    }
    ctx.restore();
  },

  // Build the sheet for a character with an outfit {hoodie: id, acc: id}. Returns a canvas.
  makeSheet(who, outfit, anchors) {
    const M = ASSET_META;
    const img = CharArt.images[who];
    const c = PX.canvas(M.cols * M.cellW, 2 * M.cellH);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    if (outfit) {
      const hoodie = HOODIES.find(h => h.id === outfit.hoodie);
      CharArt.recolor(ctx, hoodie, anchors, M);
      for (let i = 0; i < 14; i++) {
        CharArt.accessory(ctx, outfit.acc, anchors[i], CharArt.faceOf(i), (i % M.cols) * M.cellW, Math.floor(i / M.cols) * M.cellH);
      }
    }
    return c;
  }
};
