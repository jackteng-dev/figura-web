"""Resumable local catalog gallery orchestration; uses comfyui_figura and its workflows.

Generation never implies acceptance. Explicit visual review is required before upload.
All image bytes, credentials and full run logs stay in ignored work/.
"""
import argparse
import hashlib
import importlib.util
import http.cookiejar
import json
import msvcrt
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

_loader = importlib.util.spec_from_file_location('comfyui_figura', Path(__file__).with_name('comfyui_figura.py'))
comfy = importlib.util.module_from_spec(_loader)
_loader.loader.exec_module(comfy)

ROOT = comfy.ROOT
WORK = ROOT / 'work/catalog-gallery'
MANIFEST = ROOT / 'docs/verification/catalog-gallery-manifest.json'
CONFIG = ROOT / 'workflows/figura/catalog.json'
BASE = 'http://127.0.0.1:19092/figura'
TYPES = ['MAIN', 'ANGLE', 'REAR', 'FACE', 'DETAIL', 'SCENE']
SHOTS = {'ANGLE': 'side', 'REAR': 'rear', 'FACE': 'face', 'DETAIL': 'detail', 'SCENE': 'scene'}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirect refused: local-only client')


class API:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.csrf = None

    def request(self, path, body=None, method='GET', raw=False, form=False, headers=None):
        if not path.startswith('/api/') or '://' in path or '..' in path:
            raise ValueError('Local API path required')
        h = dict(headers or {})
        if self.csrf:
            h['X-XSRF-TOKEN'] = self.csrf
        if isinstance(body, dict):
            h['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
            body = urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode()
        with self.opener.open(urllib.request.Request(BASE + path, data=body, method=method, headers=h), timeout=60) as r:
            data = r.read()
        if raw:
            return data
        reply = json.loads(data)
        if reply.get('code') != 0:
            raise RuntimeError('API rejected request: ' + str(reply.get('message')))
        return reply['data']

    def login(self):
        env = {}
        for line in (ROOT.parent / 'figura-api/work/demo.env').read_text('utf-8').splitlines():
            if line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k] = v.strip().strip('\'"')
        assert env['DB_URL'].split('?', 1)[0] == 'jdbc:mysql://127.0.0.1:13306/figura_shop_demo'
        self.csrf = self.request('/api/auth/csrf')['token']
        self.request('/api/admin/login', dict(username='shop_admin', password=env['DEMO_ADMIN_PASSWORD'], deviceId=str(uuid.uuid4())), 'POST', form=True)
        self.csrf = self.request('/api/auth/csrf')['token']
        self.actor = self.request('/api/auth/me')['id']


def load():
    return json.loads(MANIFEST.read_text('utf-8'))


