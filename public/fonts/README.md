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

## Projects archive

`projects-instrument-serif.ttf` is the regular weight of Instrument Serif,
distributed by Google Fonts under the SIL Open Font License 1.1. The original
copyright and license are included in `LICENSE.projects-instrument-serif.txt`.
It is served locally and used by the Projects archive and the English display
type in the Home Now & notes reader.

## Woodland reader

`woodland-wenkai.woff2` and `woodland-wenkai/extra-*.woff2` are disjoint slices of
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
All 25,694 mapped Unicode code points are preserved across the slices. The base
file contains every source character encodable as GB2312, ASCII and Latin-1,
General Punctuation (`U+2000-206F`), CJK Symbols and Punctuation (`U+3000-303F`),
Halfwidth and Fullwidth Forms (`U+FF00-FFEF`), and every available character in
`HomeNow.tsx`, `LiveUpdates.tsx`, and `home-editorial.ts`. The remaining source
code points are sorted and divided into sequential groups of 1,024 characters
(the final group may be smaller).

`src/components/HomeNow.fonts.css` declares the base and each extra slice with
exact, non-overlapping `unicode-range` values, regular weight, and
`font-display: swap`. Ordinary reader text loads only the base file; unfamiliar
characters in dynamic RSS content fetch their corresponding small extra slice
as needed. This preserves the complete source character coverage instead of
discarding characters absent from static copy. Characters outside the upstream
Lite edition still use the browser's fallback font. Relevant OpenType layout
features and their supporting glyphs are retained within each slice.
The current base file is 1,658,704 bytes (about 1.58 MiB) for 7,778 code points.
The 18 extra files cover the remaining 17,916 code points and are each about
50–356 KiB. Downloading every slice would total 6,501,832 bytes; the purpose of
the split is to keep ordinary reading loads small while retaining rare-character
coverage on demand.

To reproduce from the project root with Python and PowerShell:

```powershell
python -m pip install fonttools==4.67.0 brotli==1.2.0
New-Item -ItemType Directory -Force downloads/woodland-font | Out-Null
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/lxgw/LxgwWenKai-Lite/251ab63642d1c1c5db80497d78911b7aae6917d7/fonts/TTF/LXGWWenKaiLite-Regular.ttf' -OutFile downloads/woodland-font/LXGWWenKaiLite-Regular.ttf
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/lxgw/LxgwWenKai-Lite/251ab63642d1c1c5db80497d78911b7aae6917d7/OFL.txt' -OutFile public/fonts/LICENSE.woodland-wenkai.txt
python scripts/build-woodland-font.py downloads/woodland-font/LXGWWenKaiLite-Regular.ttf
```

The build script accepts only project-relative paths and preserves the source
font timestamps. For the same source font and reader copy, the sorted slice
assignment is reproducible. It verifies every slice's exact character set,
checks that no ranges overlap and their union equals the full source cmap, and
preserves the original copyright/license records in every file. Subsetting
changes glyph counts and ordering within each individual file. The generated
`woodland-wenkai/manifest.json` records the source/copy checksums, slice sizes,
and output checksums. Regenerate the font files and CSS together whenever the
reader's static copy changes. Downloaded TTF sources remain in the ignored
`downloads/` directory.
