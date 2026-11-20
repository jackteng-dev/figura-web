"""Read-only verification of all saved local gallery sources and served bytes."""
import hashlib
import importlib.util
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
loader = importlib.util.spec_from_file_location('catalog_gallery', Path(__file__).with_name('catalog_gallery.py'))
gallery = importlib.util.module_from_spec(loader)
loader.loader.exec_module(gallery)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    manifest = json.loads(gallery.MANIFEST.read_text('utf-8'))
    assert manifest['scope'] == gallery.BASE + '/api/catalog/products'
    assert manifest['authorApproval'] == 'pending' and len(manifest['products']) == 95
    api = gallery.API()  # Public reads only; no login, environment file or writes.
    catalog = []
    for page in range(1, 101):
        result = api.request(f'/api/catalog/products?page={page}&pageSize=50')
        catalog.extend(result['items'])
        if len(catalog) >= result['total']:
            break
    expected_ids = {p['id'] for p in manifest['products']} | {p['id'] for p in manifest['excluded']}
    assert len(catalog) == 99 and {p['id'] for p in catalog} == expected_ids
    checks = []
    for product in manifest['products']:
        assert product['publicationSession']['state'] == 'restored'
        assert digest(ROOT / product['master']['path']) == product['master']['sha256']
        images = api.request('/api/catalog/products/' + product['id'] + '/image')
        assert len(images) == 4 and {image['type'] for image in images} == {'MAIN', 'FACE', 'DETAIL', 'SCENE'}
        assert next(image['id'] for image in images if image['primary']) == product['master']['imageId']
        served = []
        for image in images:
            kind = image['type']
            slot = product['slots'][kind]
            assert slot['status'] == 'complete'
            if kind == 'MAIN':
                expected_sha = product['master']['sha256']
            else:
                upload = slot['upload']
                assert upload['status'] == 'acknowledged' and image['id'] == upload['imageId']
                assert 'AI 生成示意圖' in image['alt']
                assert digest(ROOT / slot['path']) == slot['sha256'] == upload['sourceSha256']
                run = json.loads((gallery.comfy.WORK / 'runs' / slot['runId'] / 'run.json').read_text('utf-8'))
                assert run['review']['decision'] == 'pass' and run['humanApproval'] is None
                assert run['masterSha256'] == product['master']['sha256']
                assert run['outputSha256'] == slot['sha256']
                expected_sha = upload['servedSha256']
            data = api.request(image['url'], raw=True)
            actual_sha = hashlib.sha256(data).hexdigest()
            assert actual_sha == expected_sha, (product['productKey'], kind, 'served content changed')
            served.append(dict(type=kind, imageId=image['id'], bytes=len(data), sha256=actual_sha))
        checks.append(dict(key=product['productKey'], originalMainUnchanged=True, reviewedOnly=True,
                           noAngleRearUploads=True, publicationRestored=True, images=served))
        print(product['productKey'] + ': verified source and four served image hashes', flush=True)
    report = dict(at=time.time(), api=gallery.BASE, scope='read-only local demo; no login or mutation',
                  catalogRows=len(catalog), products=len(checks), excludedRows=len(manifest['excluded']),
                  authorApproval='pending', checks=checks)
    target = ROOT / 'docs/verification/catalog-gallery-integrity-2026-11-20.json'
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(target)


if __name__ == '__main__':
    main()
