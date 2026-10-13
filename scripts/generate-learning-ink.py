"""Bake a seamless, evolving ink edge without runtime noise filters.

Requires Pillow and NumPy. The narrow-band atlas contains 32 correlated
phases in one horizontal row. There are no later frames below the active
edge to leak through a composited clip. The page samples them by scroll
position, so the edge stays still when scrolling stops.
The full-size first frame is retained as the static fallback mask.
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


WIDTH, HEIGHT = 1000, 1400
BAND_TOP, BAND_HEIGHT = 1200, 150
CENTER_Y = 1258
# Keep the complete horizontal strip within a 16384-pixel texture width.
FRAME_WIDTH, FRAME_HEIGHT, FRAME_COUNT = 512, 112, 32


def create_frames():
    rng = np.random.default_rng(427)

    def noise(cell_x, cell_y):
        grid = rng.normal(0, 1, (BAND_HEIGHT // cell_y + 3, WIDTH // cell_x + 3))
        image = Image.fromarray(grid.astype(np.float32))
        field = np.asarray(image.resize((WIDTH, BAND_HEIGHT), Image.Resampling.BICUBIC))
        return field / max(float(field.std()), 0.001)

    # Coherent two-dimensional fields give the edge rounded inlets and pores.
    # A closed circle through the fields changes their shape continuously and
    # returns exactly to the same pattern; no frame samples fresh randomness.
    fields = [
        (amplitude, [noise(cell_x, cell_y) for _ in range(5)])
        for cell_x, cell_y, amplitude in [(48, 34, 8), (24, 20, 9), (10, 10, 2.5)]
    ]
    y, x = np.mgrid[BAND_TOP:BAND_TOP + BAND_HEIGHT, :WIDTH]
    holes = [
        (cx, rng.uniform(CENTER_Y - 16, CENTER_Y + 5),
         rng.uniform(5, 12), rng.uniform(4, 10), rng.uniform(0, 2 * np.pi))
        for cx in [49, 174, 211, 393, 505, 702, 842, 941]
    ]
    droplets = [
        (cx, rng.uniform(CENTER_Y + 8, CENTER_Y + 31),
         rng.uniform(3.5, 8), rng.uniform(3, 7), rng.uniform(0, 2 * np.pi))
        for cx in [84, 197, 338, 515, 629, 796, 884]
    ]
    frames = []
    for frame in range(FRAME_COUNT):
        phase = frame / FRAME_COUNT * 2 * np.pi
        field = (CENTER_Y - y).astype(np.float32)
        for amplitude, (anchor, cosine, sine, overtone_cos, overtone_sin) in fields:
            field += amplitude * (
                anchor * 0.48
                + cosine * np.cos(phase) * 0.7
                + sine * np.sin(phase) * 0.7
                + overtone_cos * np.cos(2 * phase) * 0.14
                + overtone_sin * np.sin(2 * phase) * 0.14
            )

        detail = fields[-1][1][0] * 0.55
        for cx, cy, rx, ry, offset in holes:
            pulse = 0.83 + 0.24 * np.sin(phase + offset)
            dx = (x - cx - 4 * np.sin(phase + offset)) / (rx * pulse)
            dy = (y - cy - 4 * np.cos(phase + offset)) / (ry * pulse)
            cavity = (np.sqrt(dx * dx + dy * dy) - 1) * min(rx, ry) + detail
            field = np.minimum(field, cavity)

        for cx, cy, rx, ry, offset in droplets:
            pulse = 0.85 + 0.3 * np.sin(phase + offset)
            dx = (x - cx - 5 * np.cos(phase + offset)) / (rx * pulse)
            dy = (y - cy - 4 * np.sin(phase + offset)) / (ry * pulse)
            droplet = (1 - np.sqrt(dx * dx + dy * dy)) * min(rx, ry) + detail
            field = np.maximum(field, droplet)

        # A subpixel transition retains clean contours without furry grain.
        alpha = (np.clip(field * 0.9 + 0.5, 0, 1) * 255).astype(np.uint8)
        alpha[:4] = 255
        alpha[-4:] = 0
        frames.append(Image.fromarray(alpha))
    return frames


def rgba_mask(alpha):
    image = Image.new('RGBA', alpha.size, (0, 0, 0, 0))
    image.putalpha(alpha)
    return image


def save_preview(frames, destination):
    """Write an optional six-frame false-color sheet for visual inspection."""
    tile_width, tile_height = 800, 190
    sheet = Image.new('RGB', (tile_width * 2, tile_height * 3), '#eaece5')
    draw = ImageDraw.Draw(sheet)
    for tile, frame_index in enumerate([0, 5, 10, 16, 21, 26]):
        left, top = tile % 2 * tile_width, tile // 2 * tile_height
        alpha = frames[frame_index].resize((FRAME_WIDTH, FRAME_HEIGHT), Image.Resampling.LANCZOS)
        paper = Image.new('RGB', alpha.size, '#f5f5ed')
        pigment = Image.new('RGB', alpha.size, '#e75c31')
        pigment_draw = ImageDraw.Draw(pigment)
        pigment_draw.rectangle((0, 0, FRAME_WIDTH // 2, FRAME_HEIGHT), fill='#293835')
        sheet.paste(Image.composite(pigment, paper, alpha), (left + 16, top + 42))
        draw.text((left + 16, top + 15), f'FRAME {frame_index:02d} / {FRAME_COUNT}', fill='#293835')
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preview', type=Path, help='Optional six-frame preview PNG')
    args = parser.parse_args()
    output = Path(__file__).resolve().parents[1] / 'public' / 'images' / 'learning'
    frames = create_frames()

    fallback = Image.new('L', (WIDTH, HEIGHT), 0)
    fallback.paste(255, (0, 0, WIDTH, BAND_TOP))
    fallback.paste(frames[0], (0, BAND_TOP))
    rgba_mask(fallback).save(output / 'hero-ink-edge.png', optimize=True)

    atlas = Image.new('L', (FRAME_WIDTH * FRAME_COUNT, FRAME_HEIGHT), 0)
    for index, frame in enumerate(frames):
        atlas.paste(frame.resize((FRAME_WIDTH, FRAME_HEIGHT), Image.Resampling.LANCZOS), (index * FRAME_WIDTH, 0))
    rgba_mask(atlas).save(output / 'hero-ink-edge-atlas.png', optimize=True)
    if args.preview:
        save_preview(frames, args.preview)
    print(f'Created ink masks: {FRAME_COUNT} erosion phases in one horizontal row')


if __name__ == '__main__':
    main()
