// Ground tiles: one 32x32 canvas per terrain type and variant, stamped into a big map-sized canvas.
const GT = { grass: 0, dirt: 1, road: 2, cobble: 3, court: 4, sand: 5, concrete: 6, hedge: 7, plaza: 8 };

const Ground = {
  cache: {},

  // 4 variants per terrain type so the map does not look tiled
  tile(type, variant) {
    const key = type + ':' + variant;
    if (Ground.cache[key]) return Ground.cache[key];
    const S = CONFIG.TILE;
    const c = PX.canvas(S, S);
    const ctx = c.getContext('2d');
    const rnd = U.rng(1000 + type * 37 + variant * 101);
    const speck = (n, colors, w, h) => {
      for (let i = 0; i < n; i++) PX.r(ctx, Math.floor(rnd() * (S - w)), Math.floor(rnd() * (S - h)), w, h, colors[Math.floor(rnd() * colors.length)]);
    };
    switch (type) {
      case GT.grass:
        PX.r(ctx, 0, 0, S, S, '#5fae4e');
        speck(26, ['#52a043', '#6cbd58', '#4a963d'], 2, 2);
        speck(5, ['#86d06e'], 1, 3);
        if (variant === 1) speck(1, ['#ffffff'], 2, 2);
        if (variant === 2) speck(1, ['#ffd84a'], 2, 2);
        break;
      case GT.dirt:
        PX.r(ctx, 0, 0, S, S, '#c9a77a');
        speck(22, ['#b8956a', '#d6b88c', '#bf9d70'], 3, 2);
        speck(3, ['#8e8a86'], 2, 2);
        break;
      case GT.road:
        PX.r(ctx, 0, 0, S, S, '#4b505d');
        speck(30, ['#434856', '#555b69', '#3e4350'], 2, 2);
        speck(2, ['#6a7080'], 3, 1);
        break;
      case GT.cobble: {
        PX.r(ctx, 0, 0, S, S, '#7d7d8b');
        for (let row = 0; row < 4; row++) {
          const off = (row + variant) % 2 ? 4 : 0;
          for (let col = -1; col < 4; col++) {
            const shade = ['#a3a3b1', '#9898a6', '#adadba', '#9f9fad'][Math.floor(rnd() * 4)];
            PX.r(ctx, col * 8 + off + 1, row * 8 + 1, 6, 6, shade);
            PX.r(ctx, col * 8 + off + 1, row * 8 + 1, 6, 1, '#bcbcc8');
          }
        }
        break;
      }
      case GT.plaza:
        PX.r(ctx, 0, 0, S, S, '#b9a98b');
        for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) {
          PX.r(ctx, x, y, 15, 15, ((x + y) / 16 + variant) % 2 ? '#c4b496' : '#b3a384');
        }
        PX.r(ctx, 0, 15, S, 1, '#9a8b70');
        PX.r(ctx, 15, 0, 1, S, '#9a8b70');
        break;
      case GT.court:
        PX.r(ctx, 0, 0, S, S, '#6f90b8');
        speck(14, ['#6588b0', '#7a9bc2'], 2, 2);
        break;
      case GT.sand:
        PX.r(ctx, 0, 0, S, S, '#e4d09c');
        speck(20, ['#d6c186', '#efdeb0'], 2, 1);
        break;
      case GT.concrete:
        PX.r(ctx, 0, 0, S, S, '#b7b7c1');
        speck(12, ['#acacb7', '#c3c3cc'], 2, 2);
        if (variant === 3) { PX.r(ctx, 4, 10, 14, 1, '#9b9ba8'); PX.r(ctx, 18, 11, 6, 1, '#9b9ba8'); }
        break;
      case GT.hedge:
        PX.r(ctx, 0, 0, S, S, '#2d5a2e');
        speck(24, ['#244a26', '#3a7038', '#2f6232'], 3, 3);
        speck(6, ['#4f8f45'], 2, 2);
        break;
      default:
        PX.r(ctx, 0, 0, S, S, '#ff00ff');
    }
    Ground.cache[key] = c;
    return c;
  },

  // Paint a whole map: terrain tiles, then decals (road paint, court lines).
  build(model) {
    const T = CONFIG.TILE;
    const c = PX.canvas(model.cols * T, model.rows * T);
    const ctx = c.getContext('2d');
    const rnd = U.rng(model.seed || 5);
    for (let ty = 0; ty < model.rows; ty++) {
      for (let tx = 0; tx < model.cols; tx++) {
        const type = model.ground[ty * model.cols + tx];
        const v = Math.floor(rnd() * 4);
        ctx.drawImage(Ground.tile(type, v), tx * T, ty * T);
      }
    }
    // soft edge where road / dirt / court meets grass
    for (let ty = 0; ty < model.rows; ty++) {
      for (let tx = 0; tx < model.cols; tx++) {
        const type = model.ground[ty * model.cols + tx];
        if (type === GT.grass || type === GT.hedge) continue;
        const nb = [[0, -1, 0, 0, T, 2], [0, 1, 0, T - 2, T, 2], [-1, 0, 0, 0, 2, T], [1, 0, T - 2, 0, 2, T]];
        for (const [dx, dy, ox, oy, w, h] of nb) {
          const nx = tx + dx, ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= model.cols || ny >= model.rows) continue;
          if (model.ground[ny * model.cols + nx] === GT.grass) {
            ctx.fillStyle = 'rgba(0,0,0,0.16)';
            ctx.fillRect(tx * T + ox, ty * T + oy, w, h);
          }
        }
      }
    }
    for (const d of model.decals) Ground.decal(ctx, d);
    return c;
  },

  decal(ctx, d) {
    ctx.save();
    ctx.globalAlpha = d.alpha === undefined ? 1 : d.alpha;
    ctx.strokeStyle = d.color;
    ctx.fillStyle = d.color;
    ctx.lineWidth = d.lw || 2;           // lw = line width; w and h are the size of rect / frame decals
    switch (d.kind) {
      case 'rect': ctx.fillRect(d.x, d.y, d.w, d.h); break;
      case 'frame': ctx.strokeRect(d.x, d.y, d.w, d.h); break;
      case 'line':
        if (d.dash) ctx.setLineDash(d.dash);
        ctx.beginPath(); ctx.moveTo(d.x0, d.y0); ctx.lineTo(d.x1, d.y1); ctx.stroke();
        break;
      case 'circle': ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.stroke(); break;
      case 'disc': ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); break;
      case 'arc': ctx.beginPath(); ctx.arc(d.x, d.y, d.r, d.a0, d.a1); ctx.stroke(); break;
      default: break;
    }
    ctx.restore();
  },

  // Colour of each terrain on the minimap
  mini: ['#5fae4e', '#c9a77a', '#4b505d', '#9a9aa8', '#6f90b8', '#e4d09c', '#b7b7c1', '#2d5a2e', '#b9a98b']
};