def save(m):
    m['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    comfy.write(MANIFEST, m)


def selected(m, keys):
    return [p for p in m['products'] if not keys or p['productKey'] in keys]


def snapshot():
    if MANIFEST.exists():
        raise FileExistsError('Snapshot already exists; resume it instead of replacing masters')
    WORK.mkdir(parents=True, exist_ok=True)
    api = API()
    products = []
    page = 1
    while True:
        data = api.request(f'/api/catalog/products?page={page}&pageSize=50')
        products.extend(data['items'])
        if len(products) >= data['total']:
            break
        page += 1
        if page > 100:
            raise ValueError('Unexpected catalog size')
    comfy.write(WORK / 'catalog-snapshot.json', products)
    designs = json.loads((ROOT.parent / 'figura-api/work/figura-ai-catalog/designs.json').read_text('utf-8-sig'))
    by_title = {d['title']: d for d in designs}
    m = {'schemaVersion': 1, 'scope': BASE + '/api/catalog/products', 'authorApproval': 'pending', 'startedAt': time.time(), 'products': [], 'excluded': [], 'batches': []}
    config = {}
    for p in products:
        d = by_title.get(p['title'])
        if not d or 'AI 生成' not in p.get('description', ''):
            m['excluded'].append({'id': p['id'], 'title': p['title'], 'reason': '合成驗收／串接測試資料；不屬於原創 AI 虛構商品目錄', 'evidence': p.get('description', '')})
            continue
        key = 'FIGURA-AI-' + d['id']
        if not p['image']:
            raise ValueError('Fictional product missing master: ' + key)
        folder = WORK / key
        folder.mkdir(exist_ok=True)
        master = folder / 'master.png'
        comfy.commit_output(master, api.request(p['image']['url'], raw=True))
        from PIL import Image
        w, h = Image.open(master).size
        if w != h:
            raise ValueError('Non-square master needs explicit crop')
        sheet = {'sourceBrief': d['prompt'], 'material': d['material'], 'visibleInvariants': 'Preserve every visible contour, face, paint boundary, clothing fold, ornament, joint, accessory, fixed pose and the exact base in the attached current catalog master. Anatomical left/right belong to the character, never mirror the image.', 'rearDesign': 'Proposal fixed for this revision: continue visible surfaces, colors and seams around the back; keep visible hair, tail, straps and attachments at their original anatomical positions. Hidden surfaces use the same plain material; add no new pockets, ornaments, props or base features. This is inferred, not observed rear geometry.', 'rearDesignStatus': 'fixed AI proposal; author pending'}
        spec = {'designRevision': 'catalog-r1', 'master': master.relative_to(ROOT).as_posix(), 'masterSha256': comfy.sha(master), 'masterCrop': [0, 0, w, h], 'characterSheet': sheet, 'invariants': sheet['visibleInvariants'] + ' Original design brief (master takes precedence): ' + d['prompt'], 'shots': {}}
        for shot, crop in [('face', [.25, .04, .50, .50]), ('detail', [.20, .40, .56, .56])]:
            c = [round(x*w) for x in crop]
            spec['shots'][shot] = {'mode': 'crop', 'crop': c, 'size': c[2]}
        prompts = {
            'side': 'Change only the camera: show the same fixed collectible in its anatomical RIGHT profile at approximately 90 degrees, looking toward its right side. Preserve all sculpt geometry, fixed pose, colors, accessories and base; no mirrored anatomy. Full figure and base, 8 percent margins, warm off-white studio, crisp miniature paint. No text, logos or watermark.',
            'rear': 'Change only the camera: exact back view at approximately 180 degrees of the same fixed collectible, face turned away. ' + sheet['rearDesign'] + ' Same complete base, pose and scale, 8 percent margins, warm off-white studio, crisp painted miniature. No text, logos or watermark.',
            'scene': 'Keep exactly the reference collectible and original base, fixed pose, sculpt, face, colors, every accessory and anatomical side. Place the single complete miniature on a simple walnut display cabinet shelf, warm key light and subtle cool rim. No other objects or figures, no new included accessories. Complete base and figure, square product image. No text, logos or watermark.'}
        for shot, prompt in prompts.items():
            spec['shots'][shot] = {'mode': 'flux-reference', 'seed': 2026112000 + int(d['id']), 'size': 768, 'prompt': prompt}
        config[key] = spec
        m['products'].append({'productKey': key, 'id': p['id'], 'title': p['title'], 'work': p['work'], 'master': {'path': spec['master'], 'sha256': spec['masterSha256'], 'imageId': p['image']['id'], 'url': p['image']['url'], 'width': w, 'height': h}, 'characterSheet': sheet, 'authorApproval': 'pending', 'slots': {t: {'status': 'complete' if t == 'MAIN' else 'pending', 'reason': '沿用本機現有主圖，不重設角色' if t == 'MAIN' else None} for t in TYPES}})
    m['products'].sort(key=lambda p: p['productKey'])
    comfy.write(CONFIG, config)
    save(m)
    print('Snapshot:', len(m['products']), 'fictional products;', len(m['excluded']), 'excluded')


def generate(keys, types):
    m = load()
    client = comfy.Client('http://127.0.0.1:18188')
    for p in selected(m, keys):
        for t in types:
            if t == 'MAIN' or p['slots'][t]['status'] in ('complete', 'pass', 'reject', 'blank'):
                continue
            shot = SHOTS[t]
            comfy.run(client, p['productKey'], shot, 1800, CONFIG)
            spec = json.loads(CONFIG.read_text('utf-8'))[p['productKey']]
            identity = {'productKey': p['productKey'], 'designRevision': spec['designRevision'], 'masterSha256': spec['masterSha256'], 'graph': comfy.build(spec, spec['shots'][shot], 'REFERENCE.png')}
            run_id = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
            run = json.loads((comfy.WORK / 'runs' / run_id / 'run.json').read_text('utf-8'))
            p['slots'][t].update(status='review_pending', runId=run['runId'], sha256=run['outputSha256'], sourceSha256=p['master']['sha256'], path=f"work/comfyui-figura/runs/{run['runId']}/output.png")
            save(m)


def contact(keys, types):
    from PIL import Image, ImageDraw, ImageFont
    m = load()
    products = selected(m, keys)
    cell = 320
    cols = ['MAIN'] + [t for t in types if t != 'MAIN']
    master_only = cols == ['MAIN']
    canvas = Image.new('RGB', (cell*(5 if master_only else len(cols)), (cell+40)*((len(products)+4)//5 if master_only else len(products))), '#eeeae5')
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 16)
    for row, p in enumerate(products):
        for col, t in enumerate(cols):
            slot = p['slots'][t]
            path = p['master']['path'] if t == 'MAIN' else slot.get('path')
            x, y = (row%5*cell, row//5*(cell+40)) if master_only else (col*cell, row*(cell+40))
            if path:
                im = Image.open(ROOT / path).convert('RGB')
                im.thumbnail((cell, cell))
                canvas.paste(im, (x+(cell-im.width)//2, y+(cell-im.height)//2))
            draw.text((x+5, y+cell), p['productKey'] + ' ' + t + ' ' + slot['status'], font=font, fill='black')
    path = WORK / ('contact-' + '-'.join(keys or ['all']) + '.jpg')
    canvas.save(path, quality=92)
    print(path)


def review(keys, types, decision, note):
    m = load()
    for p in selected(m, keys):
        for t in types:
            slot = p['slots'][t]
            if t == 'MAIN' or slot['status'] != 'review_pending':
                raise ValueError('Only explicitly inspected pending outputs may be reviewed')
            state_path = comfy.WORK / 'runs' / slot['runId'] / 'run.json'
            state = json.loads(state_path.read_text('utf-8'))
            if comfy.sha(ROOT / slot['path']) != slot['sha256']:
                raise ValueError('Output changed')
            state['review'] = {'decision': decision, 'reviewer': 'Codex visual inspection', 'note': note}
            comfy.write(state_path, state)
            slot.update(status='pass' if decision == 'pass' else 'reject', reason=note, reviewedAt=time.time())
    save(m)


def report():
    m = load()
    from html import escape as esc
    rows = []
    for p in m['products']:
        cells = []
        for t in TYPES:
            s = p['slots'][t]
            path = p['master']['path'] if t == 'MAIN' else s.get('path')
            im = f'<img loading="lazy" src="../{esc(path)}" alt="{esc(p["title"])}，AI 生成示意圖，{t}">' if path else '<div class="empty">留空</div>'
            cells.append(f'<figure>{im}<figcaption><b>{t} · {esc(s["status"])}</b><br>{esc(s.get("reason") or "待檢查")}</figcaption></figure>')
        rows.append(f'<article><h2>{esc(p["productKey"])} {esc(p["title"])}</h2><div class="grid">{"".join(cells)}</div></article>')
    html = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Figura 全目錄 2D 圖組比較</title><style>body{font:15px system-ui;margin:24px;background:#f3f1ed;color:#242424}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}figure{margin:0;min-width:0}img,.empty{width:100%;aspect-ratio:1;object-fit:contain;background:#e5e1db}.empty{display:grid;place-items:center}figcaption{font-size:12px;overflow-wrap:anywhere}article{padding:20px 0;border-bottom:1px solid #ccc}@media(max-width:800px){.grid{min-width:1050px}article{overflow:auto}}</style><h1>Figura 全目錄 2D 圖組比較</h1><p>AI 生成示意圖。非實物攝影，非可操作的 3D 模型。作者人工簽核 pending。退回圖僅供檢查，不上傳圖庫。圖片保存在本機忽略的 work/；clone 不包含圖片。</p>' + ''.join(rows) + '</html>'
    (ROOT / 'docs/catalog-gallery-comparison.html').write_text(html, encoding='utf-8')
    print(json.dumps({t: {s: sum(p['slots'][t]['status'] == s for p in m['products']) for s in sorted({p['slots'][t]['status'] for p in m['products']})} for t in TYPES}, ensure_ascii=False))


def upload(keys):
    """Original main stays bound; only passed outputs enter the loopback demo gallery."""
    m = load()
    api = API()
    api.login()
    for p in selected(m, keys):
        targets = [(t, s) for t, s in p['slots'].items() if s['status'] == 'pass']
        if not targets:
            continue
        path = '/api/admin/products/' + p['id']
        current = api.request(path + '/image?gallery=true')
        allowed = {p['master']['imageId']} | {s['upload']['imageId'] for s in p['slots'].values() if s.get('upload', {}).get('imageId')}
        # A prior ambiguous submission may already exist; only its saved UUID can reconcile it.
        pending = [s['upload']['request']['requestId'] for s in p['slots'].values() if s.get('upload', {}).get('status') == 'submission_unknown']
        pending_ids = {e['imageId'] for e in current['events'] if e['requestId'] in pending}
        if {i['id'] for i in current['images']} - allowed - pending_ids:
            raise RuntimeError('Unrecognized gallery edits; preserve and inspect ' + p['productKey'])
        if not p.get('publicationSession'):
            if current['status'] != 'PUBLISHED':
                raise RuntimeError('Product status changed outside this task')
            p['publicationSession'] = {'originalStatus': current['status'], 'beforeVersion': current['version'], 'state': 'unpublish_pending'}
            save(m)
            api.request(path + '/publication', {'expectedVersion': current['version'], 'published': False}, 'PATCH')
            p['publicationSession']['state'] = 'editing'
            save(m)
        elif current['status'] == 'PUBLISHED':
            # Resume after a completed earlier batch, allowing new accepted candidates.
            api.request(path + '/publication', {'expectedVersion': current['version'], 'published': False}, 'PATCH')
            p['publicationSession']['state'] = 'editing'
            save(m)
        try:
            for t, slot in targets:
                source = ROOT / slot['path']
                if comfy.sha(source) != slot['sha256']:
                    raise ValueError('Reviewed output hash mismatch')
                current = api.request(path + '/image?gallery=true')
                if not slot.get('upload'):
                    if any(i['type'] == t for i in current['images']):
                        raise RuntimeError('Existing slot type belongs to another edit')
                    slot['upload'] = {'status': 'submission_unknown', 'request': {'requestId': str(uuid.uuid4()), 'expectedVersion': current['version'], 'expectedActorId': api.actor, 'operation': 'ADD', 'type': t, 'alt': p['title'] + '，AI 生成示意圖，' + t + '；非實物攝影'}, 'sourceSha256': slot['sha256']}
                    save(m)
                state = slot['upload']
                boundary = 'figura-' + uuid.uuid4().hex
                parts = []
                for k, v in state['request'].items():
                    parts.append((f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n').encode())
                parts += [(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="reviewed.png"\r\nContent-Type: image/png\r\n\r\n').encode(), source.read_bytes(), (f'\r\n--{boundary}--\r\n').encode()]
                result = api.request(path + '/image', b''.join(parts), 'POST', headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
                image_id = result['event']['imageId']
                state.update(status='acknowledged', imageId=image_id, version=result['current']['version'])
                slot['status'] = 'complete'
                save(m)
        finally:
            current = api.request(path + '/image?gallery=true')
            if current['status'] == 'DRAFT':
                api.request(path + '/publication', {'expectedVersion': current['version'], 'published': True}, 'PATCH')
            p['publicationSession']['state'] = 'restored'
            public = api.request('/api/catalog/products/' + p['id'] + '/image')
            if next(i['id'] for i in public if i['primary']) != p['master']['imageId']:
                raise RuntimeError('Original main binding changed')
            for t, s in p['slots'].items():
                if s.get('upload', {}).get('status') == 'acknowledged':
                    im = next(i for i in public if i['id'] == s['upload']['imageId'])
                    content = api.request(im['url'], raw=True)
                    s['upload'].update(publicUrl=im['url'], servedSha256=hashlib.sha256(content).hexdigest(), verifiedAt=time.time())
            save(m)
        print(p['productKey'] + ': local gallery verified; original main retained', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['snapshot', 'generate', 'contact', 'review', 'report', 'upload'])
    parser.add_argument('--keys', nargs='*', default=[])
    parser.add_argument('--types', nargs='+', choices=TYPES, default=TYPES)
    parser.add_argument('--decision', choices=['pass', 'reject'])
    parser.add_argument('--note')
    a = parser.parse_args()
    if a.command == 'snapshot': snapshot()
    elif a.command == 'generate': generate(a.keys, a.types)
    elif a.command == 'contact': contact(a.keys, a.types)
    elif a.command == 'review':
        if not a.keys or not a.decision or not a.note: parser.error('Review requires explicit keys, decision and note')
        review(a.keys, a.types, a.decision, a.note)
    elif a.command == 'upload':
        if not a.keys: parser.error('Upload requires explicit reviewed product keys')
        upload(a.keys)
    else: report()


if __name__ == '__main__':
    WORK.mkdir(parents=True, exist_ok=True)
    # Hold an OS lock for the full command: generation and uploads must never
    # overwrite each other's manifest snapshot. Windows releases it after a crash.
    with (WORK / 'command.lock').open('a+b') as lock:
        lock.seek(0)
        lock.write(b'0')
        lock.flush()
        lock.seek(0)
        try:
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            raise SystemExit('Another catalog gallery command is running; wait for it to finish')
        try:
            main()
        finally:
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
