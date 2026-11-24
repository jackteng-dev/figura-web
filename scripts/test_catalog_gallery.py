"""Offline checks for local-only requests and the reviewed-source upload gate."""
import hashlib
import importlib.util
import json
import tempfile
import copy
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
                product['slots'] = {'REAR': slot}
                slot['reassessment'] = dict(policy='rear-2026-11-23', decision='pass', runId=run_id,
                                            masterSha256='master', outputSha256=digest)
                self.assertEqual(gallery.reviewed_source(product, slot), source)
                product['slots'] = {'FACE': slot}
                with self.assertRaises(ValueError): gallery.reviewed_source(product, slot)
                slot.pop('reassessment')
                state['review']['decision'] = 'pass'
                state['masterSha256'] = 'other master'
                save()
                with self.assertRaises(ValueError): gallery.reviewed_source(product, slot)
                state['masterSha256'] = 'master'
                save()
                source.write_bytes(b'modified after review')
                with self.assertRaises(ValueError): gallery.reviewed_source(product, slot)

    def test_external_rear_is_bound_to_reference_bytes_and_slot(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); (root / 'work').mkdir()
            source = root / 'work/rear.png'; source.write_bytes(b'generated rear')
            digest = gallery.comfy.sha(source)
            proof = dict(kind='new-reference-rear', decision='pass', reviewPolicy='rear-2026-11-23',
                         actualReferenceMasterSha256='master', reviewedAgainstMasterSha256='master', outputSha256=digest)
            slot = dict(status='pass', path='work/rear.png', sha256=digest, externalSource=proof)
            product = dict(productKey='fixture', master={'sha256': 'master'}, slots={'REAR': slot})
            with patch.object(gallery, 'ROOT', root):
                self.assertEqual(gallery.reviewed_source(product, slot), source)
                product['slots'] = {'FACE': slot}
                with self.assertRaises(ValueError): gallery.reviewed_source(product, slot)
                product['slots'] = {'REAR': slot}; proof['actualReferenceMasterSha256'] = 'other'
                with self.assertRaises(ValueError): gallery.reviewed_source(product, slot)
                proof['actualReferenceMasterSha256'] = 'master'; source.write_bytes(b'changed')
                with self.assertRaises(ValueError): gallery.reviewed_source(product, slot)

    def test_unknown_upload_keeps_draft_and_reuses_uuid_on_resume(self):
        for committed_before_error in [False, True]:
            with self.subTest(committed=committed_before_error), tempfile.TemporaryDirectory() as temp:
                source = Path(temp) / 'reviewed.png'
                source.write_bytes(b'reviewed')
                m = {'products': [{'productKey': 'fixture', 'id': 'product', 'title': 'fixture', 'master': {'imageId': 'main'}, 'slots': {'MAIN': {'status': 'complete'}, 'FACE': {'status': 'pass', 'path': str(source), 'sha256': 'source'}}}]}
                class FakeAPI:
                    actor = 1
                    def __init__(self):
                        self.version = 2
                        self.status = 'PUBLISHED'
                        self.events = []
                        self.images = [{'id': 'main', 'type': 'MAIN', 'primary': True, 'url': '/api/main'}]
                        self.posts = []
                        self.fail = True
                    def login(self): pass
                    def current(self): return copy.deepcopy({'version': self.version, 'status': self.status, 'events': self.events, 'images': self.images})
                    def request(self, path, body=None, method='GET', raw=False, headers=None):
                        if raw: return b'served image'
                        if path.endswith('/publication'):
                            self.assert_version(body['expectedVersion'])
                            self.version += 1
                            self.status = 'PUBLISHED' if body['published'] else 'DRAFT'
                            return self.current()
                        if method == 'POST' and path.endswith('/image'):
                            self.posts.append(body)
                            if not self.events and (not self.fail or committed_before_error):
                                request = m['products'][0]['slots']['FACE']['upload']['request']
                                self.assert_version(request['expectedVersion'])
                                self.version += 1
                                self.events = [{'requestId': request['requestId'], 'imageId': 'new', 'afterVersion': self.version}]
                                self.images.append({'id': 'new', 'type': 'FACE', 'primary': False, 'url': '/api/new'})
                            if self.fail:
                                self.fail = False
                                raise RuntimeError('simulated lost connection')
                            return {'event': self.events[0], 'current': self.current()}
                        if path.startswith('/api/catalog/'): return copy.deepcopy(self.images)
                        return self.current()
                    def assert_version(self, expected):
                        if expected != self.version: raise AssertionError('stale version')
                api = FakeAPI()
                with patch.object(gallery, 'load', return_value=m), patch.object(gallery, 'save'), patch.object(gallery, 'API', return_value=api), patch.object(gallery, 'reviewed_source', return_value=source):
                    with self.assertRaisesRegex(RuntimeError, 'lost connection'):
                        gallery.upload(['fixture'])
                    self.assertEqual(api.status, 'DRAFT')
                    self.assertEqual(m['products'][0]['publicationSession']['state'], 'recovery_pending')
                    request_id = m['products'][0]['slots']['FACE']['upload']['request']['requestId']
                    gallery.upload(['fixture'])
                    self.assertEqual(api.status, 'PUBLISHED')
                    self.assertEqual(len(api.events), 1)
                    self.assertTrue(all(request_id.encode() in body for body in api.posts))
                    # Reconstruct the saved state immediately before republication.
                    api.version = api.events[0]['afterVersion']
                    api.status = 'DRAFT'
                    m['products'][0]['publicationSession']['state'] = 'recovery_pending'
                    posts_before = len(api.posts)
                    gallery.upload(['fixture'])
                    self.assertEqual(api.status, 'PUBLISHED')
                    self.assertEqual(len(api.posts), posts_before)

    def test_atomic_manifest_save_retries_a_temporary_windows_lock(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'manifest.json'
            target.write_text('{"old":true}', encoding='utf-8')
            original = Path.replace
            calls = []
            def locked_once(source, destination):
                calls.append(1)
                if len(calls) == 1: raise PermissionError('temporary reader lock')
                return original(source, destination)
            with patch.object(Path, 'replace', locked_once), patch.object(gallery.comfy.time, 'sleep'):
                gallery.comfy.write(target, {'complete': True})
            self.assertEqual(json.loads(target.read_text('utf-8')), {'complete': True})
            self.assertEqual(len(calls), 2)


if __name__ == '__main__':
    unittest.main()
