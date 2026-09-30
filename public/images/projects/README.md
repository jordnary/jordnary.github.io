# Project visuals

These images illustrate the owner's public projects. Local poster compositions and public experiment figures were reviewed on 2026-09-30. All assets are served locally. Posters are editorial compositions, not website screenshots or new experiment results.

| Asset | Public source | Treatment |
| --- | --- | --- |
| `briefing-atlas.webp` | [Briefing Atlas archive](https://jordnary.github.io/briefing-atlas/archive/) | Local 1600 × 1000 composition using the site's compass motif, emerald palette, archive wording and topic categories; no companion or screenshot. |
| `personal-website.webp` | [Personal Website](https://jordnary.github.io/) and `../control-deck-bg-1080.webp` | Local 1600 × 1000 composition reusing the existing site illustration, J identity, orbital motifs and page names. |
| `vae-grid.webp` | [VAE latent grid](https://github.com/jordnary/VAEDigitGen/blob/HEAD/results/latent_grid.png) | Complete published figure, resized without cropping. |
| `vaegan-comparison.webp` | [VAE-GAN prior comparison](https://github.com/jordnary/VAEGANDigitGen/blob/HEAD/results/prior_comparison.png) | Complete published figure, resized without cropping. |
| `orientation-results.webp` | [Orientation accuracy](https://github.com/jordnary/OrientationJND/blob/HEAD/pics/accuracy_overview.png) | Complete published figure, resized without cropping. |
| `vaegan-poster.webp` | `vaegan-comparison.webp` | Local 1600 × 1000 cover; the complete figure is contained within a layered paper composition. |
| `orientation-poster.webp` | `orientation-results.webp` | Local 1600 × 1000 cover; the complete figure is paired with a decorative Gabor motif. |
| `vae-poster.webp` | `vae-grid.webp` | Local 1600 × 1000 cover; the complete grid is paired with decorative latent-space curves, which do not represent measured trajectories. |

All images are WebP with metadata removed. The three experiment source images are preserved separately and shown directly in the gallery. Cover composition changes no data, labels, axes or legends. Compression and resizing are for presentation; original figures and methodological caveats remain available through the linked repositories and project details. Previewing an image is not an independent reproduction of its experiment. The page's few-shot, Gaussian and color-mapping diagrams are explanatory illustrations, explicitly labeled as such.

## Rebuilding the posters

Run `npm run posters:render` with Playwright and Microsoft Edge available, using the same browser setup as the project browser checks. `PROJECTS_BROWSER_CHANNEL` or `PROJECTS_BROWSER_EXECUTABLE` can select another installed browser. The renderer requires no API key or network requests.

Edit `scripts/project-posters/templates.mjs` and `scripts/project-posters/styles.css` to update the compositions. The shared print layout and figure treatment keep all five covers at an 8:5 aspect ratio. Rendering produces optimized WebP files directly in this directory; it does not touch the three source figures. The existing site illustration is reused without changing its source file. Font rendering uses Arial and Microsoft YaHei when installed, with a sans-serif fallback.
