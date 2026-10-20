"""Build the Home gallery button font subset from ChillRoundF v3.0.

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
subsetter.populate(text="去别处随意逛逛 ")
subsetter.subset(font)

names = {
    1: "Home Gallery Round",
    2: "Regular",
    3: "HomeGalleryRound-Regular-3.0",
    4: "Home Gallery Round Regular",
    6: "HomeGalleryRound-Regular",
    16: "Home Gallery Round",
    17: "Regular",
}
for record in font["name"].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())

font.flavor = "woff2"
font.save("public/fonts/home-gallery-rounded.woff2")
print("Home gallery font subset generated.")
