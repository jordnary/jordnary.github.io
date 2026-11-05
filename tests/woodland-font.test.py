"""Verify deployed slices against the pinned source, including glyph outlines."""

import hashlib
import json
from pathlib import Path
import re
import sys

try:
    from fontTools.pens.recordingPen import DecomposingRecordingPen
    from fontTools.ttLib import TTFont
except ImportError:
    raise SystemExit("Install the fonttools[woff] dependency before verification.") from None


def notices(font):
    return sorted((n.nameID, n.platformID, n.platEncID, n.langID, bytes(n.string))
                  for n in font["name"].names if n.nameID in {0, 13, 14})


def outline(glyphs, name):
    pen = DecomposingRecordingPen(glyphs)
    glyphs[name].draw(pen)
    return pen.value


def main():
    source = Path(sys.argv[1] if len(sys.argv) > 1 else
                  "downloads/woodland-font/LXGWWenKaiLite-Regular.ttf")
    assert not source.is_absolute() and ".." not in source.parts
    manifest = json.loads(Path("public/fonts/woodland-wenkai/manifest.json").read_text())
    for file, expected in manifest["copy_sha256"].items():
        assert hashlib.sha256(Path(file).read_bytes().replace(b"\r\n", b"\n")).hexdigest() == expected, "Static copy changed; regenerate the font slices"
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    assert digest == manifest["source_sha256"] == "f799a538a3355877e597a0ae04050e897932c9ae7689eb9227c2953c5dd549ea"
    css = Path("src/components/HomeNow.fonts.css").read_text()
    rules = re.findall(r"@font-face\s*\{([^}]+)\}", css)
    assert len(rules) == len(manifest["slices"])
    covered = set()
    with TTFont(source) as original:
        cmap = original.getBestCmap()
        glyphs = original.getGlyphSet()
        for item, rule in zip(manifest["slices"], rules):
            path = Path(item["output"])
            assert not path.is_absolute() and ".." not in path.parts
            assert hashlib.sha256(path.read_bytes()).hexdigest() == item["sha256"]
            assert path.stat().st_size == item["bytes"]
            assert "/" + path.relative_to("public").as_posix() in rule
            assert "font-display: swap" in rule
            points = set()
            for first, last in re.findall(r"U\+([0-9A-F]+)(?:-([0-9A-F]+))?", rule):
                points.update(range(int(first, 16), int(last or first, 16) + 1))
            assert not covered & points, "Font ranges must not overlap"
            covered.update(points)
            with TTFont(path) as rebuilt:
                rebuilt_cmap = rebuilt.getBestCmap()
                rebuilt_glyphs = rebuilt.getGlyphSet()
                assert set(rebuilt_cmap) == points
                assert len(points) == item["unicode_codepoints"]
                assert notices(rebuilt) == notices(original)
                assert rebuilt["head"].unitsPerEm == original["head"].unitsPerEm
                for attribute in ("ascent", "descent", "lineGap"):
                    assert getattr(rebuilt["hhea"], attribute) == getattr(original["hhea"], attribute)
                for point, name in rebuilt_cmap.items():
                    source_name = cmap[point]
                    assert rebuilt["hmtx"][name] == original["hmtx"][source_name], "Glyph metrics changed"
                    assert outline(rebuilt_glyphs, name) == outline(glyphs, source_name), "Glyph outlines changed"
        assert covered == set(cmap)
        assert len(covered) == manifest["unicode_codepoints"] == 25694
    assert manifest["slices"][0]["bytes"] < 200_000, "Reader core must stay below 200 kB"
    assert all(item["bytes"] < 48 * 1024 for item in manifest["slices"] if "/common-" in item["output"]), "Common slices must stay below 48 KiB"
    print(json.dumps({"verified_codepoints": len(covered), "slices": len(rules),
                      "core_bytes": manifest["slices"][0]["bytes"],
                      "outlines_metrics_notices": "unchanged"}))


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError) as error:
        raise SystemExit(str(error) if isinstance(error, AssertionError) and str(error) else "Font verification failed.") from None
