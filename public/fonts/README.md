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

## Projects archive

`projects-instrument-serif.ttf` is the regular weight of Instrument Serif,
distributed by Google Fonts under the SIL Open Font License 1.1. The original
copyright and license are included in `LICENSE.projects-instrument-serif.txt`.
It is served locally and used only by the Projects archive.
