"""Prepare reviewed figures from a relative reference directory; never copy metadata."""
import argparse
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--references', type=Path, default=Path('downloads/project-reference'))
    parser.add_argument('--output', type=Path, default=Path('public/images/projects'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    def save(image, name, maximum=2000):
        image = image.convert('RGB')
        image.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
        clean = Image.frombytes('RGB', image.size, image.tobytes())
        clean.save(args.output / f'{name}.webp', quality=91, method=6)
        print(f'Prepared {name}.webp ({clean.width} x {clean.height})')

    figures = {
        'fewshot': {
            'baseline_accuracy_comparison': 'fewshot-baselines',
            'frofa_reproduction_comparison': 'fewshot-frofa',
            'clip_frofa_summary_accuracy': 'fewshot-clip',
            'postln_validation_sweep_gain': 'fewshot-validation',
        },
        'gaussian': {
            'ablation_initializer_visual': 'gaussian-initializers',
            'ablation_initializer_loss': 'gaussian-convergence',
            'ablation_model_visual': 'gaussian-models',
            'ablation_optimizer_loss': 'gaussian-optimizers',
            'ablation_scheduler_loss': 'gaussian-schedules',
        },
        'vae': {
            'reconstructions': 'vae-reconstructions',
            'latent_scatter': 'vae-latent',
            'five_samples': 'vae-samples',
            'training_curves': 'vae-training',
        },
        'vaegan': {
            'reconstructions': 'vaegan-reconstructions',
            'grid_comparison': 'vaegan-grids',
            'ablation_comparison': 'vaegan-ablation',
            'training_curves': 'vaegan-training',
            'five_samples': 'vaegan-samples',
        },
        'orientation': {'trial_timeline': 'orientation-timeline'},
    }
    for group, names in figures.items():
        for source, destination in names.items():
            with Image.open(args.references / group / f'{source}.png') as image:
                save(image, destination)

    # Use identical, explicitly disclosed crops of every corresponding photograph.
    # The indoor crop excludes all counters, signs, screens and printed table cards.
    # The outdoor crop excludes buildings and keeps only vegetation / lawn detail.
    font = ImageFont.load_default(size=24)

    def comparison(items, crop, name):
        canvas = Image.new('RGB', (len(items) * 580, 545), '#f7f7f2')
        draw = ImageDraw.Draw(canvas)
        for index, (file, label) in enumerate(items):
            with Image.open(args.references / file) as image:
                image = image.convert('RGB').crop(crop)
                image = ImageOps.contain(image, (552, 465))
            x = index * 580
            canvas.paste(image, (x + (580-image.width)//2, 62+(465-image.height)//2))
            draw.text((x+18, 20), label, font=font, fill='#224a43')
        save(canvas, name)

    comparison([
        ('colorfit-input/img1_input.png', 'INPUT / detail'),
        ('colorfit-input/img1_output.png', 'TARGET / detail'),
        ('colorfit/img1_predicted.png', 'PREDICTION / detail'),
    ], (0, 475, 695, 956), 'colorfit-comparison')
    comparison([
        ('colorfit-input/img2_input.png', 'NEW INPUT / detail'),
        ('colorfit/img2_predicted.png', 'MAPPED / detail'),
    ], (480, 760, 820, 900), 'colorfit-transfer')

    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import numpy as np
    from matplotlib.ticker import PercentFormatter
    plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 12, 'axes.spines.top': False,
                         'axes.spines.right': False, 'axes.labelcolor': '#304840', 'text.color': '#304840',
                         'axes.titleweight': 'bold', 'figure.facecolor': 'white'})

    def save_plot(fig, name):
        buffer = BytesIO()
        fig.savefig(buffer, format='png', dpi=180, bbox_inches='tight')
        buffer.seek(0)
        with Image.open(buffer) as image:
            save(image, name)
        plt.close(fig)

    # Aggregate values from the report; no participant identifiers or trial records.
    differences = np.array([.5, 1, 2, 4, 8, 16])
    hit = np.array([8, 16, 31, 46, 47, 48]) / 48
    control = 279 / 288
    balanced = (hit + control) / 2
    fig, ax = plt.subplots(figsize=(11, 5.5), layout='constrained')
    ax.plot(differences, hit, 'o-', color='#327b90', label='Different-trial accuracy')
    ax.plot(differences, balanced, 's-', color='#be753f', label='Balanced accuracy')
    ax.axhline(control, linestyle=':', color='#668570', label='Same-trial accuracy (279 / 288)')
    ax.axhline(.75, linestyle='--', color='#adb3a7', label='75% operational criterion')
    ax.set(xscale='log', ylim=(0, 1.04), xlabel='Orientation difference (degrees)', ylabel='Accuracy',
           title='Orientation discrimination / pooled descriptive results')
    ax.set_xticks(differences, ['0.5', '1', '2', '4', '8', '16'])
    ax.yaxis.set_major_formatter(PercentFormatter(1))
    ax.grid(alpha=.16)
    ax.legend(loc='lower right', fontsize=10)
    fig.supxlabel('4 participants / 576 trials / 48 different trials per angle / shared same-trial baseline', fontsize=10)
    save_plot(fig, 'orientation-results')

    fig, ax = plt.subplots(figsize=(11, 5), layout='constrained')
    ax.plot(differences, [.321, .381, .371, .292, .281, .246], 'o-', label='All different-trial responses', color='#327b90')
    ax.plot(differences, [.437, .444, .428, .287, .281, .246], 's-', label='Correct different-trial responses', color='#be753f')
    ax.set(xscale='log', ylim=(0, .55), xlabel='Orientation difference (degrees)', ylabel='Median response time (s)',
           title='Response time / pooled medians')
    ax.set_xticks(differences, ['0.5', '1', '2', '4', '8', '16'])
    ax.grid(alpha=.16)
    ax.legend(fontsize=10)
    fig.supxlabel('Time starts at the response prompt, after the comparison stimulus disappears.', fontsize=10)
    save_plot(fig, 'orientation-response')

    fig, axes = plt.subplots(1, 2, figsize=(10, 4.5), layout='constrained')
    yy, xx = np.mgrid[-1:1:320j, -1:1:320j]
    for ax, angle, title in zip(axes, [0, 8], ['Reference / schematic', 'Comparison / +8 degrees']):
        phase = xx*np.cos(np.deg2rad(angle)) + yy*np.sin(np.deg2rad(angle))
        stimulus = .5 + .45*np.cos(2*np.pi*7.2*phase)*np.exp(-(xx**2+yy**2)/(.36**2*2))
        ax.imshow(stimulus, cmap='gray', vmin=0, vmax=1)
        ax.axis('off')
        ax.set_title(title)
    fig.supxlabel('Illustration only / sequential presentation in the task / not a calibrated stimulus screenshot', fontsize=10)
    save_plot(fig, 'orientation-stimulus')

    fig, ax = plt.subplots(figsize=(10, 5), layout='constrained')
    labels = ['Linear RGB', 'Polynomial / gamma = 1', 'Selected / gamma = 0.725']
    values = [22.127320, 5.176385, 2.638307]
    bars = ax.barh(labels, values, color=['#a9bdb4', '#609a89', '#226b59'])
    ax.bar_label(bars, fmt='%.3f', padding=8)
    ax.invert_yaxis()
    ax.set(xlim=(0, 26), xlabel='Validation MAE / RGB scale 0-255 (lower is better)',
           title='Color mapping / same-image spatial validation')
    ax.grid(axis='x', alpha=.15)
    ax.set_axisbelow(True)
    fig.supxlabel('64 x 64 spatial blocks / 45 parameter combinations / not an independent-image test', fontsize=10)
    save_plot(fig, 'colorfit-validation')


if __name__ == '__main__':
    main()
