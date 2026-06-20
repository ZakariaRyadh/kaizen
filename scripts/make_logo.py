"""
Kaizen logo generator (改善 — continuous daily improvement).
Mark: ascending rounded bars + an upward arrow = growth, getting better every day.
Renders every asset Expo needs from one vector-ish definition.
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')

# brand palette — darker indigo/purple gradient
TOP = (100, 79, 178)      # #644fb2
BOT = (53, 34, 127)       # #35227f
WHITE = (255, 255, 255)

SS = 4  # supersample factor — keeps the rounded bars/arrow crisp, not jagged


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, top, bot):
    img = Image.new('RGB', (size, size), top)
    px = img.load()
    for y in range(size):
        c = lerp(top, bot, y / (size - 1))
        for x in range(size):
            px[x, y] = c
    return img


def draw_mark(img, size, color, scale=0.6):
    """Ascending bars + arrow, vertically + horizontally centred.
    scale = fraction of the canvas the whole mark occupies."""
    d = ImageDraw.Draw(img)
    cx, cy = size / 2, size / 2
    unit = size * scale                # nominal mark size
    bar_w = unit * 0.2
    gap = unit * 0.12
    heights = [unit * 0.34, unit * 0.6, unit * 0.9]
    arrow_h = unit * 0.26
    arrow_gap = unit * 0.07
    aw = bar_w * 1.55                   # arrow half-width

    total_h = heights[2] + arrow_gap + arrow_h
    total_w = bar_w * 3 + gap * 2
    base = cy + total_h / 2            # baseline of bars (composition centred)
    left = cx - total_w / 2
    xs = [left + bar_w / 2, left + bar_w * 1.5 + gap, left + bar_w * 2.5 + gap * 2]
    r = bar_w * 0.5

    for x, h in zip(xs, heights):
        d.rounded_rectangle([x - bar_w / 2, base - h, x + bar_w / 2, base], radius=r, fill=color)
    # upward arrow rising off the tallest (right) bar
    ax = xs[2]
    tip_y = base - heights[2] - arrow_gap - arrow_h
    d.polygon([(ax, tip_y), (ax - aw, tip_y + arrow_h), (ax + aw, tip_y + arrow_h)], fill=color)
    return img


def render(size, scale, transparent=False):
    """Render supersampled then downscale for clean anti-aliased edges."""
    big = size * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0)) if transparent else gradient(big, TOP, BOT)
    draw_mark(img, big, WHITE, scale=scale)
    return img.resize((size, size), Image.LANCZOS)


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
    return m


# ---- icon.png : full-bleed gradient + white mark (stores round it) ----
# NOTE: scale kept well under 1.0 — at scale=1.0 the arrow tip clipped off
# the top edge of the canvas. 0.6 keeps the whole mark inside the bleed.
S = 1024
icon = render(S, scale=0.6)
icon.save(os.path.join(OUT, 'icon.png'))

# ---- android adaptive background : flat gradient ----
bg = gradient(S, TOP, BOT)
bg.save(os.path.join(OUT, 'android-icon-background.png'))

# ---- android adaptive foreground : mark only, kept inside the ~66% safe zone ----
fg = render(S, scale=0.46, transparent=True)
fg.save(os.path.join(OUT, 'android-icon-foreground.png'))

# ---- monochrome (themed icons) : white mark on transparent ----
mono = render(S, scale=0.46, transparent=True)
mono.save(os.path.join(OUT, 'android-icon-monochrome.png'))

# ---- splash icon : white mark on transparent ----
splash = render(S, scale=0.56, transparent=True)
splash.save(os.path.join(OUT, 'splash-icon.png'))

# ---- favicon : small gradient + mark ----
F = 96
fav = render(F, scale=0.6)
fav.putalpha(rounded_mask(F, int(F * 0.22)))
fav.save(os.path.join(OUT, 'favicon.png'))

print('logo assets written to', os.path.abspath(OUT))
