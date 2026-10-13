# Learning statement font

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
