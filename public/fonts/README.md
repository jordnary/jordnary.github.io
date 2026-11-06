# Local fonts

`learning-rounded-medium.woff2` is a renamed subset of
[Resource Han Rounded CN v1.910](https://github.com/CyanoHao/Resource-Han-Rounded/releases/tag/v1.910),
licensed under SIL Open Font License 1.1. The full font license is included in
`LICENSE.learning-rounded.txt` and retained in the font metadata.

The subset contains the characters in `learningStatement` from
`src/components/LearningHeroScene.tsx`, plus a space. Regenerate it when that copy
changes: subset the upstream CN variable font using FontTools, instantiate
`wght=500` and `ROND=100`, rename the family to `Learning Rounded`, and export
WOFF2 with the copyright and license name records preserved.

Only the statement uses this font; other page typography uses its existing stack.

## Navigation labels

`navigation-soft-rounded.woff2` is a renamed subset of
[ChillRoundF v3.0](https://github.com/Warren2060/ChillRound), licensed under
SIL OFL 1.1. See `LICENSE.navigation-rounded.txt` for the license and attribution.
It contains only `首页关于学习项目联系` and a space, and is renamed to
`Navigation Soft Round`. Copyright and license name records are retained.
Only the five desktop and mobile navigation labels use it. The source is a
regular weight; navigation opts into browser weight synthesis for its 600 weight.

To regenerate, install `fonttools` and `brotli`, then run:

```sh
python scripts/subset-navigation-font.py "ChillRoundF v3.0.ttf"
```

## Home gallery button

`home-gallery-rounded.woff2` is another renamed subset of ChillRoundF v3.0,
under the same SIL OFL 1.1 license in `LICENSE.navigation-rounded.txt`.
It contains only `去别处随意逛逛返回顶部` and a space, and is renamed to
`Home Gallery Round`. Copyright and license name records are retained.
The Home gallery's random-page link and back-to-top button use it at the source's regular weight.

To regenerate, install `fonttools` and `brotli`, then run:

```sh
python scripts/subset-home-gallery-font.py "ChillRoundF v3.0.ttf"
```

## Page failure notice

`page-notice-rounded.woff2` uses the same ChillRoundF v3.0 source as navigation,
renamed to `Page Notice Round`. It contains only `页面加载失败` and retains the
copyright and SIL OFL 1.1 metadata; see `LICENSE.navigation-rounded.txt`.
The inline startup styles load this small subset only when an error is shown.
If the font request fails, the notice remains readable with the system fallback.

```sh
python scripts/subset-page-notice-font.py "ChillRoundF v3.0.ttf"
```

## Projects archive

`projects-instrument-serif.ttf` is the regular weight of Instrument Serif,
distributed by Google Fonts under the SIL Open Font License 1.1. The original
copyright and license are included in `LICENSE.projects-instrument-serif.txt`.
It is served locally and used by the Projects archive and the English display
type in the Home Now & notes reader.

## Woodland reader

`woodland-wenkai/reader.woff2`, `common-*.woff2`, and `extra-*.woff2` are disjoint slices of
the complete Regular font from
[LXGW WenKai Lite](https://github.com/lxgw/LxgwWenKai-Lite), renamed to
`Woodland WenKai` and converted to WOFF2 for the Home Now & notes reader.
Its handwritten forms complement the self-hosted Instrument Serif display face.
The derivative remains under SIL Open Font License 1.1; the complete upstream
copyright notice and license are in `LICENSE.woodland-wenkai.txt` and the original
copyright/license records remain embedded in the font. The renamed family avoids
the upstream reserved font names. No upstream endorsement is implied.

The source is `fonts/TTF/LXGWWenKaiLite-Regular.ttf`, version 1.530, pinned to
upstream commit `251ab63642d1c1c5db80497d78911b7aae6917d7`.
Its SHA-256 is
`f799a538a3355877e597a0ae04050e897932c9ae7689eb9227c2953c5dd549ea`.
All 25,694 mapped Unicode code points are preserved across the slices. The reader
core contains ASCII and Latin-1,
General Punctuation (`U+2000-206F`), CJK Symbols and Punctuation (`U+3000-303F`),
Halfwidth and Fullwidth Forms (`U+FF00-FFEF`), and every available character in
`HomeNow.tsx`, `LiveUpdates.tsx`, `home-editorial.ts`, and `reader-fonts.ts`.
Remaining GB2312 characters are sorted into 56 common slices of at most 128
characters. Other source code points retain their 18 extended slices of at most
1,024 characters. Final groups can be smaller.

`src/components/HomeNow.fonts.css` declares the core and every other slice with
exact, non-overlapping `unicode-range` values, regular weight, and
`font-display: swap`. Static reader copy loads the core; additional characters
in dynamic content fetch their corresponding common or extended slice
as needed. This preserves the complete source character coverage instead of
discarding characters absent from static copy. Characters outside the upstream
Lite edition still use the browser's fallback font. Relevant OpenType layout
features and their supporting glyphs are retained within each slice.
The reader core is 93,372 bytes for 680 code points, replacing the former
1,658,704-byte base. Common slices cover 7,098 code points and range from
10,844 to 46,064 bytes. The 18 extended files still cover 17,916 code points
and are unchanged. All 75 slices total 6,842,236 bytes: 340,404 bytes more than
the previous deployment, in exchange for substantially smaller individual
reading downloads. This is a transfer optimization, not a smaller full font.

The existing 600px reader lead-in prepares the core and Instrument Serif unless
the document is hidden or Save-Data is enabled. Removing all weak-network font
preparation delayed warm reading, so the small core keeps that lead-in. At most
three previously used common slices can also be prepared on a later visit in
the same browser session. Only their bounded Unicode range identifiers are
stored; article text and font binaries are not stored by application code.
Extended slices remain demand-only. Font failures never block opening, reading,
or closing; the existing KaiTi/serif fallback and `font-display: swap` remain.

To reproduce from the project root with Python and PowerShell:

```powershell
python -m pip install fonttools==4.67.0 brotli==1.2.0
New-Item -ItemType Directory -Force downloads/woodland-font | Out-Null
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/lxgw/LxgwWenKai-Lite/251ab63642d1c1c5db80497d78911b7aae6917d7/fonts/TTF/LXGWWenKaiLite-Regular.ttf' -OutFile downloads/woodland-font/LXGWWenKaiLite-Regular.ttf
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/lxgw/LxgwWenKai-Lite/251ab63642d1c1c5db80497d78911b7aae6917d7/OFL.txt' -OutFile public/fonts/LICENSE.woodland-wenkai.txt
python scripts/build-woodland-font.py downloads/woodland-font/LXGWWenKaiLite-Regular.ttf
python tests/woodland-font.test.py downloads/woodland-font/LXGWWenKaiLite-Regular.ttf
```

The build script accepts only project-relative paths and preserves the source
font timestamps. For the same source font and reader copy, the sorted slice
assignment is reproducible. It verifies every slice's exact character set,
checks that no ranges overlap and their union equals the full source cmap, and
preserves the original copyright/license records in every file. Subsetting
changes glyph counts and ordering within each individual file. The generated
`woodland-wenkai/manifest.json` records the source/copy checksums (copy line endings
are normalized to LF), slice sizes,
and output checksums. Regenerate the font files and CSS together whenever the
reader's static copy changes. Downloaded TTF sources remain in the ignored
`downloads/` directory.

The verification additionally compares all 25,694 decomposed glyph outlines,
advance widths, side bearings, and line metrics against the pinned upstream
source. Runtime preparation, per-character slice selection, failed-font fallback,
and cancellation are covered by `npm run test:first-open` against a production
preview. See `docs/ux-refactor.md` section 6.10 for the measured acceptance matrix.
