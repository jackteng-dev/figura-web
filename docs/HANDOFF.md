# ELPSY Shop Vue 網站交接

## 2026-11-25：Commerce V2 Phase 1–7（分支 `feat/commerce-v2-specs`，未合併；依賴 API V25–V30）

- **顧客**：後端搜尋列表（舊網址相容）、規格表、收藏（訪客 localStorage，登入合併）、到貨／開賣提醒、`/shop/favorites`、`/shop/notifications`、`/shop/shipments`（合併寄送、倉庫暫存、物流追蹤）、`/shop/support`、`/shop/pages`（未發布顯示條款審核中）、`/shop/guides`。
- **後台**：`SpecsEditor`、私人倉庫、運費調整、政策頁（四眼發布）、客服單、出貨單測試物流追蹤（`TrackingPanel`）、營運報表／低庫存、營運狀態、`/admin/security`（TOTP）與登入第二步。新選單依 V28–V30 權限碼（warehouse.read、shipping.adjustments.read、pages.read、support.read、reports.*、ops.status）動態掛載。
- **SEO**：`src/seo/head.ts` 換頁時向 `/api/seo/meta` 取 head；`index.html` 已放 SSI 標記（gateway 未開 SSI 前不作用）；`public/robots.txt`。部署變更與 Search Console 見 `docs/SEO_DEPLOYMENT.md`（`showcase-publish.py` 未改，需作者審核）。
- **驗證**：每階段 `npm run build`（含 vue-tsc）通過；本機 15176＋新 API 以 headless Edge 驗證列表、規格表、收藏按鈕、指南頁 JSON-LD、購物車 noindex；收藏／提醒／通知 API 經同源代理實測。Browser pane 因視窗未顯示無法使用。**新後台頁未以員工帳號在瀏覽器實際點過**（本機限制），nginx SSI 未在本機實測（沒有 nginx image）。
- 未改 `src/assets/`、`package-lock.json`。
- 下一步：API 受控切換上線後合併；作者審核 gateway SSI；政策內容撰寫與審核。

## 2026-11-23：99 件必要 2D 圖組全數入本機圖庫（作者簽核 pending）

依作者新要求，REAR 改以明確 135°–180° 背後方向及關鍵身份判斷，小紋理差異可接受；ANGLE 選擇性。保留 2026-11-20 舊拒收紀錄與政策歷史，新採用另記 `rear-2026-11-23`，不改寫舊 run review。先完成 001／003／068 三件試點並本機上傳後繼續全目錄。

- 作者修復儲存後，剩餘 21 個已通過 REAR 分兩批（10／11 件）以原檔續傳完成。**MAIN／REAR／FACE／DETAIL／SCENE 各 99 件，共 495 張本機供圖，沒有待產圖／待審查／待上傳的必要圖位。** 21 件的路徑、SHA 與生成紀錄對照 `c361351` 皆相同，未重產，99 件 master 紀錄不變。ANGLE 選擇性，36 件舊候選退回、63 件未新增候選留空。
- 四件 ELPSY 無圖商品的標題／品牌／分類／說明／款式與 TWD1280 價格皆同，只有 product／SKU UUID 不同，因此共用原創「苔石量測員」設計。四件 MAIN／FACE／DETAIL／SCENE／REAR 已上傳並讀回；舊排除紀錄保留在 priorExcluded。
- ComfyUI 原先未執行，已以原 portable 啟動，僅聽 127.0.0.1:18188；保留既有模型、節點與使用者 workflow。API 沿用作者已啟動的 19092 demo，未重啟。新背面混用本機 Klein 參考圖流程與內建 ImageGen；沒有新增模型／套件。種子或內建模型版本未提供者記 null。
- 原圖與完整 prompts 在忽略 work，manifest 保存實際來源／輸出 SHA、背面提案、重新審查及上傳 UUID。`rear_gallery_round.py` 提供明確複核／內建候選採用與 checkpoint；圖庫 gate 僅允許 hash 綁定的 REAR 放寬。原 run review 未改寫，外部來源必須綁定正確 master，MAIN 例外只允許原無圖 ELPSY。
- **儲存故障已解決。** 作者確認 12 個 volume 全滿且 `-volume.max=12` 阻止擴充，使用忽略的 `figura-api/work/compose.seaweed-capacity.yml` 只重建 seaweed，改為 `-volume.max=60`，回報 48 個可用 volume；既有圖片保留。先前 PUT 500／圖庫 POST 503 與 Docker 拒絕存取記錄保留為歷史。此次 agent 沒有操作 Docker、ComfyUI 或重啟 API／網頁。
- 052 先前失敗 POST 已核對無 audit event 且草稿版本未變後恢復公開，失敗 UUID／版本證據保留，本次以新草稿版本的 UUID 續傳成功。**99 件商品全部公開，每件皆有 MAIN 與 REAR，沒有缺主圖或空白圖庫。** 無必要圖位續傳待辦。
- 驗證：6 項圖庫 guard＋5 項 runner guard 通過，Web production build exit 0；99 件 × 1440／390px 共 198 筆真本機瀏覽器檢查通過，495 張供圖與 495 個必要來源 SHA 核對通過。`--require-complete` 明確要求每款五個必要圖位，缺圖即失敗。比較頁 99 列各六圖位，抽樣含續傳 REAR 與 ELPSY 可解碼。原生成階段無 OOM，文生圖.json／ae.safetensors.corrupt SHA 不變。
- [逐件 REAR／ANGLE 與問題報告](verification/catalog-gallery-rear-report-2026-11-23.md)、[六圖位比較頁](catalog-gallery-comparison.html)、[manifest](verification/catalog-gallery-manifest.json)、[環境紀錄](verification/comfyui-environment-2026-11-23.json)、[供圖驗證](verification/catalog-gallery-integrity-2026-11-23.json)、[瀏覽器驗證](verification/catalog-gallery-browser-2026-11-23.json)。比較頁顯示 99 件各五個完成必要圖位，ANGLE 保留歷史退回／留空說明；原圖留本機 work，Git 不含圖片。
- 本輪依作者要求只 commit，未 push／修改 PR／merge／force push；作者簽核仍 pending。下一步由作者在本機人工簽核；沒有正式部署或自動簽核，也沒有 3D／360。下方 2026-11-20 的遠端阻礙與側背全空是歷史紀錄。

## 2026-11-20：全目錄 2D 圖組已處理（側／背留空、作者 pending）

分支 `codex/comfyui-product-gallery`。本機圖庫 API 以 `figura-api/codex/product-gallery` 的 `73c2606`、JDK21 重新 package，使用私有 `work/demo.env`，只連 `13306/figura_shop_demo`、17379 Redis、18333 SeaweedFS；V24 僅本機 demo。API `127.0.0.1:19092`、Web 預覽 `http://127.0.0.1:15181/shop`、ComfyUI `127.0.0.1:18188`；未連正式 DB、未修改後端來源、未正式部署。

