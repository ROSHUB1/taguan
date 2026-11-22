#!/usr/bin/env python3
"""
Builds the game's art assets from the concept sheet in reference/.

  python3 tools/build_assets.py

Outputs
  www/js/assets.js     sprite sheets, icons and banner as data URIs (works from file:// and in the APK)
  android-res/         launcher icon set copied into the Android project by the GitHub workflow
  tools/out/           contact sheets for eyeballing the cut (not shipped)

What it does
  1. Removes the navy panel background around the Hider and Seeker sprites (flood fill from the edge).
  2. Cuts 4 standing poses and 5 run frames per character, scales them to one consistent size
     and packs them into a 14 frame sheet (see FRAME INDEX below).
  3. Measures where the head is on every frame so hats can be drawn on top at runtime.
  4. Cuts the circular icon set and the TAGUAN title banner.
  5. Makes the Android launcher icons.

FRAME INDEX (same for hider and seeker)
  0 down idle   1 up idle   2 left idle   3 right idle
  4-8 run right (5 frames)  9-13 run left (5 frames, mirrored)
"""
import base64
import io
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'reference')
OUT_JS = os.path.join(ROOT, 'www', 'js', 'assets.js')
OUT_DBG = os.path.join(ROOT, 'tools', 'out')
OUT_ANDROID = os.path.join(ROOT, 'android-res')
os.makedirs(OUT_DBG, exist_ok=True)

CELL_W, CELL_H = 64, 100        # one frame cell in the sheet
FEET_Y = 98                      # sprite feet sit on this row inside the cell
STAND_H = 96                     # standing pose height after scaling
SHEET_COLS = 7
RUN_UPSCALE = 1.25               # run frames are drawn smaller in the concept; match head size

SHEET = Image.open(os.path.join(REF, 'sheet-night.png')).convert('RGB')
A = np.array(SHEET).astype(int)

# Regions of the night concept sheet that hold the character poses (x0, y0, x1, y1)
REGIONS = {
    'hider': (15, 330, 305, 545),
    'seeker': (310, 330, 598, 545),
}
BG = np.array([16, 21, 65])


def key_region(box):
    """Return (rgb, alpha-mask) for a region with the navy panel removed."""
    x0, y0, x1, y1 = box
    reg = A[y0:y1, x0:x1]
    d = np.abs(reg - BG)
    isbg = (d[..., 0] < 12) & (d[..., 1] < 12) & (d[..., 2] < 20)
    lab, _ = ndi.label(isbg)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(border))
    fg = ~bgmask
    fg = ndi.binary_opening(fg, iterations=1)
    # fill pinholes inside sprites
    fg = ndi.binary_closing(fg, iterations=1)
    return reg.astype(np.uint8), fg


def components(fg, min_area=700):
    lab, n = ndi.label(ndi.binary_dilation(fg, iterations=2))
    boxes = []
    for sl in ndi.find_objects(lab):
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        if h * w >= min_area:
            boxes.append([sl[1].start, sl[0].start, sl[1].stop, sl[0].stop])
    return boxes


def cut(reg, fg, box):
    x0, y0, x1, y1 = box
    sub_fg = fg[y0:y1, x0:x1]
    ys, xs = np.where(sub_fg)
    if len(ys) == 0:
        raise RuntimeError('empty cut %s' % (box,))
    bx0, bx1 = xs.min(), xs.max() + 1
    by0, by1 = ys.min(), ys.max() + 1
    rgb = reg[y0:y1, x0:x1][by0:by1, bx0:bx1]
    alpha = (sub_fg[by0:by1, bx0:bx1] * 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, alpha]), 'RGBA')


def split_merged(fg, box):
    """Two run frames that touch are one component. Cut at the emptiest column near the middle."""
    x0, y0, x1, y1 = box
    sub = fg[y0:y1, x0:x1]
    cols = sub.sum(axis=0)
    mid = (x1 - x0) // 2
    lo, hi = max(4, mid - 14), min(len(cols) - 4, mid + 14)
    cut_x = lo + int(np.argmin(cols[lo:hi]))
    return [[x0, y0, x0 + cut_x, y1], [x0 + cut_x, y0, x1, y1]]


def row_of(box, tops):
    """Which row (0 = standing, 1 = run) a box belongs to."""
    return 0 if box[1] < tops else 1


