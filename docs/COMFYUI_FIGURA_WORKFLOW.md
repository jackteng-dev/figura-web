# Figura 本機 ComfyUI 商品圖流程

2026-11-19。延續已合併 PR #21；不重新設計角色、不替換正式商品、不操作正式 DB。這套流程產出點陣概念圖，不是可量測的 3D 模型。

## 本輪結論

- 主圖沿用 PR #21 的 r1 Master Reference，保留原本 PVC／ABS／樹脂風格；**沒有把新的生成圖誤稱為更好的定稿主圖**。
- 兩款各交付四張展示候選：完整主圖、臉部／上半身、服裝配件、底座。均由 ComfyUI 的 `LoadImage → ImageCrop → ImageScale → SaveImage` 處理，只有裁切及縮小，沒有生成新造型、鏡像或放大原始像素。
- 另外實際執行四次 Flux.2 Klein 參考圖編輯：兩款各一張側面、一張情境。畫面比單獨文生圖更接近 Reference，但仍不足以證明同一雕塑，**四張全數退回**，不納入商城圖組。
- 背面未定稿，未新增背面。沒有為湊滿六張而採用漂移圖片。
- 八張保守候選通過 Codex 視覺檢查，**作者人工簽核仍為 pending**；本機測試使用這些候選，不表示正式上架授權。

