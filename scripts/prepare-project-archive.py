"""Prepare the supplied Projects linework for pale, high-density backgrounds.

Requires Pillow. Run from the repository root:
    python scripts/prepare-project-archive.py

The existing grayscale source remains unchanged. Lanczos interpolation improves
display sampling; it does not reconstruct missing detail or redraw the artwork.
"""

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "images" / "project-archive"
SOURCE = OUTPUT / "linework-background.webp"
WIDTHS = (1920, 3840)
PAPER = 242
SOURCE_PAPER = 244
INK_DENSITY = 0.64


def prepare_background(source: Image.Image, width: int) -> Image.Image:
    """Retain the composition while softening ink against uniform gray paper."""
    scale = width / source.width
    height = round(source.height * scale)
    resized = source.resize((width, height), Image.Resampling.LANCZOS)
    sharpened = resized.filter(
        ImageFilter.UnsharpMask(radius=0.7 * scale, percent=28, threshold=3)
    )
    # Clamp the paper highlights and reduce line contrast before encoding.
    tones = [
        max(0, min(PAPER, round(PAPER - max(0, SOURCE_PAPER - tone) * INK_DENSITY)))
        for tone in range(256)
    ]
    mapped = sharpened.point(tones)
    # A fresh image prevents source EXIF, ICC, comments, or paths being copied.
    result = Image.new("RGB", mapped.size)
    result.paste(mapped)
    return result


def main() -> None:
    with Image.open(SOURCE) as original:
        source = original.convert("L")
    for width in WIDTHS:
        image = prepare_background(source, width)
        destination = OUTPUT / f"linework-background-{width}.webp"
        image.save(destination, "WEBP", quality=95, method=6)
        print(
            f"{destination.relative_to(ROOT).as_posix()}: "
            f"{image.width} x {image.height}, {destination.stat().st_size} bytes"
        )


if __name__ == "__main__":
    main()
