"""Separate the supplied modern elevation into aligned reveal layers.

Usage: python scripts/prepare-learning-campus.py [reference-image]
The default source is scripts/assets/learning-campus-reference.png.
Requires Pillow. Both raster layers and the hand-traced outline share the
full drawing's coordinates; the second reference is a structural guide only.
"""

from pathlib import Path
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'images' / 'learning'
SOURCE = ROOT / 'scripts' / 'assets' / 'learning-campus-reference.png'
REFERENCE_SIZE = (1555, 714)
SIZE = (1440, 800)
RASTER_SIZE = (2160, 1200)
SCALE = SIZE[0] / REFERENCE_SIZE[0]
OFFSET_Y = (SIZE[1] - REFERENCE_SIZE[1] * SCALE) / 2

# The perimeter follows the building, front walls, and stairs, excluding trees
# and paper. The pencil baseline is retained as part of the supplied elevation.
SILHOUETTE = [
    (170, 629), (170, 521), (325, 521), (325, 91), (339, 89),
    (342, 99), (483, 99), (484, 95), (502, 96), (502, 99),
    (550, 100), (550, 131), (641, 131), (641, 71), (656, 70),
    (661, 86), (661, 132), (872, 132), (872, 84), (877, 71),
    (888, 71), (888, 132), (979, 132), (979, 99), (1016, 99),
    (1028, 88), (1047, 88), (1047, 100), (1191, 99),
    (1206, 100), (1206, 521), (1358, 521), (1358, 629),
]


def canvas(image):
    """Apply the same aspect-preserving transform to every raster layer."""
    raster_scale = RASTER_SIZE[0] / REFERENCE_SIZE[0]
    height = round(REFERENCE_SIZE[1] * raster_scale)
    resized = image.resize((RASTER_SIZE[0], height), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', RASTER_SIZE, (0, 0, 0, 0))
    result.paste(resized, (0, round((RASTER_SIZE[1] - height) / 2)))
    return result


def remove_markers(image):
    """Replace two orange cursor squares with nearby matching wall texture."""
    repaired = image.copy()
    for box, offset in [((414, 442, 435, 463), (-25, 0)), ((1055, 452, 1077, 473), (30, 0))]:
        left, top, right, bottom = box
        sample = image.crop((left + offset[0], top + offset[1], right + offset[0], bottom + offset[1]))
        blend = Image.new('L', (right - left, bottom - top), 255)
        # Keep the whole cursor opaque, feathering only the sampled patch edge.
        draw = ImageDraw.Draw(blend)
        draw.rectangle((0, 0, blend.width - 1, blend.height - 1), outline=0)
        blend = blend.filter(ImageFilter.GaussianBlur(0.45))
        repaired.paste(sample, (left, top), blend)
    return repaired


def outline():
    paths = []

    def path(data, width=0.95):
        paths.append(f'<path d="{data}" stroke-width="{width}"/>')

    def line(x1, y1, x2, y2, width=0.75):
        path(f'M{x1} {y1}L{x2} {y2}', width)

    def rect(x, y, width, height, weight=0.85):
        path(f'M{x} {y}h{width}v{height}h{-width}Z', weight)

    # Exterior columns, concrete wall panels, and raised parapets.
    path('M325 521V91H340V521M331 92V521', 1.05)
    path('M484 629V96H502V629M489 98V629', 1.05)
    path('M1028 629V88H1047V629M1034 90V629', 1.05)
    path('M1191 521V100H1206V521M1199 102V521', 1.05)
    path('M341 100H484M341 105H483M503 100H550V132')
    path('M980 132V99H1016L1028 88M1016 100V132')
    path('M1047 99H1191M1048 104H1190')
    rect(340, 105, 144, 168)
    rect(340, 273, 144, 45)
    rect(1047, 105, 144, 168)
    rect(1047, 273, 144, 45)
    # Thin construction joints stay secondary to the structural silhouette.
    for x in [371, 458]:
        line(x, 106, x, 273, 0.5)
    for x in [1107, 1175]:
        line(x, 106, x, 273, 0.5)
    line(341, 164, 483, 164, 0.5)
    line(1048, 164, 1190, 164, 0.5)
    # Roof canopy and floor beam, segmented around the projected central frame.
    for left, right in [(503, 641), (661, 872), (888, 1027)]:
        path(f'M{left} 132H{right}M{left} 151H{right}M{left} 158H{right}')
        path(f'M{left} 317H{right}M{left} 337H{right}M{left} 346H{right}')
    for left, right in [(340, 484), (1047, 1191)]:
        path(f'M{left} 319H{right}M{left} 337H{right}M{left} 342H{right}')
    # A U-shaped concrete projection encases the two-storey centre glazing.
    path('M641 71H656V508H873V71H888V523H641Z', 1.1)
    path('M656 71L661 86V501H869V86L873 71M642 515H887', 0.8)
    # Upper glazing, recesses, and visible window mullions.
    rect(509, 158, 131, 156)
    path('M509 158L527 178H639M527 178V313M575 160V313M579 179V313')
    rect(664, 159, 205, 154)
    path('M664 190H868M704 160V313M708 160V313M763 160V313M767 160V313M822 160V313M826 160V313')
    path('M840 313V273H848V313M848 276H870')
    rect(890, 158, 133, 115)
    path('M890 179H1006L1023 159M954 160V272M958 180V272M1006 179V272')
    rect(890, 273, 135, 44)
    # Ground-floor openings and the deep concrete shadow recesses.
    path('M340 344H484V472M341 344L358 357H482', 0.85)
    rect(509, 346, 131, 126)
    path('M509 346L527 357H639M527 357V471M575 348V471M579 357V471')
    rect(664, 351, 205, 151)
    path('M664 354H868M705 354V500M709 354V500M763 354V500M767 354V500M822 354V500M826 354V500')
    path('M847 352V499M851 353V457H868')
    rect(890, 347, 135, 125)
    path('M892 377H981M892 437H981M954 348V471M958 348V471M982 348V471M987 348V471')
    path('M1047 343H1191V521M1048 343L1065 356H1188')
    # Front walls and terrace are drawn only along their visible borders.
    path('M170 629V521H325M170 521H189V629M189 549H413')
    path('M208 521V549H413M325 521H340V472H413')
    path('M413 629V472H483M503 629V472H641M888 472H1027V629')
    path('M1047 629V472H1116V629M1116 521H1358V629H170', 1.05)
    # Seven shallow stair treads converge into the original side wall.
    for y in [550, 560, 570, 580, 590, 600, 610, 619]:
        line(194, y, 412, y, 0.85)
    path('M194 550V627M189 629H414M99 629H1428', 1.0)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 800" width="1440" height="800" role="img">'
            '<title>Structural line study of the supplied modern elevation</title>'
            f'<g transform="translate(0 {OFFSET_Y:.6f}) scale({SCALE:.9f})" fill="none" stroke="#303536" stroke-linecap="round" stroke-linejoin="round">'
            + ''.join(paths) + '</g></svg>\n')


