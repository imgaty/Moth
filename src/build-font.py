
# Created on 11 September 2026 by imgaty
# Last updated on 18 September 2026 by imgaty
"""
Builds assets/icons.woff2: every icon set's sun and moon, redrawn to one size.

Each set's web font is downloaded from jsDelivr at a pinned version, and every icon is
scaled so its outline fills the same square, centred, since each library draws them at
a different size.

Needs fontTools with WOFF2 support: pip install "fonttools[woff]"
Run: python3 src/build-font.py
"""

from __future__ import annotations

import io
import os
import urllib.request
from functools import cache
from typing import NamedTuple

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_FILE = os.path.join(ROOT, 'assets', 'icons.woff2')
CDN = 'https://cdn.jsdelivr.net/npm/'
UPM = 1000                                                          # Units per em: the side of the square every icon is drawn inside.
FILL_RATIO = 0.875                                                  # How much of that square the outline fills: the size of VS Code's own icons.
FIRST_CODEPOINT = 0xE000                                            # Each set's sun and moon get codepoints from here, two per set, in SETS order.
MATERIAL = {'wght': 400, 'GRAD': 0, 'opsz': 24}                     # Material Symbols is a variable font, so it has to be pinned to one instance first.

class IconSet(NamedTuple):
    """Where to find one `moth.icons` style's sun and moon."""
    value: str                                                      # the `moth.icons` setting value
    font: str                                                       # path on jsDelivr, with the version pinned
    sun: int                                                        # the sun's codepoint in that font
    moon: int                                                       # the moon's codepoint in that font
    axes: dict[str, float] | None = None                            # variable-font axes to pin, if any

SETS = [
    IconSet('lucide',
            'lucide-static@1.44.0/font/lucide.woff2', 0xE178, 0xE11E),
    IconSet('tabler',
            '@tabler/icons-webfont@3.46.0/dist/fonts/tabler-icons.woff2', 0xEB30, 0xEAF8),
    IconSet('phosphor',
            '@phosphor-icons/web@2.1.2/src/regular/Phosphor.woff2', 0xE472, 0xE330),
    IconSet('phosphor-fill',
            '@phosphor-icons/web@2.1.2/src/fill/Phosphor-Fill.woff2', 0xE472, 0xE330),
    IconSet('bootstrap',
            'bootstrap-icons@1.13.1/font/fonts/bootstrap-icons.woff2', 0xF5A2, 0xF497),
    IconSet('material',
            'material-symbols@0.47.2/material-symbols-outlined.woff2', 0xE518, 0xE51C,
            {**MATERIAL, 'FILL': 0}),
    IconSet('material-filled',
            'material-symbols@0.47.2/material-symbols-outlined.woff2', 0xE518, 0xE51C,
            {**MATERIAL, 'FILL': 1}),
    IconSet('fontawesome',
            '@fortawesome/fontawesome-free@7.3.1/webfonts/fa-regular-400.woff2', 0xF185, 0xF186),
]


@cache
def download(path):
    """The bytes of one web font, fetched once even when two sets share a file."""
    return urllib.request.urlopen(CDN + path, timeout=120).read()


def load(icon_set):
    """The set's font, pinned to a single instance if it is a variable font."""
    font = TTFont(io.BytesIO(download(icon_set.font)))
    if icon_set.axes:
        pinned = {axis.axisTag: icon_set.axes.get(axis.axisTag, axis.defaultValue)
                  for axis in font['fvar'].axes}
        font = instancer.instantiateVariableFont(font, pinned)
    return font


def redraw(font, codepoint):
    """The icon at codepoint, scaled so its longer side is FILL_RATIO of the square, centred."""
    glyphs = font.getGlyphSet()
    recording = DecomposingRecordingPen(glyphs)
    glyphs[font.getBestCmap()[codepoint]].draw(recording)

    # Measure what the library actually drew: every one of them picks a different size.
    bounds = BoundsPen(None)
    recording.replay(bounds)
    x_min, y_min, x_max, y_max = bounds.bounds

    # Scale the longer side to FILL_RATIO of the square, then centre what that leaves.
    scale = FILL_RATIO * UPM / max(x_max - x_min, y_max - y_min)
    dx = UPM / 2 - scale * (x_min + x_max) / 2
    dy = UPM / 2 - scale * (y_min + y_max) / 2

    # Replay through the transform, converting cubic curves to the quadratic ones glyf needs.
    pen = TTGlyphPen(None)
    recording.replay(TransformPen(Cu2QuPen(pen, max_err=1), (scale, 0, 0, scale, dx, dy)))
    return pen.glyph()


def collect():
    """Every set's sun and moon, as the glyph order, cmap and outlines a font is built from."""
    order = ['.notdef']
    glyphs = {'.notdef': TTGlyphPen(None).glyph()}
    cmap = {}

    for index, icon_set in enumerate(SETS):
        font = load(icon_set)
        for offset, (kind, codepoint) in enumerate([('sun', icon_set.sun),
                                                    ('moon', icon_set.moon)]):
            name = f'{icon_set.value}-{kind}'
            order.append(name)
            cmap[FIRST_CODEPOINT + index * 2 + offset] = name
            glyphs[name] = redraw(font, codepoint)

    return order, cmap, glyphs


def build(order, cmap, glyphs):
    """The finished WOFF2, written to OUT_FILE."""
    builder = FontBuilder(UPM, isTTF=True)
    builder.setupGlyphOrder(order)
    builder.setupCharacterMap(cmap)
    builder.setupGlyf(glyphs)

    # Every icon is one square wide, starting where its outline does; .notdef is empty and has no xMin.
    glyf = builder.font['glyf']
    widths = {name: (UPM, getattr(glyf[name], 'xMin', 0)) for name in order}
    builder.setupHorizontalMetrics(widths)

    # Like VS Code's own icon font: the icon's square runs from the baseline up.
    builder.setupHorizontalHeader(ascent=UPM, descent=0)
    builder.setupNameTable({'familyName': 'Moth Icons', 'styleName': 'Regular'})
    builder.setupOS2(sTypoAscender=UPM, sTypoDescender=0, sTypoLineGap=0,
                     usWinAscent=UPM, usWinDescent=0)
    builder.setupPost()

    builder.font.flavor = 'woff2'
    builder.save(OUT_FILE)


def main():
    order, cmap, glyphs = collect()
    build(order, cmap, glyphs)
    print(f'{os.path.relpath(OUT_FILE, ROOT)}: {len(order) - 1} icons, {os.path.getsize(OUT_FILE)} bytes')


if __name__ == '__main__':
    main()
