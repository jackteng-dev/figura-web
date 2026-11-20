"""Offline checks for local-only requests and the reviewed-source upload gate."""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

loader = importlib.util.spec_from_file_location('catalog_gallery', Path(__file__).with_name('catalog_gallery.py'))
gallery = importlib.util.module_from_spec(loader)
loader.loader.exec_module(gallery)


class GallerySafety(unittest.TestCase):
    def test_rejects_non_api_paths_and_redirects_before_network(self):
        api = gallery.API()
        with patch.object(api.opener, 'open') as network:
            for path in ['https://example.com/api/', '//example.com', '/api/../admin', '/api/https://example.com']:
                with self.assertRaises(ValueError):
                    api.request(path)
            network.assert_not_called()
        with self.assertRaises(ValueError):
            gallery.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.com')

    def test_unknown_product_selection_is_an_error(self):
        with self.assertRaises(ValueError):
            gallery.selected({'products': [{'productKey': 'known'}]}, ['missing'])

    def test_upload_gate_requires_matching_review_reference_and_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            run_id = 'a' * 64
            folder = root / 'work/runs' / run_id
            folder.mkdir(parents=True)
            source = root / 'candidate.png'
            source.write_bytes(b'reviewed candidate bytes')
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            product = {'productKey': 'fixture', 'master': {'sha256': 'master'}}
            slot = {'status': 'pass', 'runId': run_id, 'path': 'candidate.png', 'sha256': digest}
            state = {'status': 'complete', 'productKey': 'fixture', 'masterSha256': 'master', 'outputSha256': digest, 'review': {'decision': 'pass'}}
            def save():
                (folder / 'run.json').write_text(json.dumps(state), encoding='utf-8')
            save()
            with patch.object(gallery, 'ROOT', root), patch.object(gallery.comfy, 'WORK', root / 'work'):
                self.assertEqual(gallery.reviewed_source(product, slot), source)
                state['review']['decision'] = 'reject'
                save()
                with self.assertRaises(ValueError): gallery.reviewed_source(product, slot)
                state['review']['decision'] = 'pass'
                state['masterSha256'] = 'other master'
                save()
                with self.assertRaises(ValueError): gallery.reviewed_source(product, slot)
                state['masterSha256'] = 'master'
                save()
                source.write_bytes(b'modified after review')
                with self.assertRaises(ValueError): gallery.reviewed_source(product, slot)


if __name__ == '__main__':
    unittest.main()
