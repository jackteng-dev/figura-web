# ELPSY Shop Vue 網站交接

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
