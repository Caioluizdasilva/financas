"""Compara duas pastas de capturas pixel a pixel.

Uso: python3 tests/visual/compare.py <antes> <depois> [pasta-de-diferencas]

Sai com código 1 se alguma tela mudou. Grava uma imagem destacando as
diferenças para cada tela que mudou.
"""
import pathlib
import sys

from PIL import Image, ImageChops


def main(a, b, diff_dir=None):
    a, b = pathlib.Path(a), pathlib.Path(b)
    diff_dir = pathlib.Path(diff_dir) if diff_dir else None
    if diff_dir:
        diff_dir.mkdir(parents=True, exist_ok=True)
    names = sorted({p.name for p in a.glob('*.png')} | {p.name for p in b.glob('*.png')})
    changed = []
    for name in names:
        pa, pb = a / name, b / name
        if not pa.exists() or not pb.exists():
            changed.append((name, 'faltando em ' + ('antes' if not pa.exists() else 'depois')))
            continue
        ia, ib = Image.open(pa).convert('RGB'), Image.open(pb).convert('RGB')
        if ia.size != ib.size:
            changed.append((name, f'tamanho {ia.size} -> {ib.size}'))
            continue
        diff = ImageChops.difference(ia, ib)
        box = diff.getbbox()
        if box:
            px = sum(diff.convert("L").histogram()[1:])
            changed.append((name, f'{px} pixels diferentes em {box}'))
            if diff_dir:
                mask = diff.convert('L').point(lambda v: 255 if v else 0)
                out = Image.blend(ia, Image.new('RGB', ia.size, (255, 0, 255)), 0)
                out.paste((255, 0, 255), mask=mask)
                Image.blend(ia, out, 0.7).save(diff_dir / name)
    print(f'{len(names)} telas comparadas, {len(changed)} com diferença')
    for name, why in changed:
        print(f' - {name}: {why}')
    return 1 if changed else 0


if __name__ == '__main__':
    sys.exit(main(*sys.argv[1:]))
