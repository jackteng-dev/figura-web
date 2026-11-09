# 新機啟動

後端完整步驟：[shop_bak_ap 新機文件](https://github.com/jackteng-dev/shop_bak_ap/blob/main/docs/NEW_MACHINE_SETUP.md)。先建獨立 MySQL 8.4／Redis 7、匯入私有設定，由 demo profile Flyway 初始化新空 DB 與兩個展示員工，再啟動後端 19092。不能對原 DB 跑 demo SQL。

本前端在 Node 24.19／npm 11.9 實測；依 lock 安裝：

```sh
npm ci
npm run build
VITE_API_PROXY_TARGET=http://127.0.0.1:19092/ELPSY npm run preview -- --host 127.0.0.1 --port 15176 --strictPort
```

進入 localhost 的 /admin/login，使用自己的私有展示帳密，沒有預填密碼。/api 由 preview／dev 代理；真正部署 dist 時需同源 HTTPS 反向代理，後端保持 Secure Cookie。VITE_* 不放秘密。

重跑瀏覽器：`scripts/smoke_customer_browser.cjs`（新顧客會員）與 `scripts/smoke_browser.cjs`（員工回歸）；需要 Playwright／Chromium、DEMO_ADMIN_PASSWORD／DEMO_STAFF_PASSWORD 私有環境。可在 work/browser-tools 安裝免費 Playwright，透過絕對 PLAYWRIGHT_MODULE_PATH 與可選 PLAYWRIGHT_CHROMIUM_PATH 執行；完整命令見後端文件。腳本限定 loopback、阻擋外部請求，結果在忽略 work/verification（員工）／work/customer-20261007（顧客）。

顧客入口 `/shop`：註冊、登入、本人暱稱、登出。顧客與員工 Cookie／資料表分開，登出互不影響。顧客 smoke 會建立隨機合成帳號，僅用隔離 demo。

員工登入首頁是里程碑說明，帳號／角色／權限頁仍是占位，不是可操作的完整管理器。商品管理 `/admin/products` 已可操作草稿／SKU／上架；顧客 `/shop/products` 與詳情可匿名瀏覽。店長上架、員工編輯草稿；SKU庫存與異動已可操作，訂單另階段。

商品 browser smoke：`PLAYWRIGHT_MODULE_PATH=/絕對路徑/playwright node scripts/smoke_catalog_browser.cjs`。需同樣私有展示帳密／Chromium，先使用沒有上架商品的可拋棄 demo；腳本建立一件合成商品並最終封存，結果在忽略 work/catalog-20261007/browser-catalog.json。空列表為真實狀態，沒有自動種商品。圖片上傳未完成，目前圖片區明確預留。

庫存browser smoke：`PLAYWRIGHT_MODULE_PATH=/絕對路徑/playwright node scripts/smoke_inventory_browser.cjs`。需要同樣私有展示帳密／Chromium，建立一件合成商品、上架與調整後封存，含回應遺失重試驗證；只在可拋棄demo。商品詳情顯示有／無庫存，不公開數量與異動紀錄。員工可讀，店長可調整。

## 購物車／地址與後續圖片

顧客登入後 `/shop/cart` 與 `/shop/addresses` 可用；商品詳情加入量轉成伺服器購物車的絕對數量，未知回應先核對，不盲目累加。下架／缺貨顯示問題且不算可用小計；下單未開放。地址只保存本人台灣收件欄位，衝突先重新核對。

新增 smoke：`PLAYWRIGHT_MODULE_PATH=/絕對路徑/playwright node scripts/smoke_shopping_browser.cjs`，同樣私有店長環境、正式dist／JAR與隔離MySQL／Redis，結果及390px截圖在忽略work/shopping-20261007。腳本建立合成會員／商品，只封存自己的產品；不能在正式環境跑。圖片後續使用SeaweedFS，本輪尚未啟動或接上傳。

## 里程碑2B：訂單

以最新main與HANDOFF為準，demo Flyway已包含V6，保留V1–V5。完整DB測試需原有SHOP_MYSQL_INTEGRATION／SHOP_REDIS_INTEGRATION；不設歷史fixture marker會略過兩項舊升級演練。新HTTP `python3 scripts/smoke_orders.py`、browser `node scripts/smoke_orders_browser.cjs`。Browser在自己的Docker MySQL合成UUID訂單設定過去期限，需提供後端demo.env及DB_PASSWORD；JAR用 `--shop.orders.expiry-delay-ms=1000`僅縮短測試掃描間隔，產品期限仍30分钟。

顧客加入款式、建立本人地址後，在購物車核對金額／地址下單，再到我的訂單取消。版次與價格變動先重讀；未知回應同操作重試／查本人訂單，離開頁面前先核對。正式啟動必須做原DB隔離升級、timezone與expiry-enabled核對，金流與物流另行驗收。


## 里程碑2C：模擬付款

最新demo Flyway包含V1–V7，舊SQL不改。新後端私有設定產生器已提供mock金鑰；已有work/demo.env先於後端根目錄跑 `python3 scripts/init_mock_payment_env.py`，只追加缺少的MOCK_PAYMENTS_ENABLED／MOCK_PAYMENT_WEBHOOK_SECRET，不覆蓋既有值。啟用mock需至少32字元私有金鑰；不放VITE_*，不輸出環境內容。關閉時顧客面板顯示未啟用，callback／模擬建立404。

後端完整DB package包含13項新付款整合与2項gateway單元測試；本輪89項中87通過、2歷史升級marker略過。普通無DB驗證不等於跑過真實付款。先等待正式JAR的auth/csrf回200，再執行 `python3 scripts/smoke_payments.py`；前端匯入相同私有demo環境，執行 `PLAYWRIGHT_MODULE_PATH=/絕對路徑/playwright node scripts/smoke_payments_browser.cjs`。使用隔離可拋棄demo、正式dist與JAR；付款腳本為真正資料寫入，不用假owner／金額／庫存。原始結果／截圖在忽略work/payments-20261007。

顧客登入並下單後，到 `/shop/orders` 建立模擬付款、測試成功或失敗；明示不實收。回應未知就同操作重試／核對，重整後先讀本人訂單與付款。成功訂單不能直接取消；取消／到期後晚到成功只待核對；核對／退款未提供。不要在正式資料或原DB跑smoke。實際金流与HTTPS／物流需另驗收。


## 里程碑3A：員工訂單與模擬配送

最新demo包含V1–V8，V1–V7不改。新的後端設定產生器已包含MOCK_FULFILLMENT_ENABLED=true；已有可信私有work/demo.env，在後端根目錄跑 `python3 scripts/init_fulfillment_env.py`，只補缺開關，不覆蓋已有true／false或憑證。Spring不自動載入env，仍以程序環境提供；非demo／未指定開關預設關閉，模擬寫入404。

員工登入 `/admin/orders`：shop_staff可讀摘要／詳情／audit，shop_admin可操作模擬出貨与送達。需PAID且沒有待核對通知，貨件ID由伺服器產生；不會建立物流託運。顧客 `/shop/orders` 手動核對配送進度。回應未知保留同UUID與body重試，409先重讀，不覆寫或新建另一筆。

正式JAR ready後，後端 `python3 scripts/smoke_fulfillment.py`；前端 `PLAYWRIGHT_MODULE_PATH=/絕對路徑/playwright node scripts/smoke_fulfillment_browser.cjs`，提供同樣可信私有demo.env（含展示員工密碼）與Chromium。腳本只允許loopback、只用可拋棄隔離DB／Redis；操作是真實寫入，含成功後遺失回應與重試。合成訂單／稽核保留，cleanup只取消自建pending、封存自建product，不刪共享歷史。

本輪完整package104項：102通過、2舊升級marker略過；新增14履約整合與1關閉功能測試。production dist／JAR HTTP189／browser140全部通過；重跑結果與截圖留忽略work/fulfillment-20261007，歷史smoke結果仍在各自work階段資料夾。Maven普通未啟用DB測試不代表跑過真實履約；真實退款／物流与本機原資料驗收另列待補。


## 里程碑3B：模擬退款與異常付款核對

最新demo Flyway V1–V9，V1–V8不改。新環境產生器讀.env.example含MOCK_REFUNDS_ENABLED=true；已有可信後端work/demo.env先跑 `python3 scripts/init_refund_env.py`，只补缺開關，不重設憑證／既有false。程序載入可信私有env；非demo／未設定預設false，歷史可讀、退款寫入404。

店長在/admin/orders開啟訂單，填操作說明後選全額模擬退款或待核對付款退款；普通員工只讀。訂單只PAID未出貨、無未處理review可退款並回補；review退款不動庫存。顧客/shop/orders核對本人訂單及各付款的退款金額／時間。原通知與員工audit保留，不轉帳或傳訊。

正式JAR auth/csrf回200，前端production dist／preview就緒後，後端 `python3 scripts/smoke_refunds.py`；前端帶可信相同demo.env與Playwright／Chromium跑 `node scripts/smoke_refunds_browser.cjs`。只用可拋棄loopback MySQL／Redis，寫入合成fixture與失去回應演練；成果在忽略work/refunds-20261007。未知回應重試同ID，重整查order／refunds；不要重新建立另一筆。最新測試數以HANDOFF／退款verification為準，已出貨退貨／正式退款政策仍待補。


## 里程碑3C：已出貨整筆退貨

最新demo Flyway V1–V10，V1–V9不改。已有可信後端work/demo.env跑 `python3 scripts/init_returns_env.py`，只補缺少MOCK_RETURNS_ENABLED=true，不覆蓋false／憑證；新的init_demo_env從.env.example載入。Spring仍需程序環境，未指定預設false。退貨退款同時需MOCK_REFUNDS_ENABLED。以上較早段落為當時完成度，最新以HANDOFF為準。

顧客/shop/orders已出貨訂單填原因提出一次整筆申請；店長/admin/orders填說明、明確選可重新入庫或不回補，再記錄模擬收貨驗收。驗收不動庫存；後續退款依處置回補一次或保持stock。普通員工唯讀；拒絕申請不退款／不回補、恢復無review訂單配送，此demo不重申請。退款保留原配送紀錄，不安排寄送或轉帳。

先等最終JAR auth/csrf回200，production dist／preview就緒，再跑後端 `python3 scripts/smoke_returns.py` 與前端 `PLAYWRIGHT_MODULE_PATH=/絕對路徑/playwright PLAYWRIGHT_CHROMIUM_PATH=/絕對路徑/chromium node scripts/smoke_returns_browser.cjs`。匯入可信私有demo環境；只允許loopback可拋棄DB／Redis，操作是真實合成寫入，包含ACK後abort／同操作重試。原始結果／手機截圖在忽略work/returns-20261007。只取消自己pending／封存fixture、保留sharedledger；不要在正式資料跑。未知結果保留同UUID／body，重整先核對，不建立另一筆。完整驗證及2項歷史marker略過原因見退貨verification／HANDOFF。


## 商品主圖：SeaweedFS

最新demo包含Flyway V1–V11，V1–V10不改。在後端建立可信work/demo.env後，執行 `python3 scripts/init_images_env.py`，只补缺SHOP_IMAGES_*與忽略的私有work/seaweed-s3.json，不重設既有憑證／false。程序仍需載入私有環境，Spring不自動讀檔；前端不可用VITE_*保存S3私鑰。

`docker compose -p elpsy-shop-demo -f docker-compose.demo.yml --profile images up -d`啟動専用MySQL／Redis／SeaweedFS，S3只loopback18333；私有bucket elpsy-shop-images-demo，leveldb2 metadata及物件volume持久。profile不啟用就不啟動SeaweedFS；SHOP_IMAGES_ENABLED預設false，新寫404。演練init-bucket=true可建立缺少bucket，正式預建bucket／最小憑證且init-bucket=false。固定3.85digest、12個128MB小volume為演練；NO_PROXY追加內部seaweed，保留既有HTTP代理。不要把専用資料volume或真實bucket拿來跑清理測試。

員工/admin/products先存草稿或重新載入未存表單，再在商品主圖選5MB以內PNG／JPEG、填替代文字，上傳／替換／移除；兩種員工均可改草稿，店長上架。顧客列表／詳情真實顯示主圖，沒有圖／失敗顯示fallback。主圖使用商品version，上架先下架才改；未知回應凍結並重試同UUID／檔案，重整先讀圖與audit。圖片不改SKU／stock，舊圖及失敗暫存保留至少10分鐘再排程清理；封存商品當前圖保留供員工查核。

最終JAR auth/csrf回200、前端production build與preview ready後，`python3 scripts/smoke_images.py`與`PLAYWRIGHT_MODULE_PATH=/絕對路徑/playwright PLAYWRIGHT_CHROMIUM_PATH=/絕對路徑/chromium node scripts/smoke_images_browser.cjs`。需要相同私有demo環境，真實寫入専用loopbackS3／DB；work/images-20261007保存結果／手機圖，不刪共享ledger。完整Maven實測需額外SHOP_IMAGES_INTEGRATION=true與啟用真實S3，仍需原MySQL／Redisflags。普通無S3測試不能宣稱實際物件驗證。最新版數量／2歴史marker略過見HANDOFF。舊/upload／avatar及任意本地path入口已停用，沒有MinIO新方案或員工頭像上傳。
