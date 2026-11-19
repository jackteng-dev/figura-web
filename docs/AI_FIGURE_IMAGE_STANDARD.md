# Figura 虛構公仔圖片製作規範 v1

2026-11-19。適用範圍：Figura 的 AI 虛構展示商品，先完成兩款樣本，再決定是否擴大。本文的「擬真 3D 公仔渲染風格」描述**點陣圖片的視覺效果**，不代表存在可旋轉、量測、列印或製造的 3D 模型。

## 1. 統一的視覺方向

- 主體必須像放在桌面上的實體收藏模型。PVC 使用細緻半霧面塗裝；ABS 配件可有較硬、略亮的反射；樹脂雕像呈現雕刻髮束、雕塑衣褶、手工塗裝與適度舊化。虛構材質是造型設定，不能當成實際商品材質保證。
- 皮膚、頭髮、衣物與葉片也必須呈現雕塑及塗裝的表面。不能把真人攝影、活體動物、真植物或一般動漫插畫當作公仔主圖。
- 微小接縫、輪廓厚度、接地陰影、塗裝邊界應合理；不以過度油亮、景深模糊、噪點或銳化掩蓋結構錯誤。背景與燈光的風格統一，角色本身保留各自設計。
- 僅使用原創虛構角色、系列與品牌。參考圖必須是本專案可使用的自有素材，不以第三方商品圖或知名角色造型生成替代品。

## 2. 圖片類型與構圖

| 用途 | 構圖與光線 | 交付目標 |
| --- | --- | --- |
| 主圖 `main` | 1:1；前方約 30–45°；完整公仔及底座；上、下至少各 8% 安全邊界；主體含底座約佔高度 80–84% | 暖白 `#f3f1ed` 無縫背景；左上大柔光、右側補光；接地陰影；85mm 等效產品鏡頭感；全主體清楚 |
| 側面 `side` | 1:1；同款公仔的固定右側約 90°；相同站姿、底座、畫面比例與地平線 | 改變觀看方向，不能改造型或讓角色另擺姿勢；沿用主圖棚光設定 |
| 背面 `rear` | 1:1；約 180°；完整背面與底座；與主圖相同尺寸及材質 | 背部未知細節先列為「提案」，完成造型定稿才可用於正式圖組 |
| 首頁 Banner | 桌面 16:9 成品；收藏櫃／展示台場景；公仔完整、位於右側，左側約 40% 留給 HTML 文案 | 暖色主光＋冷色輪廓光，有限度景深；背景可虛化，主體保持清楚；不得增加看似隨商品附贈的配件 |
| 手機 Banner | 另做構圖或經人工驗證的安全裁切 | 不可直接把桌面橫圖中央裁切，導致公仔、底座或文字區消失 |

主圖不可燒入價格、文字、品牌水印或 AI 標籤；AI 提示由頁面以可讀文字顯示，並在圖片 alt 說明其為 AI 生成概念圖。Banner 文案也由 HTML 疊加，不交給模型畫字。輸出若未符合比例，先做不損主體的裁切或留白，再驗收；不能靠拉伸補比例。

## 3. 先定稿，再做角度：一致性流程

1. 為商品建立固定 `productKey` 與 `designRevision`。記錄角色比例、面部、服裝、配色、左右手、配件數量及位置、站姿、底座幾何、材質與不可變細節。
2. 以既有自有概念圖產生一張主圖。主圖通過材質、完整性及身份驗收後，才成為本版的 **master reference**。
3. 每張側／背圖都附上同一版 master reference，逐項重述不可變條件，僅要求改變觀看方向。背圖可同時參考已驗收側圖；不能只用相同文字各自重新生成。
4. 使用明確的解剖左右（角色自己的左右），避免以畫面左右代替。禁止鏡像修圖冒充另一角度，因為配件會換邊。
5. 未見的背面細節先提出固定設計，記入 character sheet；不得在不同圖中自由補畫不同口袋、髮型、扣具或裝飾。
6. 將主／側／背並排，對照 reference 作人工檢查。任一硬性身份錯誤，即退回該張圖；不以平均分數掩蓋錯誤。
7. 保存實際 prompt、參考圖的來源與 SHA-256、輸出 SHA-256、工具、生成時間、人工裁切／轉檔方式及驗收結果。不支援的 seed、模型版本或相機參數記為「未提供」，不能捏造。

這種 reference-based 產圖可以降低漂移，**不能保證幾何完全一致**。相同 prompt 或 seed 也不等於同一個 3D 物件。無法通過的角度先不展示；需要精確背面、尺度或連續旋轉時，應改用真正的建模流程。

### 本輪兩款 character sheet

