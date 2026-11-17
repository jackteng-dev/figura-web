# ELPSY Shop Vue 網站交接

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