def find_poses(name):
    reg, fg = key_region(REGIONS[name])
    boxes = components(fg)
    # drop the thin panel divider and anything that is not a character
    boxes = [b for b in boxes if (b[2] - b[0]) > 30 and (b[3] - b[1]) > 50]
    split_y = (reg.shape[0]) * 0.52
    standing = sorted([b for b in boxes if b[1] < split_y], key=lambda b: b[0])
    run = sorted([b for b in boxes if b[1] >= split_y], key=lambda b: b[0])
    # split merged (too wide) run frames
    fixed = []
    for b in run:
        if (b[2] - b[0]) > 75:
            fixed.extend(split_merged(fg, b))
        else:
            fixed.append(b)
    run = sorted(fixed, key=lambda b: b[0])
    return reg, fg, standing, run


def scale_to(img, factor):
    w, h = img.size
    return img.resize((max(1, round(w * factor)), max(1, round(h * factor))), Image.LANCZOS)


def place(img):
    """Put a sprite in a cell: horizontally centred, feet on FEET_Y."""
    cell = Image.new('RGBA', (CELL_W, CELL_H), (0, 0, 0, 0))
    x = (CELL_W - img.width) // 2
    y = FEET_Y - img.height
    if y < 0:
        raise RuntimeError('sprite too tall for cell: %s' % (img.size,))
    cell.alpha_composite(img, (x, y))
    return cell


def anchors_for(cell):
    """Head anchor for hats: centre x, top y and head width, measured from the alpha channel."""
    a = np.array(cell)[..., 3] > 40
    ys, xs = np.where(a)
    top = int(ys.min())
    h = int(ys.max()) - top + 1
    band = a[top: top + max(6, int(h * 0.30))]
    bys, bxs = np.where(band)
    x0, x1 = int(bxs.min()), int(bxs.max()) + 1
    return {'cx': (x0 + x1) / 2.0, 'top': top, 'w': x1 - x0, 'h': h}