- 本機公開 API 99 筆中，95 件虛構商品全部處理，4 件 App 合成串接資料排除並記錄證據。MAIN 95 張沿用，FACE／DETAIL／SCENE 各新增 95 張，共 285 張上傳本機；目前每款四張採用，不能說六張已補滿。ANGLE／REAR 各 36 件候選退回、59 件未產候選留空；全部不上傳。依 `angleProductionPolicy` 保留流程限制與個別原因，作者人工簽核一律 pending。
- 三件試點及每批約十件均 checkpoint commit，可依 manifest 續跑而不重產已完成圖片。manifest 保存 master SHA、character sheet／固定背面提案、prompt／seed／工作流／模型與輸出 SHA、候選審查、UUID／版本、上傳及公開讀回。三款額外官方 Base 側視試驗仍漂移，全部退回，未擴大為全庫 Base 重產。無 3D 或 360。
- 特寫使用原圖不放大裁切，與 ComfyUI 相同 PyAV RGB 解碼逐像素核對；情境保留原像素前景合成木展示台，漏掉底座或支架時退回修復保護遮罩。原圖／輸出／日誌全在忽略的 work，未修改 src/assets 或 package-lock.json。頁面及 alt 有「AI 生成示意圖」，未宣稱實物攝影。
- 新增官方 BiRefNet（MIT，444,473,596 bytes）及 FLUX.2 Klein Base 4B FP8（Apache-2.0，4,089,498,488 bytes）；固定 revision、來源、商用授權全文、大小與 SHA-256 見環境紀錄。無新套件／custom node、未覆寫原模型或使用者 workflow。GPU 編碼試驗近 11.1GB 顯存下停滯且中止未返回，記錄受控重啟一次後恢復 CPU 編碼；未終止其他 GPU 程式，沒有推論 OOM 回報。
- 最終驗證：95 件 × 1440／390px 共 190 組真實瀏覽器檢查通過；380 張目前供應圖片及全部 master／來源 SHA 核對通過，原 MAIN 不變、無退回圖混入。Python 原 runner 5 checks＋圖庫 gate／恢復 5 checks 通過，5 個保護遮罩重新計算 SHA 通過；最終 Web production build 通過。配對 API 本輪 Maven package 324 tests：46 pass／278 opt-in skip，0 failure/error；不能把 skip 當 pass。
- 已處理的問題：Windows 原子檔案鎖重試、005 上傳前保存失敗後過早復刊造成 UUID 版本過期（核對 audit 後修復，未重複上傳）、裁切解碼色差誤報、快速切圖停留舊 responsive image、裁切過緊與遮罩漏掉底座。未知 ACK 現維持同一草稿版本續跑。Chrome 受限帳戶 sandbox GPU 子程序被拒，唯讀檢查使用專用 headless profile；未修改產品安全設定。
- 文件：[逐件結果／模型／問題與牆鐘時間](verification/catalog-gallery-report-2026-11-20.md)、[六圖位比較頁](catalog-gallery-comparison.html)、[manifest](verification/catalog-gallery-manifest.json)、[環境紀錄](verification/comfyui-environment-2026-11-20.json)、[續跑說明](CATALOG_GALLERY_RUNBOOK.md)。比較頁引用本機 work 圖片，clone 不含原圖。使用額度中斷等待包含在牆鐘時間內，不冒稱純 GPU 運算時間。
- 遠端交付仍受阻：最終驗證 commit `769260c` 已保存；最後 Git push 以 exit 128 失敗，原因為 wincredman 無法保存憑證、無法取得密碼。改用 GitHub 連接器更新 PR 說明亦被「requires approval, but approval policy is never」拒絕。既有 [PR #22](https://github.com/jackteng-dev/figura-web/pull/22) 為 base main 的 draft，遠端 head 仍 `38b4899`，尚未包含本輪後續提交或新說明。詳細結果記在 manifest `remoteDelivery`；準備好的 PR 說明為 `docs/verification/catalog-gallery-pr-2026-11-20.md`。未 merge main、未 force push，後續需可用 Git 憑證／寫入政策才能推送及更新。

下一步為作者在本機逐件人工簽核；側／背仍需有效一致性方法，是否增加 3D 由作者另行評估。本輪沒有自動代作者簽核或正式上架。


## 2026-11-19：ComfyUI 本機流程與商品多圖（未合併／未部署）

分支 `codex/comfyui-product-gallery`，起點 `ba2ceed`（PR #21 已合併）。配對 API 分支 `codex/product-gallery`／V24。交付為 PR，**本輪不 merge、不部署、不改正式 DB**。未改 `package-lock.json`、`src/assets/`，無 Web CD 受保護檔變更。

- **環境**：自行查到 portable `D:\ComfyUI`，既有服務 `127.0.0.1:18188`、RTX 3080 Ti 12GB。API／節點／模型 SHA 盤點完成；未下載模型、安裝節點、更新設定或對外開 port。既有 Flux.2 Klein 4B FP8＋Qwen＋Flux2 VAE 實際完成參考圖編輯；IPAdapter SDXL／ControlNet 權重存在，未冒稱已測 Depth／OpenPose。
- **可重用流程**：`scripts/comfyui_figura.py`＋`workflows/figura/`，商品／revision／Master SHA／圖片類型／尺寸／prompt／seed、完整 API workflow、job ID、模型 hash 與輸出紀錄。相同工作重用、未知 POST 不盲目重送、已知 job 可恢復 polling；輸出 fsync 後不可覆寫原子發布，衍生檔 staging 完成後才發布。輸出 JPEG／WebP／AVIF；人工 signoff 獨立記錄，沒有自動簽核。
- **兩款結果**：原 r1 主圖沿用；每款由 ComfyUI 產生主圖與三張原像素特寫候選，無生成新造型、無放大。八張共 54 個衍生檔、1,077,114 bytes。兩張新側面與兩張新情境仍漂移，四張均退回，背面未生成；不宣稱全角度幾何一致。Codex 視覺 pass 的八張仍待作者人工簽核，只用於本機隔離測試。見 `docs/COMFYUI_FIGURA_WORKFLOW.md`、`docs/comfyui-figure-samples.html` 與 `src/brand/comfyui-figure-samples/review-manifest.json`。
- **員工後台**：`ImagePanel.vue` 改多檔預覽、逐張上傳／用途、排序、主圖、替換、移除與新舊圖片 audit。僅草稿／具權限；未知 ACK 保留 File／UUID／body，ACK 後讀取失敗只重讀；每筆寫入同時做員工身分 precondition，由後端與 Principal 在交易內核對。pending 只在頁面記憶體，重整先核對圖組及紀錄。
- **顧客展示**：`ProductGallery.vue`，主圖＋縮圖、native dialog 放大、關閉焦點恢復、鍵盤、橫向滑動、固定比例、Lazy Loading、responsive srcset、失敗提示。商品及圖組平行讀取，保留舊 `image` fallback；列表／App 原單主圖欄位不變。
- **格式限制**：API 使用安全重編碼 PNG／JPEG 與 320／640／1024 寬衍生檔（不放大）；**本機匯出的 WebP／AVIF 未接進線上 API**，不可把靜態比較頁說成正式 AVIF 供圖。精確側／背、作者最終簽核、真機 CWV 與正式部署仍未完成。
- **本機驗證**：`npm run build`（vue-tsc＋Vite）通過；Python 流程 guard 5 項通過（loopback、裁切／放大拒絕、hash／review gate、輸出中斷、匯出中斷恢復與不可覆寫）。Chrome headless 真 production dist → 新隔離 API／MySQL／Redis／SeaweedFS，46 項通過：1440／390px 圖組切換／放大／鍵盤／滑動／fallback、不溢出，真員工多檔上傳／排序／主圖／替換／移除，已提交回應遺失同 body 重試僅一筆 event、ACK 後 GET 失敗只讀；比較頁 8 AVIF＋4 退回 WebP 皆可解碼。結果 `docs/verification/comfyui-gallery-2026-11-19.json`；本機 LCP 抽樣約 120–196ms，非正式 CWV 或手機實機證據。
- **配對回歸**：API 完整 package 324 項、322 通過、2 舊 migration fixture opt-in skip、0 failure/error；App 保持遠端 main `0d518b2` 且未改檔，lockfile 補齊快取後 analyze 0 issue、27 tests pass／2 live skip、Web release build 通過，未做 Android／iOS 裝置測試。
- **唯讀審查**：原 CLI 本機 inspection runner 無法啟動，改提供完整 diff／新增程式給 Codex CLI 做靜態唯讀審查。修正 actor 競爭、legacy 刪主圖未遞補、output／export 中斷恢復四項 P2；覆審無 P0／P1／P2 阻斷問題。審查沒有自行執行測試，測試證據如上。
- **續作／限制**：先由作者比較圖組並 signoff；新 API V24 屬 `src/main/resources/` 受保護路徑，作者須安排伺服器受控 schema／contract switch 後才能 merge。舊版回退期間需暫停圖片寫入與舊 cleanup；詳 API `docs/PRODUCT_GALLERY_API.md`。本輪沒有批次替換商品。原始資料、credentials、模型與 raw logs 只在忽略的 work／本機 ComfyUI。


## 2026-11-19：擬真公仔 AI 圖片規範與兩款一致性樣本

分支 `codex/figure-render-spec`，基於遠端 main `73fc22e`。本輪僅試作，不重做商品資料庫。未修改後端、`package-lock.json` 或 `src/assets/`，無資料契約切換。

- 新增 `docs/AI_FIGURE_IMAGE_STANDARD.md`：PVC／ABS／樹脂的實體模型質感、完整底座與棚拍光、電影感 Banner、角色定稿與 reference-based 多角度流程、不可變左右／配件、prompt 模板、效能預算、AI 標示及驗收閘門。對真正 `.glb` 做條件／資產成本／按需載入評估；未開發 viewer。
- 以 built-in ImageGen 做「月梨信差」「冷熔鍋爐姊」兩款主／側／背，加一張收藏場景 Banner。共 7 張評估圖、49 個衍生檔（WebP／AVIF／JPEG，約 1.09 MiB），原始圖及兩張構圖退回稿留在忽略的 `work/figure-render-samples/`。主圖實際 960²、Banner 1536×864，未把裁切／放大誤稱原生高解析。
- `docs/figure-render-samples.html` 為獨立本機評估頁（1440／390px 已看圖），含 AI 提示、角度狀態與格式 fallback；素材在 `src/brand/figure-render-samples/`，`manifest.json` 保存完整實際 prompts、參考／輸出 hash、裁切、bytes。`scripts/prepare-figure-samples.py` 只轉檔，需本機忽略的 session／原圖及 FFmpeg／FFprobe；不連 API／DB。
- `ShopHome.vue` 修正 AI 提示：混入非 AI 或目錄截斷時不再把提示整段隱藏，改用「包含 AI 生成的虛構展示商品」；全目錄經確認皆 AI 才稱全部。補充圖片非實物攝影／非可操作 3D 模型，價格庫存仍為展示。
- 驗證：`npm run build` 通過（含型別檢查，Vite 6.51s）；Chrome headless 八項通過（全 AI／混合／截斷／無 AI／空目錄、手機提示、桌面與手機圖組 7 張 AVIF 解碼／不溢出），結果在 `docs/verification/figure-images-2026-11-19.json`；FFprobe 檢查 49 個尺寸並保存 hash。公開 API 回應在瀏覽器內模擬，沒有帳號或 DB 寫入。未跑 Maven、未測正式站／LCP／手機實機。既有 legacy script／import／chunk build 提示仍在。
- 已知限制：兩張主圖通過風格評估；側面有花枝／包向／頭部／衣褶漂移，背面是未定稿設計提案，**沒有一整組被判為幾何一致**。Banner 手機專用構圖尚未製作。多角度與衍生格式未接後端單主圖 API，也未替換正式首頁。詳細見 `docs/AI_FIGURE_SAMPLE_REVIEW.md`。
- 下一步：先定稿兩款完整 character sheet、修正不合格角度，再決定是否做下一批 5–10 款；若要精確任意角度，才選 1 款投入完整模型及 GLB 試點。這輪不批次改全庫。


## 2026-11-18：Phase 5 配送（運費、宅配／超商、合併／分開寄、出貨單）

分支 `feat/shipping`。需要後端 V23。

- 結帳頁（購物車）：配送方式（宅配到府／超商取貨，顯示運費與免運門檻、停用的方式不可選）、超商測試門市選單（標示「測試門市」）、多組時可選「分開寄」或「一起寄」；切換時向伺服器重新報價，金額欄顯示商品小計、運費、應付金額；送出帶 `shippingMethod`／`deliveryStrategy`／`pickupStoreId`。直接購買維持宅配免運。
- 訂單詳情（現貨、預購）新增「配送」區塊（`ShipmentInfo.vue`）：方式、狀態與等待原因、門市或地址、包裹運費、合併寄送的其他訂單、測試貨件號。
- 後台：新增「出貨單」（`/admin/shipments`：清單、詳情、整張出貨／送達、未確認同操作重試）與「配送方式與運費」（`/admin/shipping-methods`：修改運費、免運門檻、開放，需原因）。路由依權限 `shipments.read`、`shipping.methods.read` 動態加入。
- 驗證：`npm run build` 通過；本機瀏覽器走完超商合併寄送到整張出貨。後台頁面未在瀏覽器實際操作。

## 2026-11-18：Phase 4 預購訂金／尾款、延期與通知

分支 `feat/preorder-deposit`（疊在 `feat/unified-cart` 上）。需要後端 V22。

- 後台預購批次：付款條件（全額／訂金＋尾款天數）、批次卡顯示條件；批次詳情新增「延期／調整預估到貨」（顧客說明＋內部原因）與「通知尾款」（登記到貨後可用），以及時程與尾款紀錄。預購訂單後台列表顯示訂金制與尾款狀態；通知後台新增三種事件名稱。
- 顧客端：商品頁、預購列表、直接預購結帳顯示付款方式；統一結帳顯示「下單後先付」與「預購尾款」；預購訂單顯示訂金／尾款狀態與期限、到貨時程異動，付款按鈕顯示是訂金或尾款與金額；訂單中心待付尾款提示（已退款不提示）。
- 驗證：`npm run build` 通過；本機瀏覽器（隔離 DB、本機測試帳號）走完訂金→延期→尾款通知→尾款。員工後台頁面未在瀏覽器實際操作（見後端 HANDOFF）。

## 2026-11-18：Phase 3 統一購物車與結帳

分支 `feat/unified-cart`（疊在 `feat/order-center` 上；未改 `package-lock.json`、`src/assets/`）。需要後端 `feat/unified-cart`（V21）。

- 商品頁預購批次可「加入購物車」（`pre-add-<batchId>`），也保留「直接預購下單」。訪客購物車也能放預購（品項鍵：現貨 `S:<skuId>`、預購 `B:<batchId>`；同 SKU 的現貨與不同批次是不同品項），登入後合併（預購走 `setCartPreorder`，上限 100），合併異常列表顯示現貨／預購與批次名稱。
- 購物車：現貨與「預購（每個批次各成一張訂單）」兩區，＋／− 自動儲存沿用版本核對佇列；側欄顯示現貨小計、預購小計與合計，以 `checkoutReady` 決定能否結帳。
- 結帳頁（購物車模式）：讀 `/checkout/quote` 顯示分組（現貨訂單；每個預購批次含預計到貨），提示會拆成幾張；下單呼叫 `POST /customer/checkout`。只有一張時直接到付款（現貨 `/shop/orders?pay=`、預購 `/shop/preorder-orders?focus=`），多張時列出每張的「前往付款」與「到我的訂單查看全部」。舊版留下的未確認購物車下單（`expectedSubtotalTwd`）仍用原 API 原內容重試。未知結果的核對連結改到統一訂單中心。直接購買（Buy Now）不變。
- 驗證：`npm run build` 通過；本機瀏覽器（本機測試帳號，資料在 api `work/`）實測：混合購物車（現貨＋兩批次，含同商品）→ 分組 3 張 → 下單 → 購物車清空、訂單中心待付款 3、預購付款連結正確；訪客加入預購 → 登入合併 → 純預購結帳直接到預購付款；直接購買到付款頁。

## 2026-11-18：Phase 2 統一訂單中心

分支 `feat/order-center`（疊在 `feat/checkout-page` 上），需要後端 `feat/order-center`。未動 `package-lock.json`、`src/assets/`。

- 新頁 `/shop/my-orders`（`OrderCenter.vue`、`src/api/orderCenter.ts`）：現貨＋預購同一列表，類型切換、階段分頁籤（含筆數）、排序、伺服器分頁；**篩選以網址為唯一來源**（重新整理、上一頁／下一頁、同頁連結都一致）。卡片顯示類型、階段、標題（多款顯示「等 N 款」）、件數、金額、付款期限、預計到貨。
- 「查看詳情／前往付款」帶到原本頁面 `/shop/orders?focus=` 或 `/shop/preorder-orders?focus=`：該筆每次重新讀取都保留（不在第一頁也會單獨讀取），取得鍵盤焦點並避開固定頁首。付款、取消、退款、退貨流程不變。
- 頁首、頁尾、手機底部導覽改指向 `/shop/my-orders`；舊網址仍可用。
- 驗證：`npm run build` 通過；瀏覽器實測列表、篩選、同頁網址切換、返回、詳情落點與焦點、重新核對後仍保留。

## 2026-11-18：購物體驗改版 Phase 1 — 獨立結帳頁（整合直接購買）

分支 `feat/checkout-page`（疊在 `feat/cart-stepper` → `feat/buy-now` → `feat/contact-only-login` 上，依序合併）。**無後端變更、無 schema**，沿用 `GET /customer/cart`、`GET/PUT /customer/addresses`、`POST /customer/orders`、`POST /customer/orders/direct`（後端 `feat/buy-now`）。未動 `package-lock.json`、`src/assets/`。規格：作者提供的《Figura_購物體驗改版_PRD.md》Phase 1。

- **購物車 `/shop/cart`**：只管商品、數量（保留 −／＋ 自動儲存）、移除與可用性；拿掉收件地址與下單，改「前往結帳」（有待存數量或有問題商品時停用）。運費顯示「結帳時顯示」。訪客「登入後結帳」／註冊 → 登入（登入時合併訪客購物車）→ 回到 `/shop/checkout`。
- **結帳頁 `/shop/checkout`（`CustomerCheckout.vue`）**：無 query 為購物車結帳；`?product=&sku=&qty=` 為直接購買（只買這一款、不動購物車，可用 −／＋ 改數量）。舊 `/shop/buy-now` 轉址到這裡，`BuyNow.vue` 已刪除。區塊：商品明細 → 收件資訊（選已存地址、同頁新增／編輯，儲存後重讀取得新版本）→ 配送（只說明宅配模擬、運費 NT$0 展示）→ 付款（說明下單後在訂單頁選綠界測試信用卡或付款模擬，不會實際扣款）→ 金額 → 「確認下單」。
- **只有按「確認下單」才建立訂單、保留庫存 30 分鐘**；進頁、選地址、改地址都只讀或只寫地址。送出前先重讀購物車／商品與地址，金額、整車版本、地址版本和畫面不同就停下讓顧客確認。
- **冪等與未知結果**：送出前把 `{kind, body}` 存在 sessionStorage（`figura.checkout.pending.v1.<顧客ID>`，也接手舊的 `figura.buyNow.pending.v1.*`），保存失敗就不送。網路錯誤／5xx／回應無法判讀 → 只能「用同一操作重試」（同 requestId＋body）或到我的訂單核對後放棄；400/404/409 明確拒絕 → 清除並重讀最新內容（不重送）；401 保留操作並導向登入。成功後進入「已建立」狀態，只導向 `/shop/orders?pay=<id>`（既有付款區），導頁失敗只顯示「前往付款」，不會再下單。送出與存地址前都向伺服器確認目前登入者，換了會員就停止並改讀該會員資料。
- **其他保護**：登入時訪客購物車未合併完成（仍有訪客商品或合併錯誤）→ 購物車結帳顯示提示並阻擋，請回購物車完成；地址儲存 409／未知 → 鎖住地址與下單直到重新讀取成功；`AddressForm.vue` 抽出，地址頁與結帳頁共用。
- **修正**：結帳金額列改用 `sum-row`（原 `row` 與 Bootstrap 全域 `.row` 衝突，直接購買頁同樣受影響）。
- **測試**：`npm run build` 通過。瀏覽器實測（本機後端＋隔離 demo DB）：購物車無地址欄位；進結帳只有 GET；同頁新增與編輯地址；連點只送一筆；回應遺失 → 重新整理後恢復同一操作 → 重試 body 完全相同、只有一筆訂單、購物車清空、付款區在畫面內；別處改了購物車 → 送出前停下顯示新金額；舊 buy-now 網址轉址並直接購買（購物車不變）；訪客 → 註冊 → 登入 → 回結帳 → 無地址狀態 → 新增地址 → 下單；空購物車；sessionStorage 寫入失敗時不送出；訪客未合併時阻擋；導頁被攔時只出現「前往付款」；桌面與 375px 無橫向溢出。測試訂單皆已取消。
- **smoke**：`smoke_orders_browser.cjs` 改走「購物車 → 前往結帳 → 確認下單」並檢查進結帳頁不保留庫存；順手修正既有過時色碼斷言（`#15161a`）。Playwright smoke 本機未執行（交由 CI）。
- **Codex 唯讀審查 7 輪**：修正成功後仍可再下單、保存失敗仍送出、地址重讀失敗未鎖、訪客未合併無提示、放棄後數量未還原、409 重讀失敗狀態、換會員沿用前一位操作／地址等問題；最後一輪結論結帳邏輯無阻擋問題。
- **未做／下一步**：Flutter App 未改（仍用原 API，不受影響）；統一訂單頁（Phase 2）未開始。

## 2026-11-18：購物車數量 −／＋ 自動儲存

分支 `feat/cart-stepper`（commit 6f062c0）。`CustomerCart.vue` 拿掉「更新數量」按鈕，改成 −／＋ 步進器（也可直接輸入，Enter／離開欄位即送出）。

- 會員：停手 350ms 後送出；`pending` 只存已驗證數量，一次一筆 PUT 並帶整車版本，送出中再按的值等回應後用新版本接著送；正在輸入的草稿不被回應覆蓋。
- 409（庫存不足、別處改過）自動重讀一次並顯示原因，不重送；400 只還原該款；網路錯誤／未知結果鎖住直到「重新核對購物車」。有待送數量時結帳停用；離開頁面先等儲存完成（最多 8 秒，逾時詢問）。
- 訪客：寫本機，立即生效。
- 驗證：build 通過；瀏覽器實測連點、慢速回應期間輸入、超過庫存、送出中離頁、手機寬度。Codex 唯讀審查 3 輪，結論可 commit。`smoke_shopping_browser.cjs` 已改用新按鈕，但 Playwright smoke 未實際執行。

## 2026-11-18：直接購買改為「只買這一款」

分支 `feat/buy-now`（疊在 `feat/contact-only-login` 上，需搭配後端同名分支的 `POST /customer/orders/direct`）。

- 商品頁「直接購買」不再放進購物車，改導向 `/shop/buy-now?product=&sku=&qty=`（需登入；未登入由路由守衛導向登入，登入後回到這頁）。
- `BuyNow.vue`：顯示該款式、數量、金額與收件地址，「確認下單並前往付款」建立訂單後到 `/shop/orders?pay=<訂單ID>`，自動捲到該筆訂單的付款區（綠界／模擬）。未確認回應保留同一 requestId 重試。
- 訂單頁的捲動改用 `behavior:'instant'`（全站 CSS 是 smooth，預覽窗格不繪製時 smooth 不會執行）。
- 驗證：build 通過；瀏覽器實測未登入 → 登入頁 → 登入後回到直接購買頁（2 件、NT$1,040）→ 下單 → 訂單頁付款區在畫面內、伺服器購物車未變；已登入直接進確認頁。

## 2026-11-17：移除暱稱與帳號名稱顯示

分支 `feat/contact-only-login`，需與後端同名分支一起上線（後端關閉帳號名稱登入與暱稱 API）。

- 會員中心只顯示 Email（驗證狀態／重寄）與手機；移除「帳號：…」、「你好，暱稱」與暱稱表單；`updateCustomer` 移除。
- 頁首登入後顯示「會員中心」，不再顯示暱稱。
- smoke 腳本的合成會員全部改為手機＋Email 註冊並以 Email 登入；顧客 smoke 改為檢查會員中心沒有暱稱。smoke 未實跑（只做語法檢查）。

## 2026-11-17：綠界測試環境信用卡付款

分支 `feat/ecpay`（基於 `feat/customer-email-phone`，需與後端 `feat/ecpay`／V20 一起上線）。

- `src/api/payments.ts`：`startEcpayPayment`、`submitEcpay`（只允許 `https://payment-stage.ecpay.com.tw`，建立隱藏表單 POST）、`ecpayStatus`；付款 `provider` 可為 `ECPAY`。
- `MockPaymentPanel.vue`：標題改「付款」，分「信用卡（綠界測試環境）」與「付款模擬」兩區；未確認回應保留同一 requestId 重試（同 mock 規則）。
- `CustomerOrders.vue`：讀 `?ecpay=<訂單ID>`（ClientBackURL）→ 清掉 query、捲到該訂單、每 3 秒重讀最多 6 次等綠界伺服器通知；返回頁本身不改狀態。
- 訂單狀態文字 `已付款（模擬）`→`已付款`、`模擬付款時間`→`付款時間`（綠界與模擬共用），smoke 已同步。
- 驗證：`npm run build` 通過；瀏覽器實測見下方本輪紀錄。

## 2026-11-17：手機＋Email＋密碼註冊、Email 驗證、忘記密碼、FB／LINE 按鈕

分支 `feat/customer-email-phone`（接在 `feat/guest-cart` 之後）。**依賴後端 figura-api 同名分支的 V19 API；後端 PR 有 schema 變更，需作者受控切換後才能部署，兩個 PR 要一起上線。** 未動 `package-lock.json`、`src/assets/`。

- **註冊** `CustomerRegister.vue`：手機（TW +886）、Email、密碼，不需暱稱；重複 Email／手機顯示後端 409 訊息。註冊後導向登入並提示「驗證信已寄到你的 Email」。
- **登入** `CustomerLogin.vue`：「手機或 Email」＋密碼（舊帳號名稱仍可登入）、「忘記密碼？」連結。
- **新頁面**（公開路由）：`/shop/forgot-password`（不論 Email 是否註冊都顯示相同結果）、`/shop/reset-password`（token 讀出後立即從網址移除；新密碼兩次確認；成功後所有裝置登出）、`/shop/verify-email`（token 同樣立即移除）。這三頁不列入「登入後回原頁」。
- **會員中心**：帳號顯示 Email（舊帳號顯示帳號名稱）、Email 驗證狀態（已驗證／未驗證）與「重寄驗證信」、手機。
- **FB／LINE**：`SocialLogin.vue` 在註冊與登入頁顯示兩個圓形按鈕，**目前按下沒有任何動作**，待作者申請 Meta／LINE 金鑰後再接 OAuth。
- **員工後台**：通知頁下方新增「模擬信件」（`MockEmailPanel.vue`，需 `notifications.detail`），列出模擬寄出的驗證／重設信與一次性連結。
- **smoke**：`smoke_customer_browser.cjs` 註冊改填「手機號碼」「Email」，帳號以 Email 比對。
- **驗證**：`npm run build` 成功；本機（後端 V19、`MOCK_EMAIL_ENABLED=true`）瀏覽器端到端：註冊（Email 大寫、手機含空白皆正規化）、重複 Email／手機／錯誤手機格式訊息、FB 按鈕無動作、手機登入、會員中心未驗證→模擬信連結驗證→已驗證、同連結重用失敗、忘記密碼、重設後舊登入 401／舊密碼 401／新密碼 200。員工「模擬信件」以 API 驗證，後台畫面未目視確認。Playwright smoke 未跑。

---

## 2026-11-17：訪客購物車（結帳時才登入）

分支 `feat/guest-cart`。只改前端 `src/views/shop/`、`src/router/index.ts` 與兩支 smoke 腳本；後端、API 合約、`package-lock.json`、`src/assets/` 未動。

- **訪客購物車** `src/views/shop/guestCart.ts`：未登入時「加入購物車」存在 localStorage（`figura.guestCart.v1`，只存 skuId／productId／數量，不存價格；每款 ≤99、最多 30 款）。`/shop/cart` 改為公開路由：訪客看到這台裝置的購物車，價格與可售狀態取公開商品 API（下架款式標示且不計入預估小計），按「登入後結帳」才進登入頁。
- **登入後合併**：顧客登入（或在購物車頁偵測到已登入）時，把訪客款式逐款合併進本人伺服器購物車：每款先重讀整車，再以目前版本寫入「原數量＋訪客數量」（上限 99），成功才自訪客購物車移除。409 代表未生效，重讀後重試一次；400/404/422 視為款式不可購買並略過；回應未確認（網路／5xx）不自動重送，該款移出訪客購物車並提示顧客核對，其餘款式保留下次再合併。購物車頁顯示合併結果。
- **登入後回原頁**：需登入的頁面被導向登入時，router guard 把原路徑記在 sessionStorage（`figura.loginReturn.v1`，30 分鐘、限 `/shop/` 內），不放在網址上，所以 `/shop/login` 路徑不變。頁首「登入／註冊」也會記住目前頁面；註冊後再登入同樣回原頁。沒有記錄時：有合併到購物車就到購物車，否則到會員中心。
- **頁首購物車件數**：登入看伺服器購物車，未登入看訪客購物車；登出歸零。
- **smoke 更新**：`smoke_shopping_browser.cjs` 匿名 `/shop/cart` 由「導向登入」改為「顯示訪客購物車」（`guest-cart-empty`）；`smoke_preorder_orders_browser.cjs` 從預購結帳頁被導去登入後，改為驗證回到預購結帳頁（原為會員中心）。登入購物車的 testid（`cart-*`、`cart-subtotal`、`order-total`、`checkout-shipping`）與流程未改。
- **驗證**：`npm run build` 成功。本機瀏覽器確認：訪客加入 2 款（頁首件數 3）→ 購物車預估小計 → 「登入後結帳」→ 建立帳號 → 登入 → 合併到伺服器購物車並回到購物車；登出後再以訪客加入同款 → 從「我的訂單」被導去登入 → 登入後回到我的訂單、同款數量相加（2+1=3）；下架款式在訪客購物車標示且不計價；375px 無水平捲動。
- **未跑**：Playwright smoke（已更新的兩支也未執行）。
- **已知限制**：訪客購物車只在同一瀏覽器有效；跨裝置以登入後的伺服器購物車為準。
- **合併安全性（經 Codex 八輪審查後）**：Web Locks 串行跨分頁合併並在鎖內重讀；每款寫入前標記 pending（含目標會員），成功後只扣掉已處理件數；每款寫入前確認目前登入者仍是同一會員，否則停止；讀取失敗、409 原因不明或重試後仍衝突時保留品項並停止；結果未知的款式與未加入原因依會員保存在 `figura.guestCart.review.v2.<customerId>`，直到按「我已了解」。
- **已接受的限制**：瀏覽器沒有 Web Locks 時不保證跨分頁互斥；localStorage 無法寫入時，訪客購物車與合併紀錄只保留在記憶體（重新整理後消失）；合併紀錄的讀寫與清除不是交易，不同分頁極短時間內交錯時可能覆蓋。
- **密碼顯示切換**：新增 `src/components/PasswordField.vue`（眼睛按鈕切換顯示／隱藏，`aria-pressed`），用於顧客登入、顧客註冊、員工後台登入；`id`／`placeholder`／`class` 原樣傳給 input，smoke 的 `getByLabel('密碼')`、`getByPlaceholder('請輸入密碼')` 不受影響。
- **顧客登入錯誤訊息**：401 一律顯示「帳號或密碼不正確。」（原後端訊息「登入狀態無效」易誤解），不透露帳號是否存在或屬於其他身分。
- **前台不揭露後台入口**：移除商店頁尾的「員工入口」連結（改版前即存在）；前台頁面不再有任何 `/admin` 連結或員工／後台字樣。員工請直接以網址進入後台。

---

## 2026-11-16・AI 展示型錄首頁提示

- `src/views/shop/ShopHome.vue` 在首頁主標題下方顯示 AI 生成商品提示。提示條件是商品讀取成功、全量載入且所有公開商品的說明以 `AI 生成概念圖｜展示商品` 開頭。
- `npm run build` 通過，含 vue-tsc 和 Vite。瀏覽器驗證未標記型錄不顯示提示。AI 型錄在桌面及 390px 手機顯示提示，五頁共 95 張主圖可讀，系列篩選回傳 12 件。
- 本機 demo 透過商品、主圖、庫存及預購 API 上架 95 件 AI 生成商品、8 個新系列、30 件展示現貨與 64 個展示預購批次。舊型錄已下架封存，歷史資料保留。生成素材、提示詞、型錄與驗證放在後端忽略路徑 `work/figura-ai-catalog/`。
- `package-lock.json`、`src/assets/` 與 API 合約皆無異動。正式主機的資料更換及部署待後續處理。

---

## 2026-11-13：員工後台介面改版（B 熱血玩具屋）

分支 `feat/admin-redesign`（從 main 開出，與顧客商店改版 `feat/shop-redesign-hobby` 分開）。未動 `package-lock.json`、`src/assets/`、API 或後端。

- **完成**：
  - 新後台外框 `BaseLayout.vue`／`Sidebar.vue`／`Header.vue`：深藍側欄依「營運／商品／預購／系統」分組（仍由權限決定顯示哪些頁），頂列為麵包屑（一般文字，不是 heading，避免與各頁 h1 重複）與使用者選單（登出、前往商店）。992px 以下側欄改為抽屜。不再使用 Mantis `pc-*` 版型與 `pcoded.js`；刪除未使用的 `MobileHeader.vue`、`Footer.vue`（含 Mantis／Codedthemes 字樣）。
  - 版面為流動寬度（同 Bootstrap `container-fluid`），沿用 Bootstrap 斷點 576／768／992／1200／1400：992 以下側欄改抽屜、商品／訂單工作區改單欄；1400 以上列表欄固定 320–420px、詳情撐滿；預購批次卡片依寬度自動排列。
  - 主題樣式 `src/brand/admin-theme.css`（於 `main.ts` 在 Mantis CSS 之後載入），以 `.fg-admin` 為範圍覆蓋 Bootstrap 按鈕、卡片、表單、提示與 Element Plus 主色。
  - 工作首頁 `Main.vue` 改為儀表板：待出貨／待付款／待確認送達／預購保留中數字、待出貨訂單、開放中預購批次配額條、通知佇列。數字全部取自既有列表 API 的 `total`，且只呼叫目前使用者有權限的 API。
  - 員工登入頁 `Login.vue` 改為左右分欄；登入按鈕改為 `type="submit"`，**按 Enter 可登入**（原本不行）。
  - 各管理頁只換配色；商品與訂單列表加選取／hover 樣式與商品狀態標籤。
- **保留**：所有頁面邏輯、smoke 依賴的文字（`Figura 工作首頁`、`前往顧客入口 →`、側欄連結名稱、各頁 h1、登入 placeholder 與 `Login` 按鈕）未變。
- **移除的入口**：使用者選單不再連到 `/admin/user/info`（呼叫舊 `/api/admin/user/{username}` 回 403）與 `/admin/user/resetPassword`（未完成的占位頁）；路由本身保留。
- **驗證**：`npm run build` 成功。本機以 `shop_admin` 瀏覽器確認：登出／登入（含 Enter）、儀表板數字與批次、12 個管理頁都有標題且無水平捲動、商品列表選取、375px 手機抽屜選單。
- **未跑**：Playwright 員工 smoke（`scripts/smoke_*_browser.cjs`）本輪未執行，不能宣稱通過。
- **已知問題**：`index.html` 仍引用不存在的 `simplebar.min.js`（既有，非本次造成）。

---

## 2026-11-16：預購狀態、首頁輪播、批次詳情頁

分支 `feat/shop-redesign-hobby`（PR #7 追加 commit `1766bdc`、`18e7ac9`）。只改 `src/views/shop/`；未動 `package-lock.json`、`src/assets/`、API、後端或資料。

- **預購不看現貨庫存**：新增 `buyState()`（`useCatalog.ts`）。商品卡：僅預購顯示「預購中・截單日」、配額滿顯示「預購額滿」、現貨＋預購顯示「有庫存・另有預購」；只有現貨的商品維持「有庫存／暫無庫存」（inventory smoke 依賴）。商品頁：僅預購的商品隱藏現貨款式與購物車表單，改為預購說明與「選擇預購批次 ↓」，價格用批次價。
- **首頁主視覺輪播** `HeroCarousel.vue`：最多 4 個預購批次＋2 件現貨交錯；6 秒自動播放，滑鼠移入／鍵盤聚焦／分頁隱藏時暫停，暫停按鈕、上一張／下一張、指示點、觸控滑動；`prefers-reduced-motion` 不自動播放。圖片不延遲載入（`ProductCover` 新增 `eager`）。
- **預購入口改連商品頁**：首頁輪播、截單倒數卡與倒數列表連到 `/shop/products/<id>#batch-<batchId>`，商品頁渲染後捲到該批次並短暫標示；商品頁移除重複的「批次詳情」按鈕。
- **批次詳情頁** `/shop/preorders/:id` 重做：左商品圖、右批次條件（倒數、價格、截止／到貨／配額、預購下單、須知、批次說明）；「重新載入」改為小文字按鈕，讀取失敗時錯誤訊息也提供。保留 smoke 錨點（批次名稱 heading、`.preorder-cards` 內無圖片、「截止時間（台北）」、「預購下單」、「重新載入」）。批次列表頁未改。
- **驗證**：`npm run build` 成功；本機 demo（含另行匯入的真實公仔資料，只在本機 DB）以瀏覽器確認桌面與 375px：輪播自動／手動換張、商品卡狀態文字、僅預購商品頁、批次詳情頁，無水平捲動。
- **未跑**：Playwright smoke。預覽窗格隱藏時無法目視平滑捲動動畫（以瞬間捲動確認位置正確）。
- **注意**：本機 demo 的真實公仔圖片與價格取自第三方零售網站，只存在本機 DB／SeaweedFS 與 API repo 的 `work/`（已忽略），不在 Git，也不隨 CD 部署。

---

## 2026-11-12：顧客商店介面改版（B 熱血玩具屋）

分支 `feat/shop-redesign-hobby`。只改 `src/views/shop/`；未動 `package-lock.json`、`src/assets/`、API 合約、員工後台或後端。

- **完成**：顧客商店 `/shop` 全面改版為白底深藍＋黃／橘點綴的玩具店風格。
  - 新版型 `ShopLayout.vue`：公告列、Logo、大搜尋框、會員連結、深藍分類列（依實際商品類型產生）、購物保障列、頁尾、手機底部導覽。主題樣式全部以 `.shop-shell` 為範圍。
  - 新共用資料 `useCatalog.ts`：一次讀取公開商品與預購批次（各最多 20 頁）並快取 60 秒；**搜尋、篩選（現貨／預購、類型、作品、品牌、價格）、排序與分頁都在瀏覽器端**，因為公開 API 目前只支援分頁。
  - 新商品卡 `ProductCard.vue`（現貨／預購／售完標籤、截單日）；首頁改為主打預購、截單倒數、最新上架分頁、依作品逛；商品列表加篩選側欄並同步到網址 query；商品頁加款式卡片、數量步進、該商品的開放預購批次區塊與相關商品；購物車改為商品列＋右側訂單摘要。
  - 其他顧客頁（登入、註冊、訂單、預購、地址、付款面板）只換成新配色，邏輯未變。
- **保留**：購物車、下單、付款、預購的程式邏輯與 smoke 腳本使用的可及名稱／`data-testid` 均未改（加入購物車、加入數量、款式 radio、有庫存／暫無庫存、cart-subtotal、order-total、確認下單，保留庫存 等）。相關商品卡不顯示庫存文字，避免與主商品的「有庫存」重複造成 Playwright strict mode 衝突。
- **smoke 相容補正**：首頁保留含「讓喜歡的角色」的 h1（customer／catalog smoke 以此判斷商店入口）；商品頁品牌／作品／類型標籤列帶 `.eyebrow`（masters smoke 讀取作品名稱）。
- **驗證**：`npm run build`（vue-tsc＋Vite）成功。本機 Docker demo（全新 figura_shop_demo、虛構 10 件商品與 4 個開放批次）以瀏覽器手動確認：桌面與 375px 手機的首頁、列表（類型篩選、關鍵字搜尋）、商品頁（款式、數量、預購區塊）、加入購物車→購物車小計與地址、預購情報頁；手機無水平捲動。
- **未跑**：Playwright 瀏覽器 smoke 腳本（`scripts/smoke_*_browser.cjs`）本輪未執行，不能宣稱通過。
- **已知問題**：`index.html` 原本就引用 `/src/assets/js/plugins/simplebar.min.js`，production build 下 404（非本次造成，未修改）。商品只有一張主圖；熱門排行、原價／折扣需後端資料，未實作。
- **下一步**：跑顧客相關 Playwright smoke；若商品數成長，後端公開 API 需加搜尋／篩選參數（mapper XML 屬 CD 受保護路徑，需先受控切換）。

---

## 2026-11-08：自動更新端到端驗證（ELPSY Shop（前端））

本次只增加此交接段落；不變更應用邏輯、資料庫、帳號、映像 recipe、CI 或部署契約。

- 目的：驗證 Atlas／Encore CD 恢復與主機讀取憑證換新後，正常 PR → 原完整 CI → merge → 私人 GHCR 發布 → Ubuntu 主機自然排程部署的完整鏈仍可用。
- 無可見內容變更；以主機實際部署來源 SHA 等於本次 main 作為判定。
- 主機私人部署完成後，再確認 Funnel 公開唯讀版自動跟隨新部署版本重建。
- 未完成上述實測前，不以本段文件或映像發布宣稱自動更新 PASS；結果保存於 server-management 私人交接。

---

## 2026-10-20：Shop 首次主機 CD PASS／配對自然更新驗證

- 測試標記：SHOP-CD-VERIFY-20261020-A。本次只新增交接段落，保留完整歷史，不修改業務、schema、帳號、資料、前後端 API 或發布 recipe。
- 已完成：主機 root shop-first-1792508954444032339／SHA256 02b32c967de74fcf2368fc3e48c0b67d43ca884b4db15a4654bc4d9e8828a3fd FIRST_CD_COMPLETE/PASS；原 Web6f2bc38c／API3ba73a1a 已成對部署，actual OCI／來源與兩個固定 digest 一致。
- 資料保護：fresh 加密備份/check/NAS copy、MySQL45表完整隔離還原、Redis/Seaweed bytes、真 Web/API old→new 與故障回舊全 PASS；正式 DB/Volume 不回灌、不 clean/seed。其他四站252探測0失敗，實際版本與掛載保留，正式資料未初始化。
- 本輪實測：主機匿名瀏覽器手機/桌面8項 PASS；主機 CD 工具114項離線及回歸 PASS。原來源 Hosted CI/Private 發布已成功，沒有重新執行。這些不冒充下一個來源的自然更新結果或完整商務E2E。
- 重要範圍：首次 CD 不等於 AUTO-CD；這次 Web/API 兩repo各走正常 docs PR、原完整 CI 與 Private GHCR，合併後須等兩者新main發布都就緒，才由既有 Ubuntu timer 配對更新。尚未通過的此 head/main CI、私有新digest、自然交易與actual OCI不得先標 PASS。
- 下一步：兩個 PR 原 CI 全 PASS 後再相鄰正常合併，不 force 或跳檢查；驗 main→CI→GHCR→自然 CD→新root metadata＋完成journal/資料指紋/其他四不變。完整 Shop AUTO PASS 後接續Encore。
- 保留：MySQL/Redis/Seaweed、網站Cookie/CSRF、App /ELPSY/api 別名及原資料契約，Flutter App不在本次；沒有真金流/物流/通知、Funnel、網路/SSH/UFW/Tailscale/NAS修改或新Token。完整主機證據見 server-management，不將舊來源歷史改成目前版本。


更新：2026-10-08。独立Shop_app顧客App完成Android模擬器原生核心驗收與可安裝測試APK，準備iOS／商家簽章。網站仍在本倉庫，員工後台與現貨／整筆預購MVP不搬移；共用shop_bak_ap後端V18，原網站/api/customer Cookie/CSRF不變。

本輪起始main：1e282a8a713657e684523cec4ab09d23ed4df9c5；後端92213e2ca8332ebfe7bbe50774b4ce5bcaa2badb；App a0418a1ed31b3614808ee87f0841003a144f3d21。先fetch／遠端交接／AGENTS／status/log/diff／ff-only。本倉庫本輪只更新交接／進度與證據，Vue產品程式未變更。

第一版App與原生Bearer入口、網站原回歸見[2026-10-07歷史交接](verification/customer-app-handoff-2026-10-07.md)。現貨／整筆預購與V18詳細見[預購履約歷史交接](verification/preorder-fulfillment-handoff-2026-10-07.md)。

## 本輪驗證與限制

Android29 模擬器使用真 NativeStore／AndroidKeyStore 與本後端，核心4階段通過（冷啟動與輪替、已提交回覆遺失的原 UUID/body 重試同一單、ACK後GET503、版本寫入只讀核對與owner隔離）。最終產品入口 debug APK 0.1.1+2 的手動 UI／生命週期8項通過。完整 UI 自動化被 System UI ANR／UiAutomator45秒逾時阻擋；Skia 背景返回黑畫面未通過，預設renderer短暫黑畫面後恢復。實體手機、硬體儲存及效能仍未驗收。

本輪後端完整 mvn package **262項：260通過、2既有fixture skip、0failure/error**，原生真HTTP **19通過**，DB **39項invariant全0**、history18，V1–V18 bytes不變；Vue production build（vue-tsc／Vite）成功。後端及Vue本輪沒有產品程式變更。前輪 Dart live1、browser11、網站HTTP153及API故障10屬歷史證據，本輪未重跑，不能寫成裝置測試結果。

安全證據：[customer-app-device-2026-10-08.json](verification/customer-app-device-2026-10-08.json)。詳[App本輪交接](https://github.com/jackteng-dev/Shop_app/blob/main/docs/HANDOFF.md)、[USB安裝與iOS／正式簽章步驟](https://github.com/jackteng-dev/Shop_app/blob/main/docs/DEVICE_ACCEPTANCE.md)。

## 下一步與保存

Android 測試APK在私人 Shop_app 草稿版本 tag v0.1.1-device-test；只連 localhost9090，需使用者電腦自己的 demo 與 USB adb reverse，不是正式部署。正式Android商家簽章條件設定及iOS own-app Keychain entitlement已準備；完整設定以拋棄式開發key驗過，不是商家正式簽章。iOS只有靜態plist／設定檢查，Linux未做Xcode建置。

下一步實體Android預設renderer／Keystore／背景／斷網／更新驗收，以及Mac/Xcode、Apple Team、HTTPS API下的iOS／Keychain驗證。正式部署、簽章／平台帳號、真provider、會員安全及營運另列待驗；整筆預購MVP已完成，訂金尾款／延期／部分退款仍選擇性擴充。

只用全新自有 elpsy-app-device-20261008 scope；封存自己1商品／關閉1批次，停止自有API／controller／模擬器，移除3容器／2 volumes／network，核對23306／27379／28333／29092／29102關閉。未改原DB、其他作品或寄真人訊息。私人fixture／SDK／日誌／截圖不進Git。三倉庫各自main提交／推送，不force，核對實際遠端與乾淨status。

交付補充：原雲端APK上傳端點401，改以手動GitHub Actions建置成功並附到私人草稿。[下載](https://github.com/jackteng-dev/Shop_app/releases/tag/untagged-2e7d99bc1f7c451ca04d)／[建置](https://github.com/jackteng-dev/Shop_app/actions/runs/37712548885)；實際交付SHA256 `4ac11c22115f0c073b91247f8fe1e42e26aef18fa1a07b0bc447f320899f06d1`，180297725 bytes，下載雜湊／開發簽章／code2／3 ABIs已核對。原生核心及手动UI證據屬原雲端APK；CI重新建置檔尚未跑裝置驗收，簽章亦不同，不能合併宣稱同檔驗證。
