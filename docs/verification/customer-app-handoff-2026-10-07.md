# ELPSY Shop Vue 網站交接

更新：2026-10-07。獨立 [Shop_app](https://github.com/jackteng-dev/Shop_app) Flutter 顧客端已實作第一版，網站仍留本倉庫，員工後台與現貨／整筆預購 MVP 不搬移。shared 後端 shop_bak_ap 新增原生 `/api/mobile/customer` JSON Bearer realm/session，原網站 `/api/customer` Cookie/CSRF 不改；schema仍 V18，無新migration。

起始本倉庫 79635fa8cecfe9c6f2ffd9dd4249a2b762fcd435、後端4edf7d2c76f86e4b7c00ec56e8cdf3f220ca0235；先 fetch／讀遠端交接／規則、檢查status/log/diff含staged、ff-only。只涉及 ELPSY 三專案；本倉庫此輪只更新交接／ROADMAP／裝置待驗，不變更 Vue 產品程式。

## 完成與驗證

App Flutter/Riverpod/Dio/GoRouter/secure storage、會員與現貨/預購瀏覽、cart/address、結帳、模擬付款、本人订单／到貨分配／配送與退款退貨進度、未知結果原UUID/body安全保存。詳 [App交接](https://github.com/jackteng-dev/Shop_app/blob/main/docs/HANDOFF.md)、[後端API](https://github.com/jackteng-dev/shop_bak_ap/blob/main/docs/MOBILE_API.md)。

後端完整 mvn package **262項：260通過、2既有略過、0failure/error**；新原生真 HTTP 19項、網站原 auth/customer/shopping/orders/preorder_orders/preorder_money 六組 **153項通過**，網站 CSRF與 realm不因App而放寬。本輪重新 `npm run build`（vue-tsc + Vite production）結果見verification/customer-app-2026-10-07.json，不能把網站 build 當 App 真機驗證。

前輪完整 V18交接／256 Maven／464 HTTP／343 Chromium／升級13／重啟9／DB40 invariant保留 [歷史交接](verification/preorder-fulfillment-handoff-2026-10-07.md) 及原證據檔。

## 下一步及限制

Android debug與 unsigned release compile 不代表裝置測試；下一步 Android真機及macOS/Xcode/iOS build、Keystore/Keychain／背景恢復／斷網／簽名驗收。尚未真機、正式簽章、HTTPS正式部署、商店上架，金流／物流／退款／通知仍mock，未寄真人訊息。

原四項整筆預購MVP完成；訂金尾款、延期、部分退款、到貨後退貨及轉現貨仍選擇性擴充，不默默加作必要項。正式provider／商家素材與政策／會員安全／原DB備份隔離restore／監控另列CLOUD_LOCAL_FOLLOWUP。

## 保存

以兩端／App最新main同步交接。本輪私人fixture／SDK／日誌與screenshots留ignored work，後端scope僅自己的全新demo；Git commit/push main、不force，收尾核對各倉庫HEAD／tracking／實際遠端及乾淨status。

收尾驗證補充：最終 API 程序重啟／mock 關閉／Redis故障與重啟 **10項通過**，Redis驗證等待設為2秒逾時，故障回覆503；Redis清空後舊pair拒絕，重新登入才恢復。資料庫 **37項業務invariant皆0**，history18，V1–V18 byte不改；保留合法PAID／待到貨的合成訂單，不把待到貨清零當業務條件。最終Maven262／Flutter13（另live1）／UI11／native HTTP19／website HTTP153／Vue production build通過，詳safe JSON。
