"""Explicit review and resumable checkpoints for the user's 2026-11-23 rear policy."""
import argparse
import copy
import importlib.util
import json
import msvcrt
import time
from pathlib import Path

loader = importlib.util.spec_from_file_location('catalog_gallery', Path(__file__).with_name('catalog_gallery.py'))
g = importlib.util.module_from_spec(loader)
loader.loader.exec_module(g)
POLICY = 'rear-2026-11-23'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['reassess', 'adopt-built-in', 'regenerate', 'checkpoint'])
    parser.add_argument('--file', type=Path)
    parser.add_argument('--keys', nargs='+', default=[])
    parser.add_argument('--note')
    parser.add_argument('--name')
    a = parser.parse_args()
    m = g.load()
    assert m['rearCompletion20261123']['policy'] == POLICY
    if a.command == 'reassess':
        assert a.file
        for entry in json.loads(a.file.read_text('utf-8')):
            p = next(g.selected(m, [entry['key']]).__iter__())
            old = p['slots']['REAR']
            assert old['status'] == 'reject' and entry['decision'] == 'pass' and entry['note']
            run = json.loads((g.comfy.WORK / 'runs' / old['runId'] / 'run.json').read_text('utf-8'))
            assert run['status'] == 'complete' and g.comfy.sha(g.ROOT / old['path']) == old['sha256'] == run['outputSha256']
            assert run['masterSha256'] == p['master']['sha256']
            p.setdefault('attempts', {}).setdefault('REAR', []).append(copy.deepcopy(old))
            old.update(status='pass', reason=entry['note'], reassessment=dict(policy=POLICY, decision='pass',
                runId=old['runId'], masterSha256=p['master']['sha256'], outputSha256=old['sha256'], at=time.time(),
                note=entry['note'], priorReviewPreserved=True))
    elif a.command == 'adopt-built-in':
        assert a.file
        for entry in json.loads(a.file.read_text('utf-8')):
            p = g.selected(m, [entry['key']])[0]
            old = p['slots']['REAR']
            assert old['status'] in ('reject', 'blank', 'pending') and entry['note']
            source = (g.ROOT / entry['path']).resolve()
            assert source.is_relative_to((g.ROOT / 'work').resolve())
            generation = json.loads((g.ROOT / entry['generation']).read_text('utf-8'))
            assert generation['key'] == p['productKey'] and generation['tool'] == 'built-in imagegen'
            assert g.comfy.sha(g.ROOT / generation['reference']) == p['master']['sha256']
            digest = g.comfy.sha(source)
            p.setdefault('attempts', {}).setdefault('REAR', []).append(copy.deepcopy(old))
            p['slots']['REAR'] = dict(status='pass', path=source.relative_to(g.ROOT).as_posix(), sha256=digest,
                reason=entry['note'], sourceSha256=p['master']['sha256'], generation=generation,
                externalSource=dict(kind='new-reference-rear', decision='pass', reviewPolicy=POLICY,
                    actualReferenceMasterSha256=p['master']['sha256'], reviewedAgainstMasterSha256=p['master']['sha256'],
                    outputSha256=digest, at=time.time(), note=entry['note']))
    elif a.command == 'regenerate':
        assert a.keys and a.note
        config = json.loads(g.CONFIG.read_text('utf-8'))
        for p in g.selected(m, a.keys):
            old = p['slots']['REAR']
            assert old['status'] in ('reject', 'blank'), 'Review pending outputs before replacing them'
            p.setdefault('attempts', {}).setdefault('REAR', []).append(copy.deepcopy(old))
            shot = config[p['productKey']]['shots']['rear']
            shot['seed'] += 200000
            shot['prompt'] = ('Camera behind the SAME miniature, 150–180 degree rear view. Show BACK of head/torso and rear of original base; no front eyes/chest, no mirroring. Keep silhouette, proportions, main palette, hair/head, anatomical accessory sides, base shape/color. Fixed hidden design: ' + p['characterSheet']['rearDesign'] + ' Correction: ' + a.note + ' Complete figure/base with safe margins, warm off-white studio. No text or watermark.')
            p['slots']['REAR'] = dict(status='pending', reason=a.note)
        g.comfy.write(g.CONFIG, config)
    else:
        assert a.keys and a.name
        for p in g.selected(m, a.keys):
            assert p['slots']['REAR']['status'] == 'complete' and p['publicationSession']['state'] == 'restored'
        batches = m['rearCompletion20261123']['batches']
        assert not any(b['name'] == a.name for b in batches)
        batches.append(dict(name=a.name, keys=a.keys, at=time.time(), authorApproval='pending'))
    g.save(m)
    print(a.command, 'saved; complete REAR', sum(p['slots']['REAR']['status'] == 'complete' for p in m['products']))


if __name__ == '__main__':
    with (g.WORK / 'command.lock').open('a+b') as lock:
        lock.seek(0); lock.write(b'0'); lock.flush(); lock.seek(0)
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        try: main()
        finally:
            lock.seek(0); msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
