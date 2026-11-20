"""Rebuild a reviewed foreground protection mask from catalog.json; no photo repainting."""
import argparse
import hashlib
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def build(spec):
    shot = spec['shots']['scene']
    recipe = shot['protectionMaskSpec']
    source = ROOT / spec['master']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == recipe['sourceSha256'] == spec['masterSha256']
    a = np.asarray(Image.open(source).convert('RGB')).astype(np.float32)
    gray = a.mean(2)
    row = np.median(np.concatenate([gray[:, :12], gray[:, -12:]], axis=1), axis=1)
    left, top, right, bottom = recipe['roi']
    binary = np.zeros(gray.shape, dtype=np.uint8)
    binary[top:bottom, left:right] = (gray[top:bottom, left:right] < row[top:bottom, None] - recipe['brightnessDelta']).astype(np.uint8) * 255
    x, y = recipe['seed']
    assert binary[y, x] == 255
    connected = Image.fromarray(binary).copy()  # writable: fromarray alone is readonly
    ImageDraw.floodfill(connected, (x, y), 128, thresh=0)
    component = np.asarray(connected) == 128
    outside = Image.fromarray(np.where(component, 0, 255).astype(np.uint8)).copy()
    ImageDraw.floodfill(outside, (0, 0), 128, thresh=0)
    mask = np.where(np.asarray(outside) == 128, 0, 255).astype(np.uint8)
    if recipe.get('boundaryPolygon'):
        limit = Image.new('L', (gray.shape[1], gray.shape[0]), 0)
        ImageDraw.Draw(limit).polygon([tuple(p) for p in recipe['boundaryPolygon']], fill=255)
        mask = np.minimum(mask, np.asarray(limit))
    assert mask[0, 0] == 0 and mask[y, x] == 255 and 0 < np.mean(mask > 0) < .9
    data = io.BytesIO()
    Image.fromarray(mask).save(data, format='PNG')
    return data.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('product')
    parser.add_argument('--verify', action='store_true', help='Recompute/hash only; never writes')
    args = parser.parse_args()
    spec = json.loads((ROOT / 'workflows/figura/catalog.json').read_text('utf-8'))[args.product]
    shot = spec['shots']['scene']
    data = build(spec)
    digest = hashlib.sha256(data).hexdigest()
    if digest != shot['protectionMaskSha256']:
        raise ValueError('Mask recipe/runtime differs from the reviewed mask; preserve the saved revision')
    target = (ROOT / shot['protectionMask']).resolve()
    if not target.is_relative_to((ROOT / 'work').resolve()):
        raise ValueError('Masks must remain in ignored work/')
    if target.exists():
        if hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            raise ValueError('Existing mask was modified')
    elif not args.verify:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as out:
            out.write(data)
    print(args.product, 'protection mask verified', digest)


if __name__ == '__main__':
    main()
