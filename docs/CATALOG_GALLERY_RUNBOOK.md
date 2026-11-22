# 全目錄 2D 商品圖組：本機續跑

**2026-11-23 目前範圍：99 筆全部納入。** 作者要求四筆原先排除的 ELPSY 也補圖；比對資料相同後，共用原創「苔石量測員」設計，各自五種必要圖位已入庫。舊排除原因保存在 `priorExcluded`，目前 `excluded=[]`。唯一目錄來源仍為 `127.0.0.1:19092/figura/api/catalog/products`。不連正式 DB，不建立 3D／360，不改 `src/assets/`；作者簽核 pending。

REAR 必要，以 135°–180° 明確背後視角、關鍵輪廓／配色／頭部／角色自己的配件左右／底座核對，小細節可有差異。逐款先固定 character sheet 背部設計。ANGLE 選擇性，舊拒收與留空維持。先完成 001／003／068 試點後續做全部商品；目前 99 個 REAR 來源均已通過，78 個入庫，21 個待上傳。

**目前續跑阻礙：本機 SeaweedFS 寫入 500，圖庫 POST 503。** 讀取與 HEAD bucket 可用，但極小測試 PUT 也失敗。Docker CLI 管線拒絕存取，開啟 Docker Desktop 又遭自動核准審查拒絕；沒有變更容器或安全設定。需有 Docker 權限的環境先診斷儲存端，不能刪除 volume 或重建資料。052 的失敗操作已核對無 event、原版本未變，再恢復公開；99 商品均公開。詳見 [本輪逐件報告](verification/catalog-gallery-rear-report-2026-11-23.md)。

儲存恢復後執行 `catalog_gallery.py upload`，只上傳 `pass`，不重新生成或重傳 `complete`。再執行 `verify_catalog_gallery_integrity.py`、`node scripts/verify_catalog_gallery.mjs`、`report_rear_gallery.py`、`catalog_gallery.py report`，更新 HANDOFF 並 commit。預覽為 `http://127.0.0.1:15176`。build 與瀏覽器檢查應依序執行，避免 preview 讀到正在重建的 dist。

`rear_gallery_round.py checkpoint-reviewed` 只保存已檢查來源的批次；`checkpoint` 才要求已完成上傳，兩者不可混稱。內建產圖使用同一 master，實際 prompt、reference/output SHA 及本機路徑保存在各槽；seed／model version 未由工具提供，記 null。`reviewed_source` 要求該 REAR 的明確政策與 hash 證據，不能以生成成功自動採用。

以下保留原始 2026-11-20 操作流程；當時 95 納入／4 排除、側背留空的結果已由上述作者新指示取代。這一輪只 commit，作者處理 push／PR。

沿用 [圖片規範](AI_FIGURE_IMAGE_STANDARD.md)、[ComfyUI 流程](COMFYUI_FIGURA_WORKFLOW.md)、`scripts/comfyui_figura.py` 及既有 crop／Flux reference workflows；`catalog_gallery.py` 僅負責目錄快照、分批調度、明確的視覺決定與本機圖庫寫入。沒有以生成成功或相似度分數自動核准候選。

## 狀態與圖庫

- `MAIN`：保留目前本機商品的主圖與 image ID。
- `FACE／DETAIL`：ComfyUI 直接裁切，不放大、不重畫；通過構圖檢查後，另以 ComfyUI 0.27 的 PyAV RGB 解碼逐像素比對。Pillow 對 JPEG 色度上採樣的結果略有不同，不能拿另一個解碼器的像素差誤判為生成漂移。
- `SCENE`：同一 master 經 BiRefNet 遮罩，二值化後以 ComfyUI 合成木質展示台；逐張確認髮絲、透明配件、底座與支架沒有被遮罩刪掉。這是 2D AI 合成示意，不能宣稱實物攝影或物理上精確的透明材質渲染。
- 遮罩若漏掉原底座，可加入已核對原圖邊界的 `protectionMask`，以 core `LoadImageMask → MaskComposite(add)` 保護原像素；不重畫或推測新零件。027 的可重建配方在設定內，`prepare_gallery_protection.py FIGURA-AI-027 --verify` 會重算並核對 SHA，不覆寫既有檔案。
- `ANGLE／REAR`：同一 master latent reference；背部固定提案先保存到 character sheet。身份漂移的候選退回並修正重試；仍無法一致時不上傳，保留原因及每次 run ID。
- `complete` 代表沿用主圖或已寫入並讀回本機圖庫；`pass` 尚待上傳；`review_pending` 尚未判定；`reject` 代表退回、圖庫留空。這些狀態都不等於作者簽核。

圖庫只接受視覺 pass 且 run／master／輸出 hash 一致的候選。上傳使用私有 `figura-api/work/demo.env` 的既有員工帳密，Cookie＋CSRF、actor ID、版本與保存的操作 UUID；未知結果重用原 UUID／檔案核對。每款暫時下架進入草稿，新增圖位後恢復原公開狀態，並核對原主圖 ID 未變及公開讀圖成功。遇到不屬於本輪的圖庫修改會停止，不覆蓋其他工具的成果。

