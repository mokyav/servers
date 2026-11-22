#!/usr/bin/env python3
"""Create 16x16 block-atlas tiles cropped from Java's chest entity UV maps."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = root / 'src/client/public/assets/minecraft/textures'
sources = {
    'normal': 'entity/chest/normal.png',
    'trapped': 'entity/chest/trapped.png',
    'ender': 'entity/chest/ender.png',
    'copper': 'entity/chest/copper.png',
    'exposed_copper': 'entity/chest/copper_exposed.png',
    'weathered_copper': 'entity/chest/copper_weathered.png',
    'oxidized_copper': 'entity/chest/copper_oxidized.png',
}
# The normal/chest entity model UV layout, cropped to the major lid/base faces.
regions = {
    'lid_top': (14, 0, 28, 14),
    'lid_front': (14, 28, 28, 33),
    'lid_side': (0, 28, 14, 33),
    'lid_back': (42, 28, 56, 33),
    'base_front': (14, 33, 28, 43),
    'base_side': (0, 33, 14, 43),
    'base_back': (42, 33, 56, 43),
    'base_top': (14, 14, 28, 28),
    'base_bottom': (28, 14, 42, 28),
    'latch': (0, 0, 4, 14),
}
out = assets / 'koruva' / 'chest'
out.mkdir(parents=True, exist_ok=True)
for kind, source in sources.items():
    src = Image.open(assets / source).convert('RGBA')
    for face, box in regions.items():
        crop = src.crop(box)
        crop = crop.resize((16, 16), Image.Resampling.NEAREST)
        crop.save(out / f'{kind}_{face}.png', optimize=True)

# Flat base cloth for each vanilla banner dye. Use the official entity/banner
# base shading and tint it with the corresponding Java dye color.
banner_palette = {
    'white': '#F9FFFE', 'orange': '#F9801D', 'magenta': '#C74EBD', 'light_blue': '#3AB3DA',
    'yellow': '#FED83D', 'lime': '#80C71F', 'pink': '#F38BAA', 'gray': '#474F52',
    'light_gray': '#9D9D97', 'cyan': '#169C9C', 'purple': '#8932B8', 'blue': '#3C44AA',
    'brown': '#835432', 'green': '#5E7C16', 'red': '#B02E26', 'black': '#1D1D21',
}
banner_source = Image.open(assets / 'entity/banner/base.png').convert('RGBA')
# This UV crop is the unpatterned cloth field. Resizing with nearest keeps the
# source shading crisp at the block atlas's 16x16 tile size.
banner_base = banner_source.crop((1, 1, 21, 21)).resize((16, 16), Image.Resampling.NEAREST)
banner_out = assets / 'koruva' / 'banner'
banner_out.mkdir(parents=True, exist_ok=True)
for name, color in banner_palette.items():
    rgb = tuple(int(color[index:index + 2], 16) for index in (1, 3, 5))
    tinted = Image.new('RGBA', (16, 16))
    pixels = []
    for r, g, b, alpha in banner_base.getdata():
        shade = (r + g + b) / (3 * 255)
        pixels.append((round(rgb[0] * shade), round(rgb[1] * shade), round(rgb[2] * shade), alpha))
    tinted.putdata(pixels)
    tinted.save(banner_out / f'{name}.png', optimize=True)
print(f'Generated {len(sources) * len(regions)} 16x16 chest tiles and {len(banner_palette)} 16x16 banner cloth tiles')