def main():
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else SOURCE
    drawing = Image.open(source).convert('RGB').resize(REFERENCE_SIZE, Image.Resampling.LANCZOS)
    grey = ImageOps.grayscale(remove_markers(drawing))
    # A small-radius pass improves existing edge contrast while retaining the
    # pencil grain. Oversampling smooths display scaling; it adds no source detail.
    grey = grey.filter(ImageFilter.UnsharpMask(radius=0.85, percent=45, threshold=4))
    mask = Image.new('L', REFERENCE_SIZE, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(SILHOUETTE, fill=255)
    draw.rectangle((99, 627, 1429, 631), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.3))
    building = canvas(Image.merge('RGBA', (grey, grey, grey, mask)))

    # Extract pencil pigment from the paper, including the original pale tree
    # silhouettes. Its footprint stops at the facade edge and wall-top occlusion.
    trees_mask = Image.new('L', REFERENCE_SIZE, 0)
    draw = ImageDraw.Draw(trees_mask)
    draw.rectangle((91, 173, 325, 520), fill=255)
    draw.rectangle((1207, 182, 1421, 520), fill=255)
    tree_ink = grey.point(lambda value: max(0, min(255, round((233 - value) * 255 / 207))))
    tree_alpha = ImageChops.multiply(tree_ink, trees_mask)
    trees = Image.new('RGBA', REFERENCE_SIZE, (26, 26, 26, 0))
    trees.putalpha(tree_alpha)
    trees = canvas(trees)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, image in [('hero-campus-sketch.webp', building), ('hero-campus-trees.webp', trees)]:
        destination = OUTPUT / name
        image.save(destination, 'WEBP', quality=94, method=6, exact=True)
        print(f'Prepared {name}: {image.width} x {image.height}, {destination.stat().st_size // 1024} KiB')
    (OUTPUT / 'hero-campus-outline.svg').write_text(outline(), encoding='utf-8')
    print('Prepared hero-campus-outline.svg: aligned structural strokes')


if __name__ == '__main__':
    main()