## 續跑

使用 `D:\ComfyUI\python_embeded\python.exe`。開始與每批結束先核對分支 `codex/comfyui-product-gallery` 和 Git status；不要執行第二個會修改 manifest 的指令。OS 檔案鎖會阻止生成與上傳互相覆蓋狀態，程序中斷後鎖自動釋放。

```powershell
# API 已經在 19092 運作時不要重複啟動。
# 需重啟時，先識別該 port 程序，再重新 package；此 launcher 僅接受指定 loopback demo 設定。
& D:\ComfyUI\python_embeded\python.exe scripts/start_local_gallery_api.py

# 開始下一批前，先在 workflows/figura/catalog.json 記錄各款可見不變條件、固定背面提案與特寫 crop。
& D:\ComfyUI\python_embeded\python.exe scripts/catalog_gallery.py generate --keys FIGURA-AI-013 FIGURA-AI-014
& D:\ComfyUI\python_embeded\python.exe scripts/catalog_gallery.py contact --keys FIGURA-AI-013 FIGURA-AI-014

# 實際看圖後才寫入明確決定；不執行 comfyui_figura.py signoff。
& D:\ComfyUI\python_embeded\python.exe scripts/catalog_gallery.py review --keys FIGURA-AI-013 --types FACE --decision pass --note "實際檢查記錄"
& D:\ComfyUI\python_embeded\python.exe scripts/catalog_gallery.py upload --keys FIGURA-AI-013
& D:\ComfyUI\python_embeded\python.exe scripts/catalog_gallery.py report
```

`generate` 會重用已知 run ID／已完成輸出，`complete／pass／reject` 不重產。只有明確 `retry` 才為退回角度改 seed／提示並保留舊嘗試。已知 prompt ID 可恢復 polling；提交結果未知且無 ID 時，仍沿用原 runner 的停止盲重送規則。不要重新 snapshot 或覆寫 master 來假裝續跑。

本輪已在 33 款側／背各兩次及三款額外 Base 側視試驗中確認持續身份漂移，因此停止擴大無效的新角度生成。manifest 的 `angleProductionPolicy` 保存依據；後續尚未生成的 59 款 ANGLE／REAR 明確標記 `blank`、`attempted: false`，理由是目前流程一致性未達標，不冒稱這些商品已有失敗候選。已產生的候選仍逐張退回、重試並保存原因。這些空位需要後續有效方法，不代表每款六張已補滿。

原始 master、輸出 PNG、完整工作流執行紀錄、日誌與比較 contact sheets 均在忽略的 `work/`。Git 只保存 manifest、設定、腳本、文件及 [六圖位比較頁](catalog-gallery-comparison.html)。比較頁需在此本機工作目錄開啟，clone 不包含原始圖片；不能把未提供的 work 檔案說成可從 Git 還原。

本機商品頁預覽：`http://127.0.0.1:15181/shop`，對應指定 19092 demo API。`verify_catalog_gallery.mjs` 對既有商品做唯讀的桌面／手機圖庫檢查，不建立或發布測試商品。實際結果須以 `verification/` 的當輪報告為準。

## 新增模型

[2026-11-20 環境紀錄](verification/comfyui-environment-2026-11-20.json)：新增作者官方 `ZhengPeng7/BiRefNet`（MIT，444,473,596 bytes）及 `black-forest-labs/FLUX.2-klein-base-4b-fp8`（Apache-2.0，4,089,498,488 bytes）。均先核對商用授權／空間，再以固定 revision 下載並核對官方 LFS SHA-256。只使用既有 core 節點，無新 custom node、無覆寫使用者 workflow／模型。新增模型不需重啟；其後一次 GPU 文字編碼效能試驗在約 11.1GB 顯存占用下停滯，中止未返回，已記錄受控重啟前後狀態並恢復 CPU 文字編碼；未終止其他 GPU 程式。既有 distilled Klein 4B FP8、Qwen 3 4B、Flux2 VAE 延用前輪盤點。所有服務僅 loopback。

額外 Base 試驗沿用已安裝官方 `image_flux2_klein_image_edit_4b_base.json` 的 20 steps／CFG5，以及正／負 conditioning 均接同一 ReferenceLatent。三款各一張側視仍未達角色右 90 度，且有塗裝／配件或底座變化，全部退回；沒有把 4-step distilled 設定誤用於未蒸餾模型，也沒有把失敗試驗擴大為 Base 全庫重產。

本輪 Maven package 成功：324 tests 中 46 通過、278 個整合測試因未啟用其 opt-in 隔離環境而 skip，0 failure/error；不能把它寫成 324 項全通過。真實 demo 上傳／讀回與瀏覽器檢查另行記錄。