| 固定項 | FIGURA-AI-001 月梨信差／月丘果園郵隊 | FIGURA-AI-068 冷熔鍋爐姊／冬炭修理廳 |
| --- | --- | --- |
| 輪廓 | 梨形奶油白機器人；短四肢；深梅紫面罩與雙眼小笑容 | 成年女機械師；深棕捲髮盤髮；頭轉向角色左側 |
| 塗裝 | 奶油白半霧面 PVC、梅紫略亮面罩、薄荷綠背帶包、棕色靴 | 炭黑連身工作服、銅色扣件、焦橘手套、棕色工作靴；雕塑髮束與樹脂皮膚 |
| 配件與左右 | 頭頂花枝／綠葉；角色左手持黃果；包在角色右髖；金扣、月牙及花飾；紫色手套 | 角色右手叉腰；角色左臂抱奶油色舊化焊接面罩；紫色矩形視窗；雙胸袋、皮帶與矩形銅扣 |
| 底座 | 淺杏色矮圓台 | 深灰舊化金屬感菱紋圓台，側緣鉚釘 |
| 不可變 | 花枝數量／方向、包與果實換邊、面罩圖案、靴形、底座不能重設 | 臉型、髮髻、持物／叉腰左右、口袋、腰帶、焊罩與底座不能重設 |
| 背部限制 | 原概念只有前方；背帶路徑與後側接縫是待定稿設計 | 原概念只有前方；後背縫線與背袋是待定稿設計 |

## 4. Prompt 模板

以下為工具無關模板；本輪的完整實際 prompts 與輸出對應存於樣本目錄的 `manifest.json`。

```text
Use case: identity-preserve, product-mockup.
Asset: one square catalog image of a fictional physical collectible.
Identity: [productKey, revision, attached approved master reference].
Invariant sculpt: [shape, face, hair, pose, anatomical left/right accessories,
                  exact colors, garment seams, base shape and decorations].
Material: painted PVC / ABS / resin; miniature-scale sculpted surfaces,
          precise paint masks, controlled satin highlights, grounded contact.
Camera: [front three-quarter / character right profile / rear], same scale,
        same pose; complete figure and base, 8% minimum top/bottom margins.
Studio: warm off-white seamless, softbox upper left, right fill,
        85mm product photography look, crisp full-subject focus.
Change only: [camera view or explicitly requested material refinement].
Avoid: illustration, anime drawing, living subject, changed accessories,
       mirrored anatomy, extra props, cropped base, text, logos, watermark.
Output is a raster AI concept image, not a real 3D model.
```

Banner 另指定「same approved miniature sculpt, collector display stage, cinematic warm key/cool rim, subject on right, quiet left copy space」。不要把主圖整張當背景拉伸，也不要讓背景陳列模糊成另一件商品的輪廓。

## 5. 檔案、格式與載入效能

以下是 **Figura 的目標預算**，不是通用標準或已測得的正式站成績。以人工檢查塗裝與細節為優先，超標時先檢查噪點與畫面，再調品質，不能無條件壓縮。

| 類型 | 尺寸 | WebP 初始目標 | 備註 |
| --- | --- | --- | --- |
| 典藏 master | 工具實際原始 PNG，建議至少 1024²，優先 1536² | 不供列表直接載入 | 本機忽略路徑保存；不把放大圖宣稱為原生高解析 |
| 縮圖 | 320×320 | ≤35 KiB | 用於小型商品卡或角度選擇器 |
| 商品卡 | 640×640 | ≤90 KiB | `srcset` 供瀏覽器依畫面及像素密度選擇 |
| 詳情主／角度圖 | 1024×1024 | ≤220 KiB | 只先載入選中的主圖，其他角度延後 |
| Banner 桌面 | 1536×864（原圖足夠時） | ≤300 KiB | 首屏唯一主視覺；手機另做安全構圖 |

- WebP 作為本輪主要衍生格式，AVIF 作可比較的候選，JPEG 保底。用 `<picture>` 的 AVIF → WebP → JPEG 順序，搭配各尺寸 `srcset`、符合真實欄寬的 `sizes`，不要同時下載三種格式。AVIF 沒有可見優勢或編碼成本不划算時，可以僅交付 WebP＋JPEG。
- 固定 `width`、`height` 或 `aspect-ratio`，商品使用 `object-fit: contain`，保留底座。首張可見 Banner／LCP 圖 `eager`、`fetchpriority="high"`；其他卡片與非活動輪播圖延後，不全部預載。用實際瀏覽器網路及 LCP 測量驗收，檔案變小不代表已改善正式站 LCP。
- 固定 sRGB、移除私有 metadata；派生檔保存原圖 SHA-256 與輸出尺寸／bytes。品質值因編碼器而異，不能只用同一品質數字比較格式。
- 命名：`figura-ai-001-r1-main-1024.webp`、`...-side-640.avif`。變更設計必須換 revision，禁止把不同版混成同一商品圖組。
- 原始生成結果留在忽略的 `work/figure-render-samples/originals/`；新可追蹤樣本放 `src/brand/figure-render-samples/`，不改 `src/assets/`。

