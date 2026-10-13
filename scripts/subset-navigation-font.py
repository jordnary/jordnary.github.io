"""Build the navigation font subset from ChillRoundF v3.0.

Requires fonttools and brotli. Pass the upstream TTF as the argument.
"""

import argparse
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
args = parser.parse_args()

font = TTFont(args.source)
options = subset.Options()
options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
options.name_languages = [0x409]
subsetter = subset.Subsetter(options=options)
subsetter.populate(text="首页关于学习项目联系 ")
subsetter.subset(font)

names = {
    1: "Navigation Soft Round",
    2: "Regular",
    3: "NavigationSoftRound-Regular-3.0",
    4: "Navigation Soft Round Regular",
    6: "NavigationSoftRound-Regular",
    16: "Navigation Soft Round",
    17: "Regular",
}
for record in font["name"].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())

font.flavor = "woff2"
font.save("public/fonts/navigation-soft-rounded.woff2")
print("Navigation font subset generated.")
