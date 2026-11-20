"""Guardrails for local generation; no GPU or network needed."""
import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

loader = importlib.util.spec_from_file_location('figura', Path(__file__).with_name('comfyui_figura.py'))
figura = importlib.util.module_from_spec(loader)
loader.loader.exec_module(figura)


class Guardrails(unittest.TestCase):
    def test_output_commit_ignores_partial_temporary_and_preserves_completed_file(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            (folder / '.output-interrupted.tmp').write_bytes(b'partial')
            target = folder / 'output.png'
            figura.commit_output(target, b'complete')
            figura.commit_output(target, b'complete')
            with self.assertRaises(ValueError):
                figura.commit_output(target, b'changed')
            self.assertEqual(target.read_bytes(), b'complete')

    def test_failed_export_can_retry_without_overwriting_final_revision(self):
        previous = figura.WORK
        with tempfile.TemporaryDirectory() as temp:
            figura.WORK = Path(temp)
            run_id = 'a' * 64
            folder = figura.WORK / 'runs' / run_id
            folder.mkdir(parents=True)
            (folder / 'output.png').write_bytes(b'fixture')
            (folder / 'workflow.api.json').write_text('{}', 'utf-8')
            state = {'productKey': 'FIGURA-AI-001', 'designRevision': 'r1', 'shot': 'main', 'graph': {}, 'status': 'complete', 'review': {'decision': 'pass'}, 'outputSha256': figura.sha(folder / 'output.png')}
            (folder / 'run.json').write_text(json.dumps(state), 'utf-8')
            class Encoder:
                @staticmethod
                def dimensions(path): return {'width': 1, 'height': 1}
                @staticmethod
                def encode(source, target, *args):
                    target.write_bytes(b'encoded')
                    return {'file': target.name, 'sha256': figura.sha(target)}
            try:
                destination = Path(temp) / 'export'
                with patch.object(figura, 'encoder_module', side_effect=RuntimeError('encoder interrupted')):
                    with self.assertRaises(RuntimeError): figura.export(run_id, destination)
                final = destination / 'figura-ai-001/r1/main' / run_id[:12]
                self.assertFalse(final.exists())
                with patch.object(figura, 'encoder_module', return_value=Encoder): figura.export(run_id, destination)
                original = (final / 'manifest.json').read_bytes()
                with self.assertRaises(FileExistsError): figura.export(run_id, destination)
                self.assertEqual((final / 'manifest.json').read_bytes(), original)
            finally:
                figura.WORK = previous

    def test_remote_or_ambiguous_api_rejected(self):
        for url in ['https://127.0.0.1:8188', 'http://0.0.0.0:8188', 'http://example.com:8188', 'http://127.0.0.1:8188/proxy', 'http://user@127.0.0.1:8188', 'http://127.0.0.1:8188?url=evil']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                figura.Client(url)

    def test_crop_must_fit_and_never_upscale_or_stretch(self):
        spec = {'masterCrop': [147, 120, 960, 960]}
        for shot in [{'mode': 'crop', 'crop': [900, 0, 400, 400], 'size': 400}, {'mode': 'crop', 'crop': [0, 0, 400, 400], 'size': 1024}, {'mode': 'crop', 'crop': [0, 0, 300, 400], 'size': 300}]:
            with self.subTest(shot=shot), self.assertRaises(ValueError):
                figura.build(spec, shot, 'reference.png')

    def test_export_rejects_unreviewed_run_and_tampered_image(self):
        previous = figura.WORK
        with tempfile.TemporaryDirectory() as temp:
            figura.WORK = Path(temp)
            run_id = 'a' * 64
            folder = figura.WORK / 'runs' / run_id
            folder.mkdir(parents=True)
            state = {'productKey': 'FIGURA-AI-001', 'designRevision': 'r1', 'shot': 'main', 'status': 'complete', 'review': None, 'outputSha256': '0' * 64}
            try:
                (folder / 'run.json').write_text(json.dumps(state), 'utf-8')
                with self.assertRaises(ValueError):
                    figura.export(run_id, Path(temp) / 'export')
                state['review'] = {'decision': 'pass'}
                (folder / 'run.json').write_text(json.dumps(state), 'utf-8')
                (folder / 'output.png').write_bytes(b'tampered')
                with self.assertRaises(ValueError):
                    figura.export(run_id, Path(temp) / 'export')
            finally:
                figura.WORK = previous


if __name__ == '__main__':
    unittest.main()
