# Project visuals

Reviewed on 2026-10-08. These locally served WebP assets accompany the project introductions. Covers are editorial compositions; they are not application screenshots or newly measured results. Explanatory graphics and redrawn aggregate charts are identified in the captions. All nine projects have 1600 × 1000 covers.

## Sources and treatment

Source paths below are relative to the relevant project repository. Some Gaussian figures are local experiment outputs excluded from its public repository. No source checkout, experiment log, model checkpoint or raw participant data is distributed with this site.

| Assets | Project / source | Treatment |
| --- | --- | --- |
| `briefing-atlas.webp` | Briefing Atlas public archive | Existing compass composition, archive wording and topic categories. |
| `personal-website.webp` | Personal Website, `../control-deck-bg-1080.webp` | Existing site illustration and orbital motifs. |
| `fewshot-baselines.webp` | FewShot_Final_Project, `report/figures/baseline_accuracy_comparison.png` | Complete original experiment figure. |
| `fewshot-frofa.webp` | Same project, `report/figures/frofa_reproduction_comparison.png` | Complete original accuracy and gain figure. |
| `fewshot-clip.webp` | Same project, `report/figures/clip_frofa_summary_accuracy.png` | Complete original figure, including confidence intervals. |
| `fewshot-validation.webp` | Same project, `report/figures/postln_validation_sweep_gain.png` | Validation sweep; distinguished from final test performance. |
| `gaussian-initializers.webp`, `gaussian-convergence.webp` | Gaussian_Image_Fitting, `report/figures/ablation_initializer_visual.png` and `ablation_initializer_loss.png` | Complete original reconstruction / error panels and convergence curves. |
| `gaussian-models.webp` | Same project, `report/figures/ablation_model_visual.png` | Full four-configuration comparison. |
| `gaussian-optimizers.webp`, `gaussian-schedules.webp` | Same project, `report/figures/ablation_optimizer_loss.png` and `ablation_scheduler_loss.png` | Full original curves. |
| `colorfit-comparison.webp` | L2ColorFit, `pics/img1_input.png`, `pics/img1_output.png`, `outputs/img1_predicted.png` | Identical indoor detail crop of input / target / prediction, omitting counters, signs and screens. No recoloring. |
| `colorfit-transfer.webp` | Same project, `pics/img2_input.png`, `outputs/img2_predicted.png` | Identical vegetation / lawn crop excluding buildings, signs and people. No recoloring. |
| `colorfit-validation.webp` | Same project, README parameter results | Redrawn from reported validation MAE: 22.127320, 5.176385, 2.638307. Same-image spatial validation, not independent-image test errors. |
| `vae-grid.webp` | VAEDigitGen, `results/latent_grid.png` | Existing complete 21 × 21 figure. |
| `vae-reconstructions.webp`, `vae-latent.webp`, `vae-samples.webp`, `vae-training.webp` | Same project, `results/reconstructions.png`, `latent_scatter.png`, `five_samples.png`, `training_curves.png` | Complete original figures, resized without cropping. |
| `vaegan-comparison.webp` | VAEGANDigitGen, `results/prior_comparison.png` | Existing complete same-prior comparison. |
| `vaegan-reconstructions.webp`, `vaegan-grids.webp`, `vaegan-ablation.webp`, `vaegan-training.webp`, `vaegan-samples.webp` | Same project, `results/reconstructions.png`, `grid_comparison.png`, `ablation_comparison.png`, `training_curves.png`, `five_samples.png` | Complete original figures, resized without cropping. |
| `orientation-timeline.webp` | OrientationJND, `pics/trial_timeline.png` | Original planned trial sequence; box widths do not represent duration. |
| `orientation-results.webp` | Same project, `docs/experiment_report.md`, pooled counts in tables 1–2 | Replaces the earlier figure with aggregate data only. Different-trial counts are 8, 16, 31, 46, 47, 48 out of 48; shared same-trial accuracy is 279/288. No participant IDs or individual curves. |
| `orientation-response.webp` | Same report, table 4 | Redrawn pooled medians. All different trials: .321, .381, .371, .292, .281, .246 seconds; correct different trials: .437, .444, .428, .287, .281, .246 seconds. |
| `orientation-stimulus.webp` | Locally drawn Gabor illustration | Educational illustration, not a calibrated screenshot. The task presents stimuli sequentially. |
| `fewshot-poster.webp` | Locally composed specimen illustration | Warm paper, five abstract class samples and separate vertical labels for 1 / 5 shots. Shapes are illustrative, not dataset examples. |
| `gaussian-poster.webp` | `gaussian-initializers.webp` | Soft light motifs and a circular split between target and reconstructed flamingo details. Slight overscan removes the source panel's edge pixels. |
| `colorfit-poster.webp` | `colorfit-comparison.webp` | Full-bleed, matched input / prediction photo crops with a diagonal split. Existing reviewed pixels, without additional recoloring. |
| `vae-poster.webp` | `vae-grid.webp` | Cropped, rotated and tinted digit grid as a decorative latent-space atlas. The complete unmodified figure remains in the gallery. |
| `vaegan-poster.webp` | Locally composed model relationship illustration | Dark / light split with G and D letterforms for generator and discriminator. No generated samples or measured comparisons are claimed. |
| `orientation-poster.webp` | Locally drawn Gabor illustration | Black-and-white orientation contrast. Illustrative only; the actual task presents stimuli sequentially. |
| `triton-poster.webp` | Locally composed block-selection diagram | Acid yellow-green / charcoal engineering composition and an isometric sparse matrix. Block positions are conceptual, not measured attention scores. |
| `triton-backends.webp` | Triton_Attention_Optimization, `pic/t2i_attention_prompt000.jpg` | Complete seven-configuration generation comparison, retaining all labels. |
| `triton-timing.webp`, `triton-topk-timing.webp` | Same project, `pic/t2i_backend_timing_bar.png`, `pic/t2i_topk_timing_curve.png` | Complete original sampling-time plots; 20 prompts per configuration. Sampling excludes loading, text encoding and VAE decoding. |
| `triton-sparsity.webp` | Same project, `pic/sparse_topk_prompt001.jpg` | Complete five-ratio Sparse comparison for the cottage prompt. |
| `triton-long-sequence.webp` | Same project, `pic/sparse_int8_long_seq_speedup.png` | Complete original curve. Speedup is relative to FP16 Sparse at B=2, H=16, D=64, topk=0.8; the 1.20× dashed line is a target, not a measured series. |

