"""Build disjoint WOFF2 slices covering the entire upstream Regular font.

Requires fonttools[woff]. Run from the project root with relative paths. Common
characters and reader copy use a base file; every remaining Unicode code point
is retained in an on-demand slice selected by the generated unicode-range CSS.
"""

import argparse
import hashlib
from io import BytesIO
import json
from pathlib import Path

try:
    from fontTools import subset
    from fontTools.ttLib import TTFont, TTLibError
except ImportError:
    raise SystemExit("Install the fonttools[woff] dependency before building.")


FAMILY = "Woodland WenKai"
NAMES = {
    1: FAMILY,
    2: "Regular",
    4: f"{FAMILY} Regular",
    6: "WoodlandWenKai-Regular",
    16: FAMILY,
    17: "Regular",
    18: f"{FAMILY} Regular",
    21: FAMILY,
    22: "Regular",
    25: "WoodlandWenKai",
}
PROTECTED_NAME_IDS = {0, 13, 14}
STATIC_COPY = (
    Path("src/components/HomeNow.tsx"),
    Path("src/components/LiveUpdates.tsx"),
    Path("src/data/home-editorial.ts"),
)
EXTRA_CHUNK_SIZE = 1024


def relative_path(value):
    path = Path(value)
    if path.is_absolute() or path.drive or ".." in path.parts:
        raise argparse.ArgumentTypeError("Use a project-relative path.")
    return path


def protected_names(font):
    return sorted(
        (record.nameID, record.platformID, record.platEncID, record.langID,
         bytes(record.string))
        for record in font["name"].names
        if record.nameID in PROTECTED_NAME_IDS
    )


def base_codepoints(available, copy_data):
    common = set()
    for point in available:
        try:
            chr(point).encode("gb2312")
            common.add(point)
        except UnicodeEncodeError:
            pass
    common.update(range(0x100))
    common.update(range(0x2000, 0x2070))
    common.update(range(0x3000, 0x3040))
    common.update(range(0xFF00, 0xFFF0))
    for content in copy_data.values():
        common.update(map(ord, content.decode("utf-8")))
    return common & available


def unicode_ranges(points):
    ordered = sorted(points)
    ranges = []
    start = previous = ordered[0]
    for point in ordered[1:]:
        if point != previous + 1:
            ranges.append(f"U+{start:X}" if start == previous
                          else f"U+{start:X}-{previous:X}")
            start = point
        previous = point
    ranges.append(f"U+{start:X}" if start == previous
                  else f"U+{start:X}-{previous:X}")
    return ",".join(ranges)


def build_slice(source_data, points, output, original_notices):
    with TTFont(BytesIO(source_data), recalcTimestamp=False) as font:
        options = subset.Options()
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.name_legacy = True
        options.layout_features = ["*"]
        options.glyph_names = True
        options.recalc_timestamp = False
        # Mirrored characters have their own disjoint range and slice.
        options.bidi_closure = False
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=points)
        subsetter.subset(font)
        names = {**NAMES, 3: f"WoodlandWenKai-Regular-{font['head'].fontRevision:.3f}"}
        for record in font["name"].names:
            if record.nameID in names:
                record.string = names[record.nameID].encode(record.getEncoding())
        for name_id in (1, 2, 3, 4, 6, 16, 17):
            font["name"].setName(names[name_id], name_id, 3, 1, 0x409)

        # Existing signatures cannot remain valid after the family is renamed.
        if "DSIG" in font:
            del font["DSIG"]
        font.flavor = "woff2"
        output.parent.mkdir(parents=True, exist_ok=True)
        font.save(output)

    with TTFont(output, recalcTimestamp=False) as rebuilt:
        actual = set(rebuilt.getBestCmap())
        if actual != points:
            raise ValueError("Character coverage changed during slice conversion.")
        if protected_names(rebuilt) != original_notices:
            raise ValueError("Copyright or license records changed.")
        for record in rebuilt["name"].names:
            if record.nameID in names and record.toUnicode() != names[record.nameID]:
                raise ValueError("A primary font name was not renamed.")
    return {
        "output": output.as_posix(),
        "unicode_codepoints": len(points),
        "bytes": output.stat().st_size,
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    }


def build(source, output, css_output):
    if source.suffix.lower() != ".ttf" or output.suffix.lower() != ".woff2":
        raise ValueError("Use a TTF source and a WOFF2 output.")
    if not source.is_file():
        raise ValueError("The relative source font does not exist.")
    if not output.is_relative_to("public"):
        raise ValueError("The relative font output must be inside public/.")

    source_data = source.read_bytes()
    with TTFont(BytesIO(source_data), recalcTimestamp=False) as original:
        available = set(original.getBestCmap())
        original_notices = protected_names(original)
    copy_data = {path: path.read_bytes() for path in STATIC_COPY}
    base = base_codepoints(available, copy_data)
    remaining = sorted(available - base)
    extras_dir = output.parent / output.stem
    slices = [(output, base)]
    for start in range(0, len(remaining), EXTRA_CHUNK_SIZE):
        number = start // EXTRA_CHUNK_SIZE + 1
        slices.append((extras_dir / f"extra-{number:03d}.woff2",
                       set(remaining[start:start + EXTRA_CHUNK_SIZE])))

    rules = ["/* Generated by scripts/build-woodland-font.py. Do not edit by hand. */"]
    covered = set()
    results = []
    for path, points in slices:
        if covered & points:
            raise ValueError("Unicode ranges overlap between font slices.")
        results.append(build_slice(source_data, points, path, original_notices))
        covered.update(points)
        url = "/" + path.relative_to("public").as_posix()
        rules.append(
            "@font-face {\n"
            f"  font-family: '{FAMILY}';\n"
            f"  src: url('{url}') format('woff2');\n"
            "  font-style: normal;\n"
            "  font-weight: 400;\n"
            "  font-display: swap;\n"
            f"  unicode-range: {unicode_ranges(points)};\n"
            "}"
        )
        print(json.dumps(results[-1]), flush=True)
    if covered != available:
        raise ValueError("The generated slices do not cover the full source cmap.")
    css_output.parent.mkdir(parents=True, exist_ok=True)
    css_output.write_text("\n\n".join(rules) + "\n", encoding="utf-8")
    manifest = {
        "family": FAMILY,
        "source_sha256": hashlib.sha256(source_data).hexdigest(),
        "unicode_codepoints": len(covered),
        "copy_sha256": {
            path.as_posix(): hashlib.sha256(content).hexdigest()
            for path, content in copy_data.items()
        },
        "slices": results,
    }
    (extras_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    used = {path for path, _ in slices}
    for path in extras_dir.glob("extra-*.woff2"):
        if path not in used:
            path.unlink()
    print(json.dumps({
        "css": css_output.as_posix(), "slices": len(slices),
        "unicode_codepoints": len(covered),
        "total_bytes": sum(result["bytes"] for result in results),
    }))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=relative_path)
    parser.add_argument(
        "--output", type=relative_path,
        default=Path("public/fonts/woodland-wenkai.woff2"),
    )
    parser.add_argument(
        "--css", type=relative_path,
        default=Path("src/components/HomeNow.fonts.css"),
    )
    args = parser.parse_args()
    try:
        build(args.source, args.output, args.css)
    except (OSError, TTLibError, ImportError):
        raise SystemExit("Font conversion failed; check the source and WOFF2 dependencies.")
    except ValueError as error:
        raise SystemExit(str(error))


if __name__ == "__main__":
    main()