[開啟本輪比較頁](comfyui-figure-samples.html)；[PR #21 比較頁](figure-render-samples.html)；[每次生成／處理紀錄](../src/brand/comfyui-figure-samples/review-manifest.json)。

## 實際環境

完整盤點：[comfyui-environment-2026-11-19.json](verification/comfyui-environment-2026-11-19.json)。

- Portable 安裝：`D:\ComfyUI`，核心在 `D:\ComfyUI\ComfyUI`，Python 在 `python_embeded`。
- 已在執行，PID 初查為 15336；實際參數 `--listen 127.0.0.1 --port 18188 --disable-auto-launch`。沒有重啟、更新或修改既有設定。`/system_stats`、`/object_info`、`/queue`、`/upload/image`、`/prompt`、`/history/{id}`、`/view` 都已實際使用。
- ComfyUI 0.27.0、Python 3.13.12、PyTorch 2.12.0+cu130。
- RTX 3080 Ti 12GB，初查可用 VRAM 約 1.8GB；系統 RAM 約 32GB，初查剩約 4.6–4.9GB。模型由 ComfyUI 管理載入／卸載，Flux 工作實際完成；未終止其他 GPU 程式。
- 已有 Flux.2 Klein 4B FP8、Qwen 3 4B、Flux2 VAE；本輪使用這組權重，CLIP encoder 設在 CPU、768²、Euler、4 steps、batch 1。完整 SHA-256 已保存。
- 另有 Illustrious XL、IPAdapter Plus SDXL ViT-H、CLIP Vision ViT-H、SDXL Union ControlNet，以及 Z-Image Turbo。IPAdapter custom node 已載入且配對權重存在；不是本輪 Flux 工作流的節點。
- Core img2img／masked VAE、ControlNet、pose 節點存在，但**沒有宣稱 Depth／OpenPose 前處理器或局部重繪修正已驗證成功**。SDXL 的 Illustrious 風格傾向不作本輪擬真主圖的預設替代。
- 原有一個使用者 workflow「文生圖.json」，未覆蓋。`ae.safetensors.corrupt` 不選用、不刪除。沒有下載權重、安裝節點、付費呼叫或公開 API Port。

## 輸入與重複使用

CLI：`scripts/comfyui_figura.py`，僅 Python 標準庫。格式編碼重用 PR #21 的 `scripts/prepare-figure-samples.py`，需 PATH 上既有 FFmpeg／FFprobe（libwebp、libaom-av1）。沒有 npm／Python 新套件依賴。

兩個 API-format workflows 可直接載入 ComfyUI；腳本另保存每次實際送出的完整 API graph：

- `workflows/figura/crop.api.json`：主圖／特寫；拒絕超出 master 的裁切、拉伸或放大。
- `workflows/figura/flux-reference.api.json`：Flux.2 Klein 4B FP8，將 **同一 master 的 VAE latent** 接入 `ReferenceLatent`；不是各張獨立文生圖。不能與 SDXL IPAdapter 混接。
- `workflows/figura/samples.json`：商品 ID、designRevision、原圖路徑／SHA、master crop、character sheet 不變條件、shot crop／size／prompt／seed。新商品可另存設定，以 `--config` 指定；不要改已驗收 revision 的 master。

```powershell
# Port／安裝目錄必須先由本機程序與 listening socket 確認。
python scripts/comfyui_figura.py --url http://127.0.0.1:18188 inventory --comfy-root D:\ComfyUI\ComfyUI
python scripts/comfyui_figura.py run FIGURA-AI-001 main
python scripts/comfyui_figura.py run FIGURA-AI-001 face
python scripts/comfyui_figura.py run FIGURA-AI-001 accessory
python scripts/comfyui_figura.py run FIGURA-AI-001 base
# 新角度是研究稿，產出後仍必須逐張檢查，不會自動納入圖組。
python scripts/comfyui_figura.py run FIGURA-AI-001 side
python scripts/comfyui_figura.py --config work/my-character-sheet.json run FIGURA-AI-002 face
```

PR #21 原始 PNG 保存在忽略的 `work/figure-render-samples/originals/`，不隨 clone 提供；缺檔時流程會明確失敗，不會下載或改用另一張圖。可建立新設定，明確選擇 repo 內既有 JPEG 作另一個 master，保存其真實 hash；不能偽稱它就是未壓縮 PNG。

## 保存、冪等與未知結果

每個 job 放在 `work/comfyui-figura/runs/<SHA256>/`。run ID 取自商品／revision／主圖 hash／實際參數；另核對所用權重 SHA。已存在且完成的同一工作只驗 hash 並重用；權重改變須先盤點及使用新 revision，不默默用原 run ID 重產。

保存 `run.json`、`workflow.api.json`、`system.json`、`history.json` 及 `output.png`。含模型名稱與 hash、prompt、seed、參考圖 hash、ComfyUI prompt ID、產出 hash、視覺決定與人工簽核欄位。原始檔、完整原始日誌、權重及私有環境留在忽略路徑。

- 已取得 prompt ID：同一命令重新執行只 poll 原工作，包含等待逾時／程序中斷情況。
- POST 結果未知且沒有 prompt ID：停止自動提交。以 `figuraRunId` 檢查 ComfyUI `/history` 與 queue，核對是否已提交，人工補回已確認的 prompt ID 才可繼續。**沒有宣稱跨 HTTP／檔案系統 exactly-once**。
- ComfyUI history 被使用者清除或原圖遺失：可能無法自動復原，需人工核對，不能換 seed／ID 盲目重送。
- 原始 output 先寫完整暫存檔、flush/fsync 後，以不可覆寫的 atomic hard link 發布；中斷暫存檔不會被當成完成圖。export 在忽略的 `.figura-export-*` 暫存目錄完成全部檔案後才原子發布最終目錄；中斷可重新匯出，不會覆寫既有成品。失敗暫存保留供核對。
- 腳本接受明確 IPv4 loopback HTTP URL，禁代理、外部主機、附帶認證、路徑或 query。只提交 core 本機節點，不使用付費雲端節點。

## 視覺與人工驗收

先看 320px，再看原像素，最後與 Master 並排：臉、比例、髮型、衣褶、左右配件、數量、底座、塗裝、完整性、文字／額外結構。硬性身份錯誤即退回；「相似角色」不等於「同一實體模型」。

```powershell
python scripts/comfyui_figura.py review <runId> pass --reviewer "視覺檢查者" --note "逐項檢查與限制"
# 或 decision=reject。視覺決定不自動等於作者核准。
python scripts/comfyui_figura.py export <runId> --destination src/brand/my-reviewed-samples
# 作者實際看圖接受後才由作者執行；本輪未執行任何 signoff。
python scripts/comfyui_figura.py signoff <runId> --reviewer "作者姓名" --note "實際驗收項目"
```

export 只允許視覺 pass、再次驗證輸出 hash；以 exclusive 建立商品／revision／shot／run 目錄。輸出 PNG／JPEG 上傳所需的 JPEG，另產生 WebP、AVIF 與 320／640／原尺寸（原圖更小就不放大），保存尺寸、bytes、SHA、workflow SHA。來源低解析的特寫仍是低解析，不包裝成原生 1024²。

本輪 8 張共 54 個格式／尺寸衍生檔，1,077,114 bytes；4 張退回圖另提供 384px WebP 僅供比較。作者 humanApproval 欄位全為 null，沒有自動批次簽核。

| 商品 | 主圖＋3 張裁切特寫 | 新側面 | 新情境 | 背面 |
| --- | --- | --- | --- | --- |
| FIGURA-AI-001 | 原 r1 像素來源，Codex 視覺 pass，待作者簽核 | 視角更接近側面，但花枝／包面與殼體輪廓仍漂移，退回 | 包面裝飾／比例／配色變化，退回 | 沒有生成，未定稿 |
| FIGURA-AI-068 | 原 r1 像素來源，Codex 視覺 pass，待作者簽核 | 頭部方向、面罩外形、手臂遮擋與後側縫線未能證實，退回 | 衣褶／舊化／比例與面罩細節變化，退回 | 沒有生成，未定稿 |

未證實 Pixel／CLIP 相似度可以取代人工身份驗收，因此沒有杜撰自動一致性分數。

## 商城接線與限制

Web 的商品詳情改用 `ProductGallery.vue`；商品資料與公開圖組平行讀取，避免先載入完整主圖後才重複下載響應式主圖。縮圖切換、原尺寸放大、鍵盤／觸控、載入失敗提示與固定比例均保留；舊後端或圖組讀取失敗仍顯示原單主圖。

API 配對 PR 需要 V24，新商品圖組維持私有 S3、同源受控讀取、草稿與即時授權、商品版本、操作 UUID、稽核及 orphan cleanup。既有 App 的 `image` 欄位及路徑保持五欄相容；App 本輪不新增多圖介面。

**格式限制：** 後端目前使用 JDK ImageIO 安全重編碼 PNG／JPEG，產出 320／640／1024 寬度且不放大的衍生檔，供 `srcset`。本機流程的 WebP／AVIF 已生成、可在比較頁選用，但 **後端不接受／不提供 WebP／AVIF**；沒有將外部 FFmpeg 偷帶進伺服器。若未來要在線上使用兩種格式，需要另外驗證受信任編碼器與部署環境。不能把靜態比較頁能力當成線上 API 能力。

實際測試結果與本機量測範圍見 HANDOFF 及 `docs/verification/`。本機 Chrome lab 結果不代表正式站 LCP／CLS／INP 或手機真機驗收。正式圖片採用、schema 切換、部署均未進行。

參考實作依據：[Comfy 官方 Klein 說明](https://blog.comfy.org/p/flux2-klein-4b-fast-local-image-editing)、本機附帶的 `image_flux2_klein_image_edit_4b_distilled.json`、[IPAdapter 原始碼](https://github.com/cubiq/ComfyUI_IPAdapter_plus/blob/main/IPAdapterPlus.py)。本輪核心節點接線與模型選項另經本機 `/object_info` 核對。
