# Projects archive background

`linework-background.webp` is the unchanged, lossless grayscale source supplied
for the Projects redesign, at 1672 × 941 pixels. It is retained as the reproducible
input to `scripts/prepare-project-archive.py`.

The page uses two processed WebP variants:

| Asset | Dimensions | Encoded size |
| --- | --- | --- |
| `linework-background-1920.webp` | 1920 × 1081 | 294,394 bytes |
| `linework-background-3840.webp` | 3840 × 2161 | 577,586 bytes |

The treatment uses Lanczos resampling, mild unsharp masking (28% strength,
0.7 source-pixel radius, threshold 3), and a grayscale tone curve. Paper
highlights are unified at `#f2f2f2`; line contrast is reduced to 64% of the
source contrast relative to its paper tone of 244. The composition and drawn
lines are preserved. The larger dimensions improve high-density display
sampling; they do not restore detail absent from the source or redraw the art.

Both variants use WebP quality 95 and encoding method 6. Source EXIF, ICC,
comments, and other metadata are omitted. Regenerate them with Pillow installed:

```sh
python scripts/prepare-project-archive.py
```

The archive uses the artwork as a fixed, full-viewport background. Project hover previews
use the existing covers in `images/projects/`, displayed in their original
8:5 proportions without cropping.
