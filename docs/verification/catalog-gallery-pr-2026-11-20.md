本機目錄原本每件只有一張主圖。本輪處理 95 件正式虛構商品，沿用各自原主圖，補上可切換／放大的 FACE、DETAIL、SCENE；另外 4 件合成串接資料排除並記錄理由。只做 2D，無 3D 模型或 360。

| 圖位 | 完成／採用 | 退回且留空 | 未產候選留空 |
|---|---:|---:|---:|
| MAIN | 95（沿用） | 0 | 0 |
| ANGLE | 0 | 36 | 59 |
| REAR | 0 | 36 | 59 |
| FACE | 95 | 0 | 0 |
| DETAIL | 95 | 0 | 0 |
| SCENE | 95 | 0 | 0 |

共新增 285 張到 **127.0.0.1:19092 的 demo 圖庫**，95 張原 MAIN 的綁定與 bytes 保留。側／背的 36 款各經兩次候選檢查仍有配件、姿勢、雕塑或底座漂移；三款額外官方 Base 試驗也退回。依 `angleProductionPolicy`，其餘 59 款不擴大無效角度生成，明確標記未嘗試留空，不冒稱這些商品已實測失敗。**作者人工簽核仍為 pending，沒有宣稱每款六張已補滿或正式上架完成。**

延用 `comfyui_figura.py`、現有 API workflows 與 master／character sheet 規範。裁切特寫不放大，使用與 ComfyUI 相同的 PyAV 解碼逐像素核對；情境用原像素前景合成展示台，漏掉底座／支架的候選退回後修復遮罩。保留失敗紀錄、prompt／seed／模型與輸出 SHA、續跑狀態及上傳 UUID。新增圖庫調度和未知 ACK 恢復保護；修正快速切換 responsive 圖片停留於舊圖的情況。頁面及 alt 標示「AI 生成示意圖」。

新增模型均先核對官方商用授權及空間，採固定 revision 與獨立檔名：

- [ZhengPeng7/BiRefNet](https://huggingface.co/ZhengPeng7/BiRefNet)，MIT，444,473,596 bytes，revision `e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4`，用於去背遮罩。
- [black-forest-labs/FLUX.2-klein-base-4b-fp8](https://huggingface.co/black-forest-labs/FLUX.2-klein-base-4b-fp8)，Apache-2.0，4,089,498,488 bytes，revision `103db268c10d4d3921101b46057671f9ac460da6`，用於額外側視一致性試驗，結果全退回。

來源 URL、授權全文、大小及 SHA-256 在 `docs/verification/comfyui-environment-2026-11-20.json`。無新增套件或 custom node。GPU 文字編碼效能試驗近 11.1GB 顯存下停滯，記錄受控重啟後恢復原 CPU 編碼；未回報推論 OOM，未終止其他 GPU 程式，未覆寫舊模型或使用者 workflow，服務只聽 loopback。

驗證：

- 95 件 × 1440／390px = 190 組真實本機瀏覽器檢查，包含四張切換／解碼、原主圖、無退回圖混入、AI 標示、放大焦點與無水平溢出。
- 唯讀核對 99 筆目錄範圍、95 件原始 master／審查來源及目前 380 張供應圖片 SHA-256，全數吻合。
- Python 原 runner 5 checks、圖庫 gate／恢復 5 checks 通過；5 個原像素保護遮罩重新計算 SHA 通過。
- 最終 `npm run build`（vue-tsc＋Vite）通過；配對 API 本輪 JDK21 Maven package 324 tests：46 pass／278 opt-in skip，0 failure/error。

每批約十件 checkpoint commit。原始圖片及日誌只在忽略的 `work/`，沒有把全目錄圖檔放進 Git；比較頁需要這台本機的 work 檔案。未修改 `package-lock.json` 或 `src/assets/`，未連正式 DB。逐件六圖位狀態、原因與上傳讀回記錄見 manifest、`docs/catalog-gallery-comparison.html` 和本輪報告。

沿用配對 [figura-api #17](https://github.com/jackteng-dev/figura-api/pull/17) 的圖庫 API；本機使用 `codex/product-gallery` 來源及私有 `work/demo.env`。後端 V24 受保護 schema 的伺服器切換規則仍適用；本輪不 merge、不部署。