**介面進度：** PR #21 時只支援一張 PNG／JPEG 主圖，沒有多圖或 srcset。本輪已在功能分支新增多圖 API／後台與前台，保留舊單圖投影；詳 [ComfyUI 流程與限制](COMFYUI_FIGURA_WORKFLOW.md)。API 仍只接受並安全重編碼 PNG／JPEG，提供較小尺寸；WebP／AVIF 仍是本機衍生與獨立比較素材，未接到線上 API。配對 API PR 包含受保護的 V24 schema，尚未合併或部署，不把功能分支成果宣稱為正式站狀態。

`<picture>` 的格式選擇與 fallback 行為依據 [MDN 官方文件](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture)。

## 6. AI 標示與驗收閘門

- 首頁保留可讀 AI 提示。若混有非 AI 測試資料，應改稱「本站包含 AI 生成的虛構展示商品」，不能使整段提示消失，或錯稱每件商品都經過驗證。
- 樣本頁固定顯示：「AI 生成的虛構公仔概念圖，採擬真公仔渲染風格；非實物攝影，非可操作的 3D 模型。」
- 建議 alt：「月梨信差，AI 生成 PVC 公仔概念圖，前方四分之三視角，含完整底座」。材質標為概念設定。
- 主圖硬性通過：單一完整模型／完整底座、身份一致、正確配件與左右、無額外手指或融合結構、可辨識實體材質、無文字／浮水印。
- 多角度硬性通過：身份、服裝、配色、配件、站姿、底座全部一致；看不清或未定稿處明確記錄，不能假裝已驗證。
- 每款以「主圖可用／多角度待修／整組可用」分開記錄；Banner 另驗收商品輪廓、背景、文案留白與安全裁切。
- 先看 320px 商品卡，再看 100% 主圖，最後並排看角度。兩款都通過才可討論下一批 5–10 款；不直接替換整庫，批次也逐款驗收。

## 7. 未來真正 `.glb`／360° 的評估

**建議：保留為少數精選商品的後續試點；目前先完成圖片質感。** 有可信的 mesh、UV、材質與尺度後，真正 3D 才能解決觀看任意角度的一致性問題。三張 AI 圖或假輪播都不能稱為真 3D 旋轉。

- 進入條件：先有 1 款定稿 character sheet、可使用的完整模型來源，以及願意投入建模／修模、拓撲、UV、貼圖與手機驗收的時間。由單張 AI 圖推導的背部會有歧義，不能免除人工修模。
- 資產：固定比例與原點、包含底座、合理材質／貼圖；輸出 `.glb`，檢查背面、法線、穿模、透明、燈光與不同裝置呈色。保存原始工程、輸出版本、授權及 hash。
- 起始效能預算（待實測）：單款傳輸 ≤5 MiB、約 50k–100k triangles、主要貼圖不超過 2K；不是保證值，需以目標手機 GPU、記憶體、互動流暢度與視覺品質調整。
- 載入：先顯示現有主圖，使用者點「360° 檢視」才載入 viewer 與模型；不讓列表每張卡建立 WebGL。失敗回到圖片，提供鍵盤操作、可讀說明，尊重減少動態設定，不預設自轉。
- 可以先評估 `<model-viewer>` 的 poster／GLB／互動能力，再比較客製 Three.js。幾何／貼圖壓縮可能另需 decoder；要把 decoder 的下載量、來源及版本納入部署評估。
- 工作估算（本專案規劃值，非報價）：成熟模型已有時，1 款 viewer 整合與手機驗收約 1–3 工作日；只有概念圖時，建模／修模可能數日到數週，成本通常先落在資產而非旋轉按鈕。

依據 [model-viewer 官方載入範例](https://modelviewer.dev/examples/loading/) 的 poster、GLB、壓縮與 GPU 載入說明；真正 GLB 的資產與材質驗證可參考 [Khronos glTF PBR 與 Validator](https://www.khronos.org/gltf/pbr)。上述預算與工期是本專案的初始判斷，尚未進行模型或真機測量。本輪不新增 viewer 套件、不開發 3D 頁面、不建立模型資料表。

## 8. 本輪產出與下一步

實際產圖、角度一致性與檔案大小以 [樣本驗收紀錄](AI_FIGURE_SAMPLE_REVIEW.md) 為準；完整 prompt、參考來源 hash 及衍生檔 metadata 存於 `src/brand/figure-render-samples/manifest.json`。原始 PNG 不部署。主圖、多角度或 Banner 未通過的部分先保留為樣本，不能因畫質好就直接批次上架。
