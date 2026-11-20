"""Local-only, resumable Figura ComfyUI runner. No catalog/database writes.

API-format workflows can also be dropped into ComfyUI. Raw runs stay in work/.
Run `python scripts/comfyui_figura.py --help` for the command line interface.
"""
import argparse
import hashlib
import importlib.util
import json
import os
import re
import tempfile
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/comfyui-figura'
CONFIG = ROOT / 'workflows/figura/samples.json'
_MODEL_HASH_CACHE = {}


def model_sha(path):
    """Hash large weights once per process, invalidating on file identity/stat changes."""
    path = Path(path).resolve()
    stat = path.stat()
    key = (str(path), stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)
    if key not in _MODEL_HASH_CACHE:
        _MODEL_HASH_CACHE[key] = sha(path)
    return _MODEL_HASH_CACHE[key]


def sha(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def write(path, data):
    # Atomic state saves; output images themselves are never overwritten.
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    # Windows scanners/editors may briefly open the destination without delete
    # sharing. Keep the complete temporary and retry atomic replacement only.
    for attempt in range(20):
        try:
            temp.replace(path)
            return
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(min(.1 * (attempt + 1), 1))


def commit_output(target, data):
    """Publish complete bytes without ever replacing an existing artifact."""
    if target.exists():
        if hashlib.sha256(data).hexdigest() != sha(target):
            raise ValueError('Refusing to overwrite saved output')
        return
    with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.output-', suffix='.tmp', delete=False) as f:
        temporary = Path(f.name)
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    try:
        # Hard-link creation is atomic and fails if the destination already exists,
        # unlike replace(). The temporary is on the same filesystem (NTFS/ext4).
        try:
            os.link(temporary, target)
        except FileExistsError:
            if sha(target) != hashlib.sha256(data).hexdigest():
                raise ValueError('Refusing to overwrite saved output')
    finally:
        temporary.unlink()


class Client:
    def __init__(self, url):
        p = urllib.parse.urlsplit(url)
        if p.scheme != 'http' or p.hostname != '127.0.0.1' or not p.port or p.path not in ('', '/') or p.query or p.fragment or p.username:
            raise ValueError('Use an explicit http://127.0.0.1:PORT loopback API')
        self.url = url.rstrip('/')
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(self, path, data=None, headers=None, raw=False):
        if isinstance(data, dict):
            data = json.dumps(data).encode()
            headers = {'Content-Type': 'application/json'}
        req = urllib.request.Request(self.url + path, data=data, headers=headers or {})
        with self.opener.open(req, timeout=60) as response:
            content = response.read()
            return content if raw else json.loads(content)

    def upload(self, source):
        boundary = uuid.uuid4().hex
        name = 'figura-' + sha(source) + '.png'
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n'.encode()
                + source.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
        r = self.request('/upload/image', body, {'Content-Type': f'multipart/form-data; boundary={boundary}'})
        return '/'.join(filter(None, [r.get('subfolder'), r['name']]))


def build(spec, shot, uploaded):
    mode = shot['mode']
    graph = json.loads((ROOT / f'workflows/figura/{mode}.api.json').read_text('utf-8'))
    graph['1']['inputs']['image'] = uploaded
    x, y, w, h = spec['masterCrop']
    graph['2']['inputs'].update(x=x, y=y, width=w, height=h)
    if mode == 'crop':
        x, y, w, h = shot['crop']
        if min(x, y) < 0 or min(w, h) <= 0 or x + w > spec['masterCrop'][2] or y + h > spec['masterCrop'][3]:
            raise ValueError('Crop outside approved master')
        size = shot['size']
        if size > min(w, h) or w != h:
            raise ValueError('No upscaling or stretched detail crops')
        graph['3']['inputs'].update(x=x, y=y, width=w, height=h)
        graph['4']['inputs'].update(width=size, height=size)
    elif mode == 'scene-composite':
        background = ROOT / shot['background']
        if sha(background) != shot['backgroundSha256']:
            raise ValueError('Scene background changed')
        graph['5']['inputs']['image'] = shot['uploadedBackground']
        graph['6']['inputs'].update(width=w, height=h)
        graph['9']['inputs'].update(width=w, height=round(h*.25))
        graph['10']['inputs']['y'] = round(h*.75)
        graph['3']['inputs']['bg_removal_name'] = shot['maskModel']
    else:
        graph['7']['inputs']['text'] = spec['invariants'] + ' ' + shot['prompt']
        graph['12']['inputs']['noise_seed'] = shot['seed']
        graph['10']['inputs'].update(width=shot['size'], height=shot['size'])
        graph['13']['inputs'].update(width=shot['size'], height=shot['size'])
    return graph


def run(client, product, shot_name, timeout, config=CONFIG):
    spec = json.loads(Path(config).read_text('utf-8'))[product]
    for value in [product, shot_name, spec['designRevision']]:
        if not re.fullmatch('[A-Za-z0-9_-]{1,80}', value):
            raise ValueError('Product, revision and shot must be safe identifiers')
    shot = spec['shots'][shot_name]
    source = ROOT / spec['master']
    if sha(source) != spec['masterSha256']:
        raise ValueError('Master reference changed; create a new explicit design revision')
    # Graph, source and revision all participate in the immutable run identity.
    graph = build(spec, shot, 'REFERENCE.png')
    models = {}
    if shot['mode'] != 'crop':
        inventory = json.loads((WORK / 'inventory.json').read_text('utf-8'))
        expected_models = {node['inputs'][key] for node in graph.values() for key in ['unet_name', 'clip_name', 'vae_name', 'bg_removal_name'] if key in node['inputs']}
        for item in inventory['models']:
            if Path(item['file']).name in expected_models:
                actual = model_sha(Path(inventory['comfyRoot']) / item['file'])
                if actual != item['sha256']:
                    raise ValueError('Model changed since inventory; refresh inventory and use a new design revision')
                models[item['file']] = actual
        if len(models) != len(expected_models):
            raise ValueError('Inventory does not contain all required local model files')
    identity = {'productKey': product, 'designRevision': spec['designRevision'], 'masterSha256': sha(source), 'graph': graph}
    run_id = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    folder = WORK / 'runs' / run_id
    folder.parent.mkdir(parents=True, exist_ok=True)
    state_path = folder / 'run.json'
    if folder.exists():
        state = json.loads(state_path.read_text('utf-8'))
        if state.get('modelHashes') != models:
            raise ValueError('Model provenance changed for this run; use a new design revision')
        if state.get('status') == 'complete':
            if sha(folder / 'output.png') != state['outputSha256']:
                raise ValueError('Saved output was modified')
            print(f'{product} {shot_name}: reused {run_id}', flush=True)
            return
        if not state.get('promptId'):
            raise RuntimeError(f'Uncertain submission: inspect ComfyUI history by figuraRunId={run_id}; do not resubmit blindly')
    else:
        folder.mkdir()
        state = {**identity, 'modelHashes': models, 'runId': run_id, 'shot': shot_name, 'mode': shot['mode'], 'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'review': None, 'humanApproval': None}
        write(state_path, state)
        # Save full execution environment before enqueueing; failures are resumable.
        write(folder / 'system.json', client.request('/system_stats'))
        graph['1']['inputs']['image'] = client.upload(source)
        if shot['mode'] == 'scene-composite':
            graph['5']['inputs']['image'] = client.upload(ROOT / shot['background'])
        graph['20']['inputs']['filename_prefix'] = 'figura/' + run_id
        write(folder / 'workflow.api.json', graph)
        state['status'] = 'submission_unknown'
        write(state_path, state)
        reply = client.request('/prompt', {'prompt': graph, 'client_id': run_id, 'extra_data': {'figuraRunId': run_id}})
        state.update(promptId=reply['prompt_id'], status='queued')
        write(state_path, state)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        history = client.request('/history/' + state['promptId'])
        if state['promptId'] in history:
            result = history[state['promptId']]
            write(folder / 'history.json', result)
            if result.get('status', {}).get('status_str') == 'error':
                state['status'] = 'failed'
                write(state_path, state)
                raise RuntimeError(f'ComfyUI failed; see {folder}/history.json')
            outputs = result.get('outputs', {}).get('20', {}).get('images', [])
            if outputs:
                image = outputs[0]
                data = client.request('/view?' + urllib.parse.urlencode(image), raw=True)
                target = folder / 'output.png'
                commit_output(target, data)
                state.update(status='complete', outputSha256=sha(target))
                write(state_path, state)
                print(f'{product} {shot_name}: complete {run_id}', flush=True)
                return
        time.sleep(2)
    raise TimeoutError('Job still queued/running; rerun the same command to poll its prompt ID')


def encoder_module():
    loader = importlib.util.spec_from_file_location('figure_encoder', ROOT / 'scripts/prepare-figure-samples.py')
    encoder = importlib.util.module_from_spec(loader)
    loader.loader.exec_module(encoder)
    return encoder


def export(run_id, dest):
    if not re.fullmatch('[0-9a-f]{64}', run_id):
        raise ValueError('Invalid run ID')
    folder = WORK / 'runs' / run_id
    state = json.loads((folder / 'run.json').read_text('utf-8'))
    for key in ['productKey', 'designRevision', 'shot']:
        if not re.fullmatch('[A-Za-z0-9_-]{1,80}', state[key]):
            raise ValueError('Unsafe output identifier')
    if state['status'] != 'complete' or not state.get('review') or state['review']['decision'] != 'pass':
        raise ValueError('Visual review must pass before local sample export')
    if sha(folder / 'output.png') != state['outputSha256']:
        raise ValueError('Output hash mismatch')
    # Build a complete export beside its final path, then publish the directory.
    # Failed staging folders are private scratch; retries use fresh staging names.
    dest = Path(dest).resolve() / state['productKey'].lower() / state['designRevision'] / state['shot'] / run_id[:12]
    if dest.exists():
        raise FileExistsError('Refusing to overwrite an exported revision')
    dest.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.figura-export-', dir=dest.parent))
    write(staging / 'workflow.api.json', json.loads((folder / 'workflow.api.json').read_text('utf-8')))
    state['workflowSha256'] = sha(staging / 'workflow.api.json')
    encoder = encoder_module()
    dim = encoder.dimensions(folder / 'output.png')
    sizes = sorted(set([min(320, dim['width']), min(640, dim['width']), dim['width']]))
    state['derivatives'] = []
    for size in sizes:
        for fmt in ['jpg', 'webp', 'avif']:
            state['derivatives'].append(encoder.encode(folder / 'output.png', staging / f'{size}.{fmt}', None, size, size, fmt))
    state.pop('graph')
    write(staging / 'manifest.json', state)
    if dest.exists():
        raise FileExistsError('Another export completed; existing revision preserved')
    staging.rename(dest)
    print(dest)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:18188')
    parser.add_argument('--config', type=Path, default=CONFIG)
    sub = parser.add_subparsers(dest='command', required=True)
    inv = sub.add_parser('inventory')
    inv.add_argument('--comfy-root', required=True, type=Path, help='Verified portable ComfyUI source directory')
    gen = sub.add_parser('run')
    gen.add_argument('product')
    gen.add_argument('shot')
    gen.add_argument('--timeout', type=int, default=900)
    review = sub.add_parser('review')
    review.add_argument('run_id')
    review.add_argument('decision', choices=['pass', 'reject'])
    review.add_argument('--reviewer', required=True)
    review.add_argument('--note', required=True)
    signoff = sub.add_parser('signoff', help='For the author to record a real human acceptance; never automatic')
    signoff.add_argument('run_id')
    signoff.add_argument('--reviewer', required=True)
    signoff.add_argument('--note', required=True)
    out = sub.add_parser('export')
    out.add_argument('run_id')
    out.add_argument('--destination', required=True)
    args = parser.parse_args()
    if args.command == 'inventory':
        client = Client(args.url)
        WORK.mkdir(parents=True, exist_ok=True)
        report = {'comfyRoot': str(args.comfy_root.resolve()), 'system': client.request('/system_stats'), 'queue': client.request('/queue'), 'models': [], 'nodes': list(client.request('/object_info')), 'customNodes': [], 'workflows': []}
        for p in (args.comfy_root / 'models').rglob('*.safetensors'):
            if p.stat().st_size > 1_000_000:
                report['models'].append({'file': p.relative_to(args.comfy_root).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)})
        report['customNodes'] = [p.name for p in (args.comfy_root / 'custom_nodes').iterdir() if p.is_dir() and p.name != '__pycache__']
        report['workflows'] = [p.relative_to(args.comfy_root).as_posix() for p in (args.comfy_root / 'user/default/workflows').glob('*.json')]
        write(WORK / 'inventory.json', report)
        print(WORK / 'inventory.json')
    elif args.command == 'run':
        run(Client(args.url), args.product, args.shot, args.timeout, args.config)
    elif args.command in ('review', 'signoff'):
        if not re.fullmatch('[0-9a-f]{64}', args.run_id):
            raise ValueError('Invalid run ID')
        p = WORK / 'runs' / args.run_id / 'run.json'
        state = json.loads(p.read_text('utf-8'))
        if args.command == 'signoff':
            if state['status'] != 'complete' or state.get('humanApproval') or not state.get('review') or state['review']['decision'] != 'pass':
                raise ValueError('Only a passed, unsigned run can receive author acceptance')
            state['humanApproval'] = {'reviewer': args.reviewer, 'note': args.note}
            write(p, state)
            return
        if state['status'] != 'complete' or state.get('review'):
            raise ValueError('Only unreviewed completed runs can be reviewed; existing decisions are immutable')
        state['review'] = {'decision': args.decision, 'reviewer': args.reviewer, 'note': args.note}
        write(p, state)
    else:
        export(args.run_id, args.destination)


if __name__ == '__main__':
    main()