def build_character(name):
    reg, fg, standing, run = find_poses(name)
    print(name, 'standing', len(standing), 'run', len(run))
    if len(standing) < 4 or len(run) < 5:
        raise RuntimeError('%s: expected 4 standing + 5 run poses, got %d + %d' % (name, len(standing), len(run)))
    standing = standing[:4]
    run = run[:5]

    stand_imgs = [cut(reg, fg, b) for b in standing]
    run_imgs = [cut(reg, fg, b) for b in run]
    r = STAND_H / max(i.height for i in stand_imgs)
    stand_s = [scale_to(i, r) for i in stand_imgs]
    run_s = [scale_to(i, r * RUN_UPSCALE) for i in run_imgs]

    down, side_a, up, _side_b = stand_s
    left = side_a                                     # concept side pose faces left
    right = side_a.transpose(Image.FLIP_LEFT_RIGHT)
    frames = [down, up, left, right] + run_s + [i.transpose(Image.FLIP_LEFT_RIGHT) for i in run_s]

    # Run frames in the concept face right; if they actually face left swap the two groups.
    cells = [place(f) for f in frames]
    sheet = Image.new('RGBA', (CELL_W * SHEET_COLS, CELL_H * 2), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        sheet.alpha_composite(c, ((i % SHEET_COLS) * CELL_W, (i // SHEET_COLS) * CELL_H))
    anchors = [anchors_for(c) for c in cells]
    return sheet, anchors, cells


def png_b64(img, quantize=None):
    buf = io.BytesIO()
    if quantize:
        img = img.quantize(colors=quantize, method=Image.FASTOCTREE, dither=Image.NONE)
    img.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def contact(cells, path):
    w = len(cells) * CELL_W
    bg = Image.new('RGBA', (w, CELL_H), (255, 0, 255, 255))
    for i, c in enumerate(cells):
        bg.alpha_composite(c, (i * CELL_W, 0))
    bg.resize((w * 2, CELL_H * 2), Image.NEAREST).save(path)


# ---------------------------------------------------------------- icons
ICON_NAMES = ['play', 'gear', 'shirt', 'trophy', 'star', 'back', 'boot', 'shield', 'crown', 'heart']
ICON_CENTERS = [(806, 905), (870, 905), (933, 905), (996, 905), (1060, 905), (1114, 905),
                (806, 963), (870, 963), (933, 963), (996, 963)]
ICON_SIZE = 64


def build_icons():
    sheet = Image.open(os.path.join(REF, 'sheet-night.png')).convert('RGB')
    out = Image.new('RGBA', (ICON_SIZE * len(ICON_NAMES), ICON_SIZE), (0, 0, 0, 0))
    for i, (cx, cy) in enumerate(ICON_CENTERS):
        r = 26
        crop = sheet.crop((cx - 28, cy - 28, cx + 28, cy + 28)).resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
        mask = Image.new('L', (ICON_SIZE * 4, ICON_SIZE * 4), 0)
        ImageDraw.Draw(mask).ellipse((2 * 4, 2 * 4, (ICON_SIZE - 2) * 4, (ICON_SIZE - 2) * 4), fill=255)
        mask = mask.resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
        rgba = crop.convert('RGBA')
        rgba.putalpha(mask)
        out.alpha_composite(rgba, (i * ICON_SIZE, 0))
    return out


# ---------------------------------------------------------------- banner
def build_banner():
    sheet = Image.open(os.path.join(REF, 'sheet-night.png')).convert('RGB')
    return sheet.crop((0, 0, 910, 266))


# ---------------------------------------------------------------- android icons
def build_launcher(front_cell):
    """Launcher icon: hider head and shoulders on a navy tile."""
    ys, xs = np.where(np.array(front_cell)[..., 3] > 40)
    top = ys.min()
    head = front_cell.crop((0, top, CELL_W, top + 62))
    def tile(size, round_mask):
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        bg = Image.new('RGBA', (size, size))
        d = ImageDraw.Draw(bg)
        for y in range(size):
            t = y / size
            d.line([(0, y), (size, y)], fill=(int(24 + 20 * t), int(34 + 30 * t), int(92 + 60 * t), 255))
        scale = size * 0.80 / head.width
        h2 = head.resize((round(head.width * scale), round(head.height * scale)), Image.LANCZOS)
        bg.alpha_composite(h2, ((size - h2.width) // 2, size - h2.height - int(size * 0.06)))
        m = Image.new('L', (size * 4, size * 4), 0)
        md = ImageDraw.Draw(m)
        if round_mask:
            md.ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
        else:
            md.rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=size * 4 // 5, fill=255)
        m = m.resize((size, size), Image.LANCZOS)
        img.paste(bg, (0, 0), m)
        return img

    def foreground(size):
        """Adaptive icon foreground: 108dp canvas, art inside the 66dp safe zone."""
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        target = size * 0.56
        scale = target / head.width
        h2 = head.resize((round(head.width * scale), round(head.height * scale)), Image.LANCZOS)
        img.alpha_composite(h2, ((size - h2.width) // 2, int(size * 0.30)))
        return img

    dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
    for d, k in dens.items():
        folder = os.path.join(OUT_ANDROID, 'mipmap-' + d)
        os.makedirs(folder, exist_ok=True)
        tile(round(48 * k), False).save(os.path.join(folder, 'ic_launcher.png'))
        tile(round(48 * k), True).save(os.path.join(folder, 'ic_launcher_round.png'))
        foreground(round(108 * k)).save(os.path.join(folder, 'ic_launcher_foreground.png'))
    vals = os.path.join(OUT_ANDROID, 'values')
    os.makedirs(vals, exist_ok=True)
    with open(os.path.join(vals, 'ic_launcher_background.xml'), 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                '    <color name="ic_launcher_background">#1B2A66</color>\n</resources>\n')


def main():
    hider_sheet, hider_anchors, hider_cells = build_character('hider')
    seeker_sheet, seeker_anchors, seeker_cells = build_character('seeker')
    contact(hider_cells, os.path.join(OUT_DBG, 'hider_frames.png'))
    contact(seeker_cells, os.path.join(OUT_DBG, 'seeker_frames.png'))

    icons = build_icons()
    icons.save(os.path.join(OUT_DBG, 'icons.png'))
    banner = build_banner()
    banner.save(os.path.join(OUT_DBG, 'banner.png'))
    build_launcher(hider_cells[0])

    meta = {'cellW': CELL_W, 'cellH': CELL_H, 'feetY': FEET_Y, 'cols': SHEET_COLS,
            'iconSize': ICON_SIZE, 'icons': ICON_NAMES}
    with open(OUT_JS, 'w') as f:
        f.write('// GENERATED by tools/build_assets.py from reference/sheet-night.png. Do not edit by hand.\n')
        f.write('const ASSET_META = %s;\n' % json.dumps(meta))
        f.write('const ASSETS = {\n')
        f.write('  hider: %s,\n' % json.dumps(png_b64(hider_sheet)))
        f.write('  seeker: %s,\n' % json.dumps(png_b64(seeker_sheet)))
        f.write('  icons: %s,\n' % json.dumps(png_b64(icons)))
        f.write('  banner: %s,\n' % json.dumps(png_b64(banner, quantize=160)))
        f.write('  anchors: {\n    hider: %s,\n    seeker: %s\n  }\n' % (
            json.dumps([{k: round(v, 1) for k, v in a.items()} for a in hider_anchors]),
            json.dumps([{k: round(v, 1) for k, v in a.items()} for a in seeker_anchors])))
        f.write('};\n')
    print('wrote', OUT_JS, os.path.getsize(OUT_JS) // 1024, 'KB')


if __name__ == '__main__':
    sys.exit(main())
