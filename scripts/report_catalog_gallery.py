"""Write the local 2D catalog review report from the saved manifest; never approves images."""
import argparse
import json
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TYPES = ['MAIN', 'ANGLE', 'REAR', 'FACE', 'DETAIL', 'SCENE']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--final', action='store_true')
    args = parser.parse_args()
    folder = ROOT / 'docs/verification'
    manifest = json.loads((folder / 'catalog-gallery-manifest.json').read_text('utf-8'))
    environment = json.loads((folder / 'comfyui-environment-2026-11-20.json').read_text('utf-8'))
    products = manifest['products']
    counts = {kind: dict(Counter(p['slots'][kind]['status'] for p in products)) for kind in TYPES}
    if args.final:
        assert len(products) == 95 and manifest['authorApproval'] == 'pending'
        assert all(s['status'] in ('complete', 'reject', 'blank') for p in products for s in p['slots'].values())
        assert sum(len(b['keys']) for b in manifest['batches']) == 95
        assert all(p['publicationSession']['state'] == 'restored' for p in products)
    browser_path = folder / 'catalog-gallery-browser-2026-11-20.json'
    browser = json.loads(browser_path.read_text('utf-8')) if browser_path.exists() else None
    if args.final:
        assert browser and browser['products'] == 95 and len(browser['checks']) == 190
    finished = manifest.get('processedAt', time.time())
    tz = timezone(timedelta(hours=8))
    stamp = lambda value: datetime.fromtimestamp(value, tz).isoformat(timespec='seconds')
    elapsed = finished - manifest['startedAt']
    new_uploads = sum(s.get('upload', {}).get('status') == 'acknowledged' for p in products for s in p['slots'].values())
    labels = {'complete': '完成', 'reject': '退回／留空', 'blank': '留空（未產候選）', 'pending': '待處理', 'review_pending': '待檢查', 'pass': '待上傳'}
    lines = ['# Figura 本機全目錄 2D 圖組處理結果', '',
             'AI 生成示意圖；非實物攝影，非可操作 3D。作者人工簽核 **pending**；未合併、未正式部署。', '',
             f"本機 API 99 筆中納入 {len(products)} 件虛構商品，排除 {len(manifest['excluded'])} 件合成串接資料。新增並讀回 {new_uploads} 張本機圖庫圖片，95 張原 MAIN 保留。**側／背未補滿，不宣稱每款已有六張。**", '',
             '| 圖位 | 狀態計數 |', '|---|---|']
    for kind in TYPES:
        lines.append(f"| {kind} | " + '；'.join(f'{labels.get(status, status)} {number}' for status, number in counts[kind].items()) + ' |')
    lines += ['', '36 款側／背各經兩次候選檢查，仍因姿態、左右配件、造型或底座漂移退回。另有三款官方 Base 側視試驗全數退回。依此停止擴大無效的新角度生成，59 款未再產側／背候選，明確記為未嘗試留空；沒有把流程限制寫成這些商品已實測失敗。空位仍需後續有效方法。', '',
              '[六圖位比較頁](../catalog-gallery-comparison.html) · [完整 manifest／每槽原因與 SHA](catalog-gallery-manifest.json) · [續跑流程](../CATALOG_GALLERY_RUNBOOK.md)', '',
              '本機商品頁：<http://127.0.0.1:15181/shop>。比較頁圖片引用忽略的 work/，clone 不含原圖。', '',
              '## 逐件圖位', '', '| 商品 | MAIN | ANGLE | REAR | FACE | DETAIL | SCENE | 側／背留空原因 |', '|---|---|---|---|---|---|---|---|']
    for product in products:
        reasons = []
        for kind in ['ANGLE', 'REAR']:
            reason = product['slots'][kind].get('reason', '')
            if reason not in reasons:
                reasons.append(reason)
        title = (product['productKey'] + ' ' + product['title']).replace('|', '\\|')
        values = [labels.get(product['slots'][kind]['status'], product['slots'][kind]['status']) for kind in TYPES]
        lines.append('| ' + ' | '.join([title] + values + ['／'.join(reasons).replace('|', '\\|').replace('\n', ' ')]) + ' |')
    lines += ['', '## 排除資料', '']
    for product in manifest['excluded']:
        lines.append(f"- `{product['id']}` {product['title']}：{product['reason']}；證據：{product['evidence']}。")
    lines += ['', '## 新增模型與套件', '', '無新增 Python 套件／custom node。兩個模型均在下載前確認官方商用授權、可用空間，採固定 revision 與獨立檔名，未覆寫舊模型或使用者 workflow。', '']
    for item in environment['newItems']:
        lines += [f"- **{item['name']}**：{item['license']}；{item['bytes']:,} bytes；revision `{item['version']}`。",
                  f"  來源：[{item['officialRepository']}]({item['source']})；[授權]({item['licenseSource']})。用途：{item['purpose']}。",
                  f"  SHA-256：`{item['sha256']}`。"]
    lines += ['', '[完整環境紀錄、授權全文及重啟前後狀態](comfyui-environment-2026-11-20.json)。', '',
              '## 驗證、錯誤與資源', '',
              '- JDK21 重打包本機圖庫 API：Maven 324 tests，46 pass／278 opt-in skip，0 failure/error；未把 skip 當通過。初次外連 Maven 下載等待過久，改用既有依賴的本機可寫離線快取完成。',
              '- Python 原 runner 5 checks、新圖庫 gate／恢復 5 checks 通過；Web production build 通過。',
              '- Windows 暫時檔案鎖增加原子替換重試。005 上傳前保存失敗後過早復刊導致 UUID 版本過期；核對無提交 audit 後保存舊請求並重建正確版本，未重複新增。未知 ACK 現在維持同一草稿版本，續跑同 UUID。',
              '- JPEG 的 Pillow／PyAV 解碼色差曾造成特寫驗證誤報；改用與 ComfyUI 相同的 PyAV RGB 解碼，驗證直接裁切且無放大。002／013／040 臉部重裁；005／027／047 情境遮罩退回修復，失敗嘗試均保存。',
              '- 瀏覽器快速切圖曾停留於舊 responsive image，已用 image.id key 修復並驗證 currentSrc／解碼成功。受限 Windows 帳戶的 Chrome sandbox GPU 子程序啟動被拒，唯讀驗證改用專用 headless profile；沒有改產品安全設定。',
              '- GPU 文字編碼效能試驗在約 11,153 MiB 顯存使用量下停滯，中止未返回，已受控重啟此 ComfyUI 一次並恢復原 CPU 編碼；佇列中確認未執行的商品工作保存舊／新 prompt ID 後恢復。未終止其他 GPU 程式。沒有推論 OOM 回報；此數字是觀測樣本，不是連續監測峰值。',
              '- RTX 3080 Ti 12GB：正式候選採 Klein 4B FP8／768²／4 steps／batch1，Qwen CPU；額外 Base 試驗採20 steps／CFG5，非錯用 distilled 設定。情境與特寫均為 2D 原像素操作。', '',
              f"記錄起點 {stamp(manifest['startedAt'])}，本輪處理記錄終點 {stamp(finished)}，牆鐘經過 {elapsed / 3600:.2f} 小時（包含使用額度中斷等待、產圖、檢查、修復與保存；不是純 GPU 運算時間，起點前 API 準備時間亦不在此計時內）。", '']
    if browser:
        lines += [f"[本機桌面／手機瀏覽器證據](catalog-gallery-browser-2026-11-20.json)：{browser['products']} 件、{len(browser['checks'])} 組檢查；原主圖、實際圖庫數量、所有圖切換／解碼、AI 標示、放大焦點和無水平溢出。", '']
    lines += ['## Git 保存限制', '', '每批約十件已本機 commit，分支為 `codex/comfyui-product-gallery`，未合併 main、未 force push。Git HTTPS 缺少可用憑證；GitHub 寫入工具回覆「requires approval, but approval policy is never」，因此 push／PR 更新未完成。既有 [PR #22](https://github.com/jackteng-dev/figura-web/pull/22) 尚未包含這些本機後續提交。', '']
    target = folder / 'catalog-gallery-report-2026-11-20.md'
    target.write_text('\n'.join(lines), encoding='utf-8')
    print(target)


if __name__ == '__main__':
    main()
