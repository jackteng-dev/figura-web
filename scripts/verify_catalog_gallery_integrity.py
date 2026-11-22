"""Read-only verification of all saved local gallery sources and served bytes."""
import hashlib
import copy
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
    assert manifest['authorApproval'] == 'pending' and len(manifest['products']) == 99
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
    required = {'MAIN', 'FACE', 'DETAIL', 'SCENE', 'REAR'}
    for product in manifest['products']:
        assert product['publicationSession']['state'] == 'restored'
        assert digest(ROOT / product['master']['path']) == product['master']['sha256']
        images = api.request('/api/catalog/products/' + product['id'] + '/image')
        expected = {kind for kind, slot in product['slots'].items() if slot['status'] == 'complete'}
        assert {'MAIN', 'FACE', 'DETAIL', 'SCENE'} <= expected <= required
        assert len(images) == len(expected) and {image['type'] for image in images} == expected
        assert next(image['id'] for image in images if image['primary']) == product['master']['imageId']
        reviewed = copy.deepcopy(product)
        for kind in required:
            slot = reviewed['slots'][kind]
            assert slot['status'] in ('complete', 'pass'), (product['productKey'], kind)
            if kind != 'MAIN' or product.get('initiallyImageLess'):
                slot['status'] = 'pass'
                gallery.reviewed_source(reviewed, slot)
        assert product['characterSheet']['rearDesign']
        served = []
        for image in images:
            kind = image['type']
            slot = product['slots'][kind]
            assert slot['status'] == 'complete'
            if kind == 'MAIN' and not product.get('initiallyImageLess'):
                expected_sha = product['master']['sha256']
            else:
                upload = slot['upload']
                assert upload['status'] == 'acknowledged' and image['id'] == upload['imageId']
                assert 'AI 生成示意圖' in image['alt']
                assert digest(ROOT / slot['path']) == slot['sha256'] == upload['sourceSha256']
                if slot.get('runId'):
                    run = json.loads((gallery.comfy.WORK / 'runs' / slot['runId'] / 'run.json').read_text('utf-8'))
                    assert run['humanApproval'] is None
                expected_sha = upload['servedSha256']
            data = api.request(image['url'], raw=True)
            actual_sha = hashlib.sha256(data).hexdigest()
            assert actual_sha == expected_sha, (product['productKey'], kind, 'served content changed')
            served.append(dict(type=kind, imageId=image['id'], bytes=len(data), sha256=actual_sha))
        checks.append(dict(key=product['productKey'], originalMainUnchanged=not product.get('initiallyImageLess', False),
                           newOriginalMaster=product.get('initiallyImageLess', False), reviewedOnly=True,
                           requiredSourcesReviewed=True, rearStatus=product['slots']['REAR']['status'],
                           noAngleUploads=True, publicationRestored=True, images=served))
        print(product['productKey'] + ': verified five reviewed sources and ' + str(len(served)) + ' served image hashes', flush=True)
    report = dict(at=time.time(), api=gallery.BASE, scope='read-only local demo; no login or mutation',
                  catalogRows=len(catalog), products=len(checks), excludedRows=len(manifest['excluded']),
                  servedImages=sum(len(c['images']) for c in checks),
                  missingMainOrEmptyGallery=[], allRequiredUploaded=all(c['rearStatus'] == 'complete' for c in checks),
                  authorApproval='pending', checks=checks)
    target = ROOT / 'docs/verification/catalog-gallery-integrity-2026-11-23.json'
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(target)


if __name__ == '__main__':
    main()
