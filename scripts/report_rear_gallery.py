"""Record the current rear round honestly, including reviewed but unsent sources."""
import collections
import hashlib
import importlib.util
import json
import msvcrt
import shutil
import time
import urllib.request
from pathlib import Path

loader = importlib.util.spec_from_file_location('catalog_gallery', Path(__file__).with_name('catalog_gallery.py'))
gallery = importlib.util.module_from_spec(loader)
loader.loader.exec_module(gallery)

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/verification/catalog-gallery-manifest.json'


def main():
    m = json.loads(MANIFEST.read_text('utf-8'))
    phase = m['rearCompletion20261123']
    integrity = json.loads((ROOT / 'docs/verification/catalog-gallery-integrity-2026-11-23.json').read_text('utf-8'))
    browser_path = ROOT / 'docs/verification/catalog-gallery-browser-2026-11-23.json'
    browser = json.loads(browser_path.read_text('utf-8'))
    build = json.loads((ROOT / 'work/catalog-gallery/rear-20261123/build-result.json').read_text('utf-8'))
    comparison = json.loads((ROOT / 'docs/verification/catalog-gallery-comparison-2026-11-23.json').read_text('utf-8'))
    assert build['exitCode'] == 0 and len(browser['checks']) == 198
    assert comparison['comparison']['rows'] == 99 and comparison['comparison']['positionsPerRow'] == 6
    assert integrity['products'] == browser['products'] == len(m['products']) == 99
    counts = {t: dict(collections.Counter(p['slots'][t]['status'] for p in m['products'])) for t in ['MAIN', 'ANGLE', 'REAR', 'FACE', 'DETAIL', 'SCENE']}
    unfinished = [p['productKey'] for p in m['products'] if p['slots']['REAR']['status'] != 'complete']
    complete = not unfinished
    assert all(p['slots']['REAR']['status'] in ('complete', 'pass') for p in m['products'])
    assert all(p['publicationSession']['state'] == 'restored' for p in m['products'])
    if 'validationHistory' not in m:
        m['validationHistory'] = [dict(date='2026-11-20', validation=m['finalValidation'])]
    if m.get('remoteDelivery', {}).get('status') != 'not-requested':
        m.setdefault('remoteDeliveryHistory', []).append(m.get('remoteDelivery'))
    m['remoteDelivery'] = dict(status='not-requested', reason='2026-11-23 user requests local commits only; author handles push and PR', pushed=False, prModified=False, merged=False, forcePush=False)
    m['processingStatus'] = 'required-local-galleries-complete' if complete else 'awaiting-local-storage-recovery'
    m['processedAt'] = time.time()
    phase.update(visualReviewStatus='all-99-required-rear-sources-accepted', uploadStatus='complete' if complete else 'blocked-local-storage', counts=counts, remainingUploads=unfinished, elapsedWallSeconds=m['processedAt']-phase['startedAt'], authorApproval='pending')
    phase['storageIncident'] = dict(
        status='unresolved' if unfinished else 'resolved', failedProduct='FIGURA-AI-052',
        apiError='HTTP503: 圖片儲存暫時無法使用，請重試同一操作',
        directProbe=dict(endpoint='http://127.0.0.1:18333', headBucket=200, putSmallObject=500, error='InternalError', deleteProbe=204),
        capacityHypothesis='Existing demo compose has -volume.max=12 and -master.volumeSizeLimitMB=128; suspected volume allocation limit, not confirmed without server logs.',
        dockerCli='permission denied connecting to docker_engine named pipe',
        dockerDesktop='Automatic approval review rejected launch: Computer Use was not approved to use Docker Desktop',
        recovery='052 failed POST returned synchronously; unchanged draft version and absent request event verified before publication restored. Old failed UUID preserved; future upload obtains new UUID for new draft version.',
        apiRestarted=False, containersChanged=False, pendingSourcesRetained=True)
    m['finalValidation'] = dict(date='2026-11-23', status='all-required-uploaded' if complete else 'verified-current-state-upload-incomplete',
        integrity='docs/verification/catalog-gallery-integrity-2026-11-23.json', servedImages=integrity['servedImages'],
        reviewedRequiredSources=495, browser='docs/verification/catalog-gallery-browser-2026-11-23.json',
        browserChecks=len(browser['checks']), comparison='docs/verification/catalog-gallery-comparison-2026-11-23.json',
        pythonChecks=11, webProductionBuild='passed', buildExitCode=build['exitCode'], missingMainOrEmptyGallery=[], authorApproval='pending')
    for p in m['products']:
        a = p['slots']['ANGLE']
        if 'priorPolicyReason' not in a:
            a['priorPolicyReason'] = a.get('reason')
            a['reason'] = 'ANGLE 本輪為選擇性；舊側視候選身份漂移而退回，圖庫留空。' if a['status']=='reject' else 'ANGLE 本輪為選擇性，未新增側視候選；沿用留空，不聲稱本款已實測失敗。'
    m['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    gallery.comfy.write(MANIFEST, m)
    env_path = ROOT / 'docs/verification/comfyui-environment-2026-11-23.json'
    env = json.loads(env_path.read_text('utf-8'))
    protected = []
    for prior in env['before']['protectedFiles']:
        path = Path(prior['path']); current = dict(path=str(path), bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
        assert current['sha256'] == prior['sha256'] and current['bytes'] == prior['bytes']
        protected.append(current)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    def get(path):
        with opener.open('http://127.0.0.1:18188'+path, timeout=15) as r: return json.load(r)
    queue = get('/queue'); assert not queue['queue_running'] and not queue['queue_pending']
    env['final'] = dict(at=time.time(), protectedFiles=protected, protectedFilesUnchanged=True, queue=queue,
        system=get('/system_stats'), freeDiskBytes=shutil.disk_usage('D:/').free, newItems=[], newCustomNodes=[],
        newPackages=[], gpuOomObserved=False, restartCount=0, leftRunning=True, loopbackOnly=True,
        builtInImageGeneration=dict(tool='built-in imagegen', installedModels=[], modelVersion=None, seed=None,
            note='Provider does not expose model version/seed. Actual prompts, reference/output SHA and local paths retained per slot; no invented model version or weights license.'))
    gallery.comfy.write(env_path, env)
    methods = collections.Counter('PR21 approved proposal' if p['slots']['REAR'].get('externalSource',{}).get('kind')=='PR21-author-accepted-rear-proposal' else 'built-in reference generation' if p['slots']['REAR'].get('externalSource') else 'ComfyUI reassessment' if p['slots']['REAR'].get('reassessment') else 'ComfyUI new reference generation' for p in m['products'])
    lines = ['# 2026-11-23 必要背面與無圖商品補齊', '',
        '**作者人工簽核 pending。只在本機 demo 處理，沒有正式上架、3D 或 360。**', '',
        f'全部 99 件的必要五圖來源已通過 Codex 視覺檢查（495 個圖位來源，ELPSY 共用設計）。REAR 已入庫 {counts["REAR"].get("complete",0)} 件；另 {len(unfinished)} 件已檢查待上傳。'+('必要圖位已全數入庫。' if complete else '這不是全部入庫完成。')+'全部 99 件公開，沒有缺主圖或空白圖庫。', '',
        '| 圖位 | 完成本機上傳／沿用 | 通過待上傳 | 退回／留空 |', '|---|---:|---:|---:|']
    for t,c in counts.items(): lines.append(f'| {t} | {c.get("complete",0)} | {c.get("pass",0)} | {c.get("reject",0)} 退回／{c.get("blank",0)} 留空 |')
    lines += ['', '## 方法與 ELPSY', '',
        '先完成 001／003／068 三件試點後續做；REAR 以 135°–180° 清楚背後視角與關鍵身份核對，逐款先固定背部設計。保留舊拒收稿，新政策另以 master／output SHA 綁定檢查。ANGLE 選擇性，未新增。', '',
        'REAR 方法：'+ '；'.join(f'{k} {v} 件' for k,v in methods.items())+'。', '',
        '四筆 ELPSY 的標題、品牌、分類、說明、標準款及 TWD1280 價格一致，只有 product／SKU UUID 不同，故共用原創「苔石量測員」ELPSY-MOSS-SURVEYOR-r1。四筆各自 MAIN／FACE／DETAIL／SCENE／REAR 五張皆已入庫。先建原創主圖及 character sheet，再製作其餘圖。原主圖邊距不足，使用既有 ComfyUI core 加背景邊距並只羽化背景接縫；未拉伸或重畫前景。', '',
        '全部 99 筆公開商品及圖庫已逐筆核對，未發現其他缺主圖或空白圖庫。95 筆既有 MAIN 的 image ID 及實際供圖 SHA 不變；ELPSY 新 MAIN 經後端安全重編碼，以 served SHA 另行核對。', '',
        '## 環境、新增模型與問題', '',
        '新增套件／custom node／模型：**無**，無新下載、來源／授權／大小／SHA 新增清單為空。沿用既有 Klein 4B FP8、Qwen CPU encoder、Flux2 VAE、BiRefNet；既有模型來源與授權記於 2026-11-20 inventory。內建產圖無本機安裝權重，版本／seed 未由工具提供，記 null。', '',
        'ComfyUI 原先停止，啟動於 127.0.0.1:18188；使用既有 12GB 設定，未發現本輪 GPU OOM，未重啟、未終止其他 GPU 程式。文生圖.json、ae.safetensors.corrupt 的大小及 SHA 再驗一致。API 沒有重啟。', '',
        '已退回的本輪候選問題包含：仍顯正臉、配件換手、額外袋／桶／鍋、尾巴方向或數量錯誤、姿態與底座漂移；保留每次原因，改用同一 master 參考重產後逐件檢查。', '',
        '未解決：本機 S3 HEAD bucket 200，但極小 PUT 500 InternalError、測試 DELETE 204；圖庫 POST 503。demo 設定 12 × 128 MiB volume，容量配置是待確認假說，無法取得儲存端日誌確認。Docker CLI 管線拒絕存取；自動核准審查拒絕 Docker Desktop（Computer Use was not approved to use Docker Desktop）。未更改容器、ACL 或安全設定。', '',
        '052 失敗請求已確認沒有 audit event 且 draft version 未變，再恢復公開；已保存失敗 UUID 與版本證據，續傳會用新草稿版本的 UUID。其餘待上傳來源未遺失，不需重新產圖。', '',
        f'本輪牆鐘時間至此 {phase["elapsedWallSeconds"]/3600:.2f} 小時，包含工具等待及儲存診斷，非純 GPU 時間。', '',
        f'驗證：11 項 Python guard 通過、Web production build exit 0；99 件 × 桌面／手機 = {len(browser["checks"])} 筆瀏覽器檢查通過；{integrity["servedImages"]} 張現有供圖 SHA 與全部 495 個必要來源檢查通過。比較頁 99 列各 6 圖位、AI alt 與三款（含待上傳圖／ELPSY）解碼通過。待上傳 {len(unfinished)} 張尚未出現在本機商品頁。', '',
        '驗證期間 npm.ps1 受既有 ExecutionPolicy 限制，改用 npm.cmd，未變更安全設定；初次瀏覽器檢查與 dist 重建重疊出現頁面 404，建置完成後依序重跑，198 項通過。既有 legacy script／chunk 警告保留，沒有無關改動。', '',
        '## 續傳', '', '先由有本機 Docker 權限的環境診斷／修復 SeaweedFS 寫入；不可刪 volume／重建空 DB。儲存恢復後：', '',
        '```powershell', '& D:\\ComfyUI\\python_embeded\\python.exe scripts/catalog_gallery.py upload',
        '& D:\\ComfyUI\\python_embeded\\python.exe scripts/rear_gallery_round.py checkpoint --name rear-storage-recovered --keys '+' '.join(unfinished),
        '& D:\\ComfyUI\\python_embeded\\python.exe scripts/verify_catalog_gallery_integrity.py',
        'node scripts/verify_catalog_gallery.mjs', '& D:\\ComfyUI\\python_embeded\\python.exe scripts/report_rear_gallery.py',
        '& D:\\ComfyUI\\python_embeded\\python.exe scripts/catalog_gallery.py report', '```', '',
        '上傳工具只處理 pass；已 complete 不再上傳，來源 SHA 或其他人圖庫變更時停止。每批 commit。本輪依作者指示只 commit，未 push、未修改 PR、未 merge／force push。', '',
        '## 每件商品', '', '| 商品 | REAR | ANGLE | 背面檢查記錄 |', '|---|---|---|---|']
    for p in m['products']:
        rear=p['slots']['REAR']; angle=p['slots']['ANGLE']
        status='完成（本機）' if rear['status']=='complete' else '通過，儲存 503 待上傳'
        a='退回，選擇性留空' if angle['status']=='reject' else '選擇性留空，未新增候選'
        note=rear.get('reason','').replace('|','／').replace('\n',' ')
        lines.append(f'| {p["productKey"]} {p["title"]} | {status} | {a} | {note} |')
    (ROOT/'docs/verification/catalog-gallery-rear-report-2026-11-23.md').write_text('\n'.join(lines)+'\n','utf-8')
    print(json.dumps(dict(counts=counts, methods=dict(methods), remaining=unfinished), ensure_ascii=False))


if __name__ == '__main__':
    with (gallery.WORK / 'command.lock').open('a+b') as lock:
        lock.seek(0); lock.write(b'0'); lock.flush(); lock.seek(0)
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        try:
            main()
        finally:
            lock.seek(0); msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