Gaussian numeric descriptions use `outputs_report/ablation_visuals/visual_summary.json`, the run that produced the displayed figures. They differ slightly from the separate run summarized in `report/report.md`. The displayed random baseline is 30.7100 dB and image-sampling initialization is 31.8413 dB.

L2ColorFit metrics refer to complete original images. The published crops are only visual examples; their errors have not been substituted for full-image errors. New-input photographs have no paired target, so no independent-image error is claimed.

## Privacy and image quality

- Only selected experiment figures and reviewed photo details are included; terminal screenshots and participant-level records are excluded.
- Images are decoded to RGB pixels and re-encoded without EXIF, XMP or other source metadata. Original source images and intermediate contact sheets stay outside the published assets.
- Plot axes, legends and measured values are retained. Photos use matched crops, documented above and in their page captions.
- Original result figures use a maximum dimension of 2000 pixels without upscaling. Click the expand control to inspect figures and navigate the complete project gallery.
- Repository links remain the project's public references; they do not reveal local source locations.

## Rebuilding figures

`scripts/prepare-project-figures.py` uses Pillow, NumPy and Matplotlib. Prepare a reviewed reference directory, then run:

```powershell
python scripts/prepare-project-figures.py --references downloads/project-reference
```

The reference directory is ignored by Git. Its relative layout is:

| Folder | Selected source files |
| --- | --- |
| `fewshot/` | The four PNGs listed under FewShot_Final_Project above. |
| `gaussian/` | The five PNGs listed under Gaussian_Image_Fitting above. |
| `colorfit-input/` | `img1_input.png`, `img1_output.png`, `img2_input.png`. |
| `colorfit/` | `img1_predicted.png`, `img2_predicted.png`. |
| `vae/` | The four additional VAE PNGs listed above. |
| `vaegan/` | The five additional VAE-GAN PNGs listed above. |
| `orientation/` | `trial_timeline.png` only. |

The preparation script includes only aggregate values for the redrawn charts. Inspect photo crops and all image text after changing source files. Running the script is image preparation, not model training or an independent experiment reproduction.

## Rebuilding posters

The Triton figures and introduction use `Triton_Attention_Optimization` revision `11f56d3`, especially `doc/report.md`. The 1.48× long-sequence result is distinct from the 1.18× sampling speedup relative to SDPA. No new inference runs are represented. Re-encode the five complete source figures with the existing Playwright / browser setup:

```powershell
node scripts/prepare-triton-figures.mjs <source-repository>
```

Replace `<source-repository>` with the repository location. The script decodes pixels and exports WebP without source metadata, cropping, recoloring or upscaling.

Run `npm run posters:render` with Playwright and Microsoft Edge available, using the same browser setup as the browser checks. `PROJECTS_BROWSER_CHANNEL` or `PROJECTS_BROWSER_EXECUTABLE` can select another installed browser. No network requests or API keys are needed. To render selected covers only:

```powershell
npm run posters:render -- fewshot-poster.webp gaussian-poster.webp colorfit-poster.webp orientation-poster.webp
```

Edit `scripts/project-posters/templates.mjs` and `scripts/project-posters/styles.css` to update compositions. Reviewed photo and digit-grid crop coordinates live in `scripts/render-project-posters.mjs`. Font rendering uses Arial, Georgia and Microsoft YaHei when installed, with sans-serif and serif fallbacks. The renderer changes only the selected cover files, leaving the source figures intact. Full experimental plots and photographic comparisons remain separately available in the project galleries.
