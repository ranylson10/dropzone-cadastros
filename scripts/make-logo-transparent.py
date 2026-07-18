"""Remove fundo preto da logo DropZone e gera PNG transparente centralizado."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'web' / 'public' / 'dropzone-icon.png'
BACKUP = ROOT / 'web' / 'public' / 'dropzone-icon-with-black-bg.png'
OUT = ROOT / 'web' / 'public' / 'dropzone-icon.png'


def main() -> None:
    original = Image.open(SRC).convert('RGBA')
    if not BACKUP.exists():
        original.save(BACKUP)

    arr = np.array(original).astype(np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    dark = np.maximum(np.maximum(r, g), b)

    # Soft mask: fundo escuro some; ouro/amarelo permanece
    alpha = np.clip((dark - 22) / 48.0, 0, 1) * 255
    alpha = np.where(dark < 28, 0, alpha)
    goldish = (r > 110) & (g > 80) & (b < 130) & ((r + g) > (b * 2.0))
    alpha = np.where(goldish, np.maximum(alpha, 245), alpha)
    arr[:, :, 3] = np.minimum(a, alpha)

    alpha_u8 = arr[:, :, 3]
    ys, xs = np.where(alpha_u8 > 8)
    if len(xs) == 0:
        raise SystemExit('Nenhum pixel opaco apos remocao de fundo.')

    pad = int(max(arr.shape[0], arr.shape[1]) * 0.05)
    y0, y1 = max(0, int(ys.min()) - pad), min(arr.shape[0], int(ys.max()) + pad + 1)
    x0, x1 = max(0, int(xs.min()) - pad), min(arr.shape[1], int(xs.max()) + pad + 1)
    cropped = Image.fromarray(arr[y0:y1, x0:x1].astype(np.uint8), 'RGBA')

    canvas_side = 512
    target = int(canvas_side * 0.90)
    scale = target / max(cropped.size)
    nw = max(1, int(cropped.size[0] * scale))
    nh = max(1, int(cropped.size[1] * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new('RGBA', (canvas_side, canvas_side), (0, 0, 0, 0))
    ox = (canvas_side - nw) // 2
    oy = (canvas_side - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    canvas.save(OUT, 'PNG', optimize=True)

    a2 = np.array(canvas)[:, :, 3]
    print(f'saved {OUT} size={canvas.size}')
    print(
        'opaque', int((a2 > 200).sum()),
        'transparent', int((a2 < 10).sum()),
        'partial', int(((a2 >= 10) & (a2 <= 200)).sum()),
    )


if __name__ == '__main__':
    main()
