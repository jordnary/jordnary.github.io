# Home artwork

The homepage Directory and Now & notes galleries use six optimized WebP images with no embedded EXIF, XMP, or ICC metadata:

- `about.webp`: an iceberg and a path into a hidden library.
- `learning.webp`: an exploded architectural library with orange circulation paths.
- `projects.webp`: sketching desk.
- `contact.webp`: lavender stationery and a paper airplane.
- `now-building.webp`: a warm wooden studio with climbing plants and a structure dissolving into pencil construction lines.
- `now-following.webp`: a nature scrapbook, botanical and landscape paper cutouts, and a magnifying glass over small white flowers.

These are encoded from the supplied PNG artwork at its original 1536 × 1024 resolution. Original PNGs remain local and are excluded from Git; production references only the WebP files.

The two Now & notes covers use WebP quality 88 and method 6, reducing their combined size by approximately 89% while preserving the original dimensions.

The reader uses an integrated woodland illustration around the text:

- `now-woodland-frame.webp`: 1536 × 1024, 110,160 bytes; a cabin, canopy,
  ferns and winding paths feather into a warm paper clearing.
- `now-woodland-frame-mobile.webp`: 1024 × 1536, 69,202 bytes; a portrait
  composition with narrow botanical margins and a larger reading clearing.

Photographic depth of field is baked into both illustrations: the cabin and warm
windows remain sharp, nearby foliage falls out of focus, and distant trees recede
into mist. No browser blur filter or additional background layer is required.
These original illustrations contain no embedded text or metadata. The portrait
is selected below 600px; text, controls and progress remain native HTML.
Original PNGs stay excluded from Git. Design and prompts are documented in
`docs/design/home-now-reader.md`.
