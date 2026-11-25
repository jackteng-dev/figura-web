# SEO／GEO／AEO 部署與追蹤（Commerce V2 Phase 4）

## 現況與做法

Figura 是 Vue SPA，正式 gateway（`scripts/showcase-publish.py` 的 `gateway()`）把所有頁面都回同一份 `index.html`。Googlebot 會執行 JavaScript，但 OAI-SearchBot、多數社群預覽與部分爬蟲不會，只看得到空白的 `<div id="app">`。

不改框架（不導入 SSR／Nuxt），採**伺服器端注入**：

| 部分 | 位置 | 說明 |
|---|---|---|
| head／body 產生器 | API `GET /api/seo/head`、`/api/seo/body` | 依原始網址（`X-Seo-Uri`）輸出 title、description、canonical、robots、OG、JSON-LD，以及與畫面相同內容的語意化 HTML |
| SPA 換頁 | Web `src/seo/head.ts` → `GET /api/seo/meta?path=` | 同一來源更新 head；員工後台一律 noindex |
| sitemap | `GET /api/seo/sitemap.xml` | 商店首頁、列表、預購、指南、上架商品（含 lastmod）；下架即移除 |
| robots | `public/robots.txt`（同 API `/api/seo/robots.txt`） | 只開放 `/shop`；會員、購物車、結帳、後台不索引；Sitemap 指向 API（robots 宣告的 sitemap 可跨路徑） |
| 指南／知識頁 | `/shop/guides/*`（內容在 API `GuideCatalog`） | 預購規則、材質、比例、AI 概念商品、購物流程；Article＋FAQPage 結構化資料 |

`index.html` 已放好 SSI 標記，**在 gateway 開啟 SSI 之前它們只是 HTML 註解，不影響現況**（顯示預設 title／description）。

## 需要作者審核的部署契約變更（尚未套用）

`showcase-publish.py` 屬部署 recipe，修改會改變 recipe digest，因此本輪**不修改**，請作者審核後自行套用。`gateway()` 中 figura 的 server 區塊建議改為：

```nginx
location = /index.html { ssi on; ssi_silent_errors on; add_header Cache-Control "no-cache"; }
location /__seo/ {
    internal;
    proxy_pass http://api:9090/figura/api/seo/;
    proxy_set_header Host $http_host;
    proxy_set_header X-Seo-Uri $request_uri;   # 子請求中仍是使用者原始網址
    proxy_read_timeout 5s;
}
location / { try_files $uri $uri/ /index.html; }
```

- `internal`：外部不能直接請求 `/__seo/`。`ssi_silent_errors` 加上 `stub`：API 失敗時回預設 head 與空內容，頁面照常載入。
- 只有 `index.html` 開 SSI，靜態資產不受影響。
- 驗證：`curl -s https://<網域>/shop/products/<id> | grep -E '<title>|canonical|seo-prerender'` 應看到商品標題與規格；`curl -A OAI-SearchBot` 同樣結果（不依 User-Agent 差別對待，不是 cloaking）。
- 回退：移除上述兩個 location 即回到目前行為。

**本機未實測 nginx SSI**（本機沒有 nginx image，未下載）；API 端點已有整合測試。

## 已知限制

- **404 狀態碼**：SPA fallback 一律回 200；不存在或下架的商品以 `noindex` 處理，Google 會視為 soft 404。若要真正 404，需在 gateway 依 API 結果改狀態，屬進一步的部署變更。
- **根目錄 `/`**：目前導向員工後台；公開入口是 `/shop`。是否讓 `/` 對訪客導向 `/shop`，由作者決定。
- **網域**：canonical／sitemap 使用 `shop.seo.base-url`（預設 `https://figura.jackteng.dev`）；正式網域不同時以環境設定覆寫，並同步 `public/robots.txt` 的 Sitemap 行。
- **報價**：`shop.seo.product-offers` 預設 `false`。目前付款為模擬，不在結構化資料宣稱可購買的價格與庫存；接上真實金流後才開啟。任何情況都不輸出評價或評分。
- **AI 概念商品**：不輸出 Product 結構化資料，description 開頭標示「AI 生成概念展示商品」，概念材質不放入 material。
- **列表頁**：只有「全部商品」與其分頁可索引（canonical 帶 page）；搜尋與篩選組合 `noindex,follow`，避免大量重複頁。

## Search Console 設定（需網域擁有者操作）

1. 以 DNS TXT 驗證網域資源（`figura.jackteng.dev` 或正式網域）。
2. 提交 `https://<網域>/api/seo/sitemap.xml`。
3. 「網址審查」測試一個商品頁與一個指南頁，確認轉譯後 HTML 含標題、規格與 JSON-LD；開啟 SSI 後再用「即時測試」確認原始 HTML 已有內容。
4. Bing Webmaster Tools 可直接匯入 Search Console 設定。OAI-SearchBot 不需註冊，遵守 robots.txt；若要擋 ChatGPT 的訓練用爬蟲（GPTBot）而保留搜尋，可另加 `User-agent: GPTBot` / `Disallow: /`，由作者決定。

## 追蹤計畫（不需額外付費服務）

| 指標 | 來源 | 檢查頻率 |
|---|---|---|
| 已索引頁數、涵蓋範圍錯誤、soft 404 | Search Console「網頁」報表 | 每週 |
| 曝光、點擊、CTR、平均排名（商品頁／指南頁分開看） | Search Console「成效」以網址篩選 `/shop/products/`、`/shop/guides/` | 每週 |
| 結構化資料錯誤（Product、Breadcrumb、FAQ） | Search Console「強化項目」 | 每次部署後 |
| Core Web Vitals（LCP、INP、CLS，行動版） | Search Console「網站體驗」＋ PageSpeed Insights 抽測商品頁 | 每月 |
| AI 搜尋引用 | 以品牌與商品名在 ChatGPT search／Bing Copilot 手動抽查；記錄是否引用正確頁面與標示 | 每月，人工 |

不採用無法驗證的 GEO 技巧（如堆疊關鍵字、隱藏文字、針對 AI 爬蟲給不同內容、大量自動生成頁面）。內容只寫可驗證的事實：系統實際規則、已確認規格、一般性知識。

## Core Web Vitals／行動版

- 移除 `user-scalable=0`，允許縮放（無障礙）。`lang` 改為 `zh-Hant-TW`。
- 商品圖已有 320／640／1024 衍生尺寸；OG 圖使用 1024 寬。
- 待辦：`index.html` 仍同步載入 Google Fonts 與後台用的 `simplebar`；商店頁可改為延後載入。這些檔案在 `src/assets` 下（不可修改），需作者決定搬遷方式。
