"""Prepare the supplied detail-page artwork as transparent monochrome linework.

Requires Pillow. Run from the repository root:
    python scripts/prepare-project-reader.py

The supplied originals remain in downloads/project-reader/. Page opacity and
edge fading belong to CSS, so this asset preserves usable ink contrast.
"""

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "downloads" / "project-reader" / "wing-lineart.png"
OUTPUT = ROOT / "public" / "images" / "project-reader" / "wing-lineart.webp"
MAX_WIDTH = 512
PAPER_CUTOFF = 232
CROP_PADDING = 12


def prepare_linework(source: Image.Image) -> Image.Image:
    """Remove bright fills while retaining original transparency and soft edges."""
    source = source.convert("RGBA")
    luminance = source.convert("RGB").convert("L")
    # Suppress near-white paper noise without a binary threshold on ink edges.
    ink = luminance.point(
        [max(0, round((PAPER_CUTOFF - tone) * 255 / PAPER_CUTOFF))
         for tone in range(256)]
    )
    alpha = ImageChops.multiply(ink, source.getchannel("A"))
    # Ignore one-step alpha noise when locating the drawing; retain the
    # original soft edges and fine lines inside the padded crop.
    bounds = alpha.point([0, 0] + [255] * 254).getbbox()
    if bounds is None:
        raise ValueError("Source contains no visible linework")
    left, top, right, bottom = bounds
    alpha = alpha.crop((
        max(0, left - CROP_PADDING),
        max(0, top - CROP_PADDING),
        min(alpha.width, right + CROP_PADDING),
        min(alpha.height, bottom + CROP_PADDING),
    ))
    width = min(MAX_WIDTH, alpha.width)
    height = round(alpha.height * width / alpha.width)
    if (width, height) != alpha.size:
        alpha = alpha.resize((width, height), Image.Resampling.LANCZOS)
    # A fresh image contains no source metadata and only neutral black ink.
    result = Image.new("RGBA", alpha.size, (0, 0, 0, 0))
    result.putalpha(alpha)
    return result


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing source: {SOURCE.relative_to(ROOT).as_posix()}")
    with Image.open(SOURCE) as original:
        image = prepare_linework(original)
    encoded = BytesIO()
    image.save(encoded, "WEBP", lossless=True, method=6, exact=True)
    data = encoded.getvalue()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if not OUTPUT.is_file() or OUTPUT.read_bytes() != data:
        OUTPUT.write_bytes(data)
    print(
        f"{OUTPUT.relative_to(ROOT).as_posix()}: "
        f"{image.width} x {image.height}, {len(data)} bytes"
    )


if __name__ == "__main__":
    main()
