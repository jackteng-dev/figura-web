// Production dist -> production API, synthetic loopback data and local MOCK only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs'), crypto = require('node:crypto');
const base = process.env.SHOP_FRONTEND_URL || 'http://127.0.0.1:15176';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Loopback only');
const checks = [], errors = [], products = [], batches = [], orders = [];
function check(name, ok) { if (!ok) throw Error('Check failed: ' + name); checks.push(name); console.log(name); }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, headless: true });
  let customer, staff;
  try {
    customer = await browser.newContext({ viewport: { width: 390, height: 844 } }); staff = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await customer.newPage(), admin = await staff.newPage();
    for (const p of [page, admin]) { p.setDefaultTimeout(20000); p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept()); await p.route('**/*', r => new URL(r.request().url()).hostname === new URL(base).hostname ? r.continue() : r.abort()); }
    async function api(ctx, path, method = 'GET', data, form = false) {
      const headers = method === 'GET' ? {} : { 'X-XSRF-TOKEN': (await (await ctx.request.get(base + '/api/auth/csrf')).json()).data.token };
      const r = await ctx.request.fetch(base + '/api' + path, { method, headers, ...(form ? { form: data } : { data }) }); return { status: r.status(), data: (await r.json()).data };
    }
    async function login(ctx, manager = true) { const r = await api(ctx, '/admin/login', 'POST', { username: manager ? 'shop_admin' : 'shop_staff', password: process.env[manager ? 'DEMO_ADMIN_PASSWORD' : 'DEMO_STAFF_PASSWORD'], deviceId: crypto.randomUUID() }, true); if (r.status !== 200) throw Error('Dedicated staff login failed'); }
    await login(staff);
    const username = 'pre_' + crypto.randomUUID().replaceAll('-', '').slice(0, 20), password = crypto.randomBytes(24).toString('base64url');
    await api(customer, '/customer/auth/register', 'POST', { username, password, displayName: '預購付款UI測試' }); await api(customer, '/customer/auth/login', 'POST', { username, password, deviceId: crypto.randomUUID(), rememberMe: false });
    const aid = crypto.randomUUID(); await api(customer, '/customer/addresses/' + aid, 'PUT', { expectedVersion: 0, recipientName: '合成收件人', phone: '0912345678', postalCode: '100', city: '測試市', district: '測試區', street: '合成路 1 號' });
    async function fixture(qty = 1) {
      let p = (await api(staff, '/admin/products', 'POST', { title: 'Browser preorder money ' + crypto.randomUUID(), brand: 'ELPSY', category: '公仔', description: 'Synthetic', expectedVersion: 0, skus: [{ code: 'PM-' + crypto.randomUUID(), label: '限定款', priceTwd: 1280, enabled: true }] })).data; products.push(p.id);
      p = (await api(staff, '/admin/products/' + p.id + '/publication', 'PATCH', { expectedVersion: p.version, published: true })).data;
      const deadline = new Date(Date.now() + 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z'), arrival = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      let b = (await api(staff, '/admin/preorders', 'POST', { productId: p.id, skuId: p.skus[0].id, name: 'Browser money batch ' + crypto.randomUUID(), description: 'Synthetic', priceTwd: 1800, capacity: 4, deadlineAt: deadline, arrivalFrom: arrival, arrivalTo: arrival, expectedVersion: 0, requestId: crypto.randomUUID(), note: 'Synthetic payment fixture' })).data.current; batches.push(b.id);
      b = (await api(staff, '/admin/preorders/' + b.id + '/open', 'POST', { expectedVersion: b.version, requestId: crypto.randomUUID(), note: 'Synthetic payment fixture' })).data.current;
      const r = await api(customer, '/customer/preorders', 'POST', { requestId: crypto.randomUUID(), batchId: b.id, quantity: qty, addressId: aid, addressVersion: 1, expectedSubtotalTwd: 1800 * qty }); if (r.status !== 201) throw Error('Dedicated preorder fixture failed'); orders.push(r.data.order.id); return { p, b, o: r.data.order };
    }
    const orderPath = id => '/customer/preorders/' + id;
    const staffPath = id => '/admin/preorder-orders/' + id;
    const command = (o, note = 'Browser refund <img src=x onerror=alert(1)>') => ({ requestId: crypto.randomUUID(), expectedOrderVersion: o.version, note });
    const one = await fixture(2);
    const pi = (await api(customer, orderPath(one.o.id) + '/mock-payments', 'POST', { requestId: crypto.randomUUID(), expectedOrderVersion: one.o.version })).data.payment;
    await api(customer, '/customer/preorder-payments/' + pi.id + '/simulate', 'POST', { eventId: crypto.randomUUID(), outcome: 'SUCCESS' });
    const arrivalPath = '/admin/preorder-arrivals/' + one.b.id;
    await admin.goto(base + '/admin/preorder-arrivals'); await admin.getByRole('button', { name: '查看到貨 ' + one.b.id, exact: true }).click(); await admin.getByLabel('本次到貨數量', { exact: true }).fill('2'); await admin.getByLabel('到貨登記原因', { exact: true }).fill('Browser arrival <img src=x onerror=alert(1)>');
    check('真到貨頁可登記且數量初值零', (await api(staff, arrivalPath)).data.supply.receivedQuantity === 0);
    let lose = true, writes = [];
    await admin.route('**/api/admin/preorder-arrivals/*/receive', async r => { writes.push(r.request().postData()); if (lose) { lose = false; await r.fetch(); return r.abort('failed'); } return r.continue(); });
    await admin.getByRole('button', { name: '登記預購到貨', exact: true }).click(); await admin.locator('.preorder-arrivals-admin [role=alert]').filter({ hasText: '尚未確認' }).waitFor();
    check('到貨未知ACK凍結數量原因與重讀', await admin.getByLabel('本次到貨數量', { exact: true }).isDisabled() && await admin.getByLabel('到貨登記原因', { exact: true }).isDisabled() && await admin.getByRole('button', { name: '重讀到貨資料', exact: true }).isDisabled());
    await admin.getByRole('button', { name: '重試原到貨操作', exact: true }).click(); await admin.locator('.preorder-arrivals-admin [role=status]').filter({ hasText: '原到貨操作已核對' }).waitFor();
    let arrival = (await api(staff, arrivalPath)).data; check('到貨原UUID/body重播僅一次', writes.length === 2 && writes[0] === writes[1] && arrival.supply.receivedQuantity === 2 && arrival.events.length === 1);
    await admin.unroute('**/api/admin/preorder-arrivals/*/receive'); await admin.locator('.arrival-detail details').first().click(); check('到貨原因HTML純文字', await admin.locator('.arrival-detail img').count() === 0 && (await admin.locator('.arrival-detail').innerText()).includes('<img src=x onerror=alert(1)>'));
    async function open(id) { await admin.goto(base + '/admin/preorder-orders'); await admin.getByRole('button', { name: '查看 ' + id, exact: true }).click(); await admin.getByLabel('到貨與履約原因', { exact: true }).waitFor(); }
    await open(one.o.id); await admin.getByLabel('到貨與履約原因', { exact: true }).fill('Browser whole allocation');
    check('已到貨訂單可整筆分配但出貨仍禁用', await admin.getByRole('button', { name: '整筆分配預購到貨', exact: true }).isEnabled() && await admin.getByRole('button', { name: '模擬預購出貨', exact: true }).isDisabled());
    lose = true; const allocations = [];
    await admin.route('**/api/admin/preorder-orders/*/allocate', async r => { allocations.push(r.request().postData()); if (lose) { lose = false; await r.fetch(); return r.abort('failed'); } return r.continue(); });
    await admin.getByRole('button', { name: '整筆分配預購到貨', exact: true }).click(); await admin.locator('.preorder-orders-admin [role=alert]').filter({ hasText: '尚未確認' }).waitFor();
    check('分配未知ACK凍結退款與履約原因', await admin.getByRole('button', { name: '模擬預購整筆退款', exact: true }).isDisabled() && await admin.getByLabel('到貨與履約原因', { exact: true }).isDisabled());
    await admin.getByRole('button', { name: '重試原到貨履約操作', exact: true }).click(); await admin.locator('.preorder-orders-admin [role=status]').filter({ hasText: '原到貨履約操作已核對' }).waitFor();
    let d = (await api(staff, staffPath(one.o.id))).data; check('分配原UUID/body僅一次且禁用未到貨退款', allocations.length === 2 && allocations[0] === allocations[1] && d.order.fulfillment.allocatedQuantity === 2 && !d.canRefund && d.fulfillment.events.length === 1);
    await admin.unroute('**/api/admin/preorder-orders/*/allocate'); await admin.getByLabel('到貨與履約原因', { exact: true }).fill('Browser ship'); lose = true; const ships = [];
    await admin.route('**/api/admin/preorder-orders/*/mock-ship', async r => { ships.push(r.request().postData()); if (lose) { lose = false; await r.fetch(); return r.abort('failed'); } return r.continue(); });
    await admin.getByRole('button', { name: '模擬預購出貨', exact: true }).click(); await admin.locator('.preorder-orders-admin [role=alert]').filter({ hasText: '尚未確認' }).waitFor();
    check('出貨未知ACK禁止其他操作', await admin.getByRole('button', { name: '重讀資料', exact: true }).isDisabled() && await admin.getByRole('button', { name: '模擬預購送達', exact: true }).isDisabled());
    await admin.getByRole('button', { name: '重試原到貨履約操作', exact: true }).click(); await admin.locator('.preorder-orders-admin [role=status]').filter({ hasText: '原到貨履約操作已核對' }).waitFor();
    d = (await api(staff, staffPath(one.o.id))).data; check('出貨原UUID/body減到貨在庫一次', ships.length === 2 && ships[0] === ships[1] && d.order.fulfillmentStatus === 'SHIPPED' && d.fulfillment.supply.shippedQuantity === 2 && d.fulfillment.supply.onHandQuantity === 0);
    await admin.unroute('**/api/admin/preorder-orders/*/mock-ship'); await admin.getByLabel('到貨與履約原因', { exact: true }).fill('Browser deliver'); let failRead = false, posts = 0;
    await admin.route('**/api/admin/preorder-orders/*/mock-deliver', async r => { posts++; const response = await r.fetch(); failRead = true; return r.fulfill({ response }); });
    await admin.route('**/api/admin/preorder-orders?*', r => failRead ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"code":1,"message":"synthetic read failure"}' }) : r.continue());
    await admin.getByRole('button', { name: '模擬預購送達', exact: true }).click(); await admin.locator('.preorder-orders-admin [role=alert]').filter({ hasText: '履約已確認' }).waitFor();
    check('送達ACK後GET失敗只讀不重送', posts === 1 && await admin.getByRole('button', { name: '重試原到貨履約操作', exact: true }).count() === 0);
    failRead = false; await admin.getByRole('button', { name: '重讀資料', exact: true }).click(); await admin.waitForFunction(() => ![...document.querySelectorAll('.preorder-orders-admin [role=status]')].some(x => x.textContent.includes('處理中'))); check('讀取恢復不再POST', posts === 1); await admin.unroute('**/api/admin/preorder-orders?*'); await admin.unroute('**/api/admin/preorder-orders/*/mock-deliver');
    await page.goto(base + '/shop/preorder-orders'); const card = page.locator(`[data-order-id="${one.o.id}"]`); await card.getByText(/已模擬送達/).waitFor();
    check('顧客本人顯示分配貨件及送達安全進度', (await card.innerText()).includes('已分配到貨：2 件') && !(await card.innerText()).includes('Browser ship') && (await card.innerText()).includes('mock_pre_'));
    fs.mkdirSync('work/preorder-fulfillment-20261007', { recursive: true }); await page.screenshot({ path: 'work/preorder-fulfillment-20261007/customer-delivered-mobile.png', fullPage: true }); check('390px顧客履約無document溢出', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const two = await fixture(); const p2 = (await api(customer, orderPath(two.o.id) + '/mock-payments', 'POST', { requestId: crypto.randomUUID(), expectedOrderVersion: two.o.version })).data.payment; await api(customer, '/customer/preorder-payments/' + p2.id + '/simulate', 'POST', { eventId: crypto.randomUUID(), outcome: 'SUCCESS' });
    const path2 = '/admin/preorder-arrivals/' + two.b.id; arrival = (await api(staff, path2)).data; await api(staff, path2 + '/receive', 'POST', { requestId: crypto.randomUUID(), expectedBatchVersion: arrival.supply.version, quantity: 1, note: 'Synthetic supply' });
    await open(two.o.id); await admin.getByLabel('到貨與履約原因', { exact: true }).fill('保留未送分配原因'); d = (await api(staff, staffPath(two.o.id))).data; await api(staff, staffPath(two.o.id) + '/mock-refund', 'POST', command(d.order, 'External refund race'));
    await admin.getByRole('button', { name: '整筆分配預購到貨', exact: true }).click(); await admin.locator('.preorder-orders-admin [role=alert]').filter({ hasText: '版本已變更' }).waitFor();
    check('退款競爭409保留分配原因並禁送', await admin.getByLabel('到貨與履約原因', { exact: true }).inputValue() === '保留未送分配原因' && await admin.getByRole('button', { name: '整筆分配預購到貨', exact: true }).isDisabled());
    await admin.getByRole('button', { name: '重讀資料', exact: true }).click(); await admin.getByRole('button', { name: '重新開啟此訂單', exact: true }).click(); await admin.getByLabel('到貨與履約原因', { exact: true }).fill('仍不可分配'); check('重讀明確重開仍拒絕退款訂單分配', await admin.getByRole('button', { name: '整筆分配預購到貨', exact: true }).isDisabled());
    await admin.setViewportSize({ width: 390, height: 844 }); await open(one.o.id); await admin.screenshot({ path: 'work/preorder-fulfillment-20261007/staff-delivered-mobile.png', fullPage: true }); check('390px員工履約無document溢出', await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await login(staff, false); await admin.goto(base + '/admin/preorder-arrivals'); await admin.getByRole('button', { name: '查看到貨 ' + one.b.id, exact: true }).click(); await admin.getByText('目前為唯讀，不能登記到貨。', { exact: true }).waitFor(); check('普通員工可讀到貨但沒有登記表單', await admin.getByLabel('本次到貨數量', { exact: true }).count() === 0);
    await admin.goto(base + '/admin/preorder-orders'); await admin.getByRole('button', { name: '查看 ' + one.o.id, exact: true }).click(); await admin.getByText('目前為唯讀，不能執行預購退款或核對。', { exact: true }).waitFor(); check('普通員工無分配出貨送達按鈕', await admin.getByRole('button', { name: '整筆分配預購到貨', exact: true }).count() === 0 && await admin.getByRole('button', { name: '模擬預購出貨', exact: true }).count() === 0 && await admin.getByRole('button', { name: '模擬預購送達', exact: true }).count() === 0);
    check('無未捕捉JS錯誤', errors.length === 0); fs.writeFileSync('work/preorder-fulfillment-20261007/browser-preorder_fulfillment.json', JSON.stringify({ passed: checks.length, checks }, null, 2));
  } finally {
    if (staff && customer) {
      const token = (await (await staff.request.get(base + '/api/auth/csrf')).json()).data.token;
      await staff.request.post(base + '/api/admin/login', { headers: { 'X-XSRF-TOKEN': token }, form: { username: 'shop_admin', password: process.env.DEMO_ADMIN_PASSWORD, deviceId: crypto.randomUUID() } });
      const t = (await (await staff.request.get(base + '/api/auth/csrf')).json()).data.token;
      for (const id of orders) {
        let d = (await (await staff.request.get(base + '/api/admin/preorder-orders/' + id)).json()).data;
        for (const review of d.reviews) if (!review.refunded) { await staff.request.post(base + '/api/admin/preorder-orders/' + id + '/mock-review-refund/' + review.paymentId, { headers: { 'X-XSRF-TOKEN': t }, data: { requestId: crypto.randomUUID(), expectedOrderVersion: d.order.version, note: 'Own browser fixture cleanup' } }); d = (await (await staff.request.get(base + '/api/admin/preorder-orders/' + id)).json()).data; }
        if (d.order.arrivalStatus === 'ARRIVED') {
          for (const action of ['ship', 'deliver']) { d = (await (await staff.request.get(base + '/api/admin/preorder-orders/' + id)).json()).data; if ((action === 'ship' && d.order.fulfillmentStatus === 'UNFULFILLED') || (action === 'deliver' && d.order.fulfillmentStatus === 'SHIPPED')) await staff.request.post(base + '/api/admin/preorder-orders/' + id + '/mock-' + action, { headers: { 'X-XSRF-TOKEN': t }, data: { requestId: crypto.randomUUID(), expectedOrderVersion: d.order.version, note: 'Own browser cleanup' } }); }
        }
        if (d.order.status === 'PAID' && d.order.arrivalStatus === 'NOT_ARRIVED') await staff.request.post(base + '/api/admin/preorder-orders/' + id + '/mock-refund', { headers: { 'X-XSRF-TOKEN': t }, data: { requestId: crypto.randomUUID(), expectedOrderVersion: d.order.version, note: 'Own browser fixture cleanup' } });
        if (d.order.status === 'PENDING') { const c = (await (await customer.request.get(base + '/api/auth/csrf')).json()).data.token; await customer.request.post(base + '/api/customer/preorders/' + id + '/cancel', { headers: { 'X-XSRF-TOKEN': c }, data: { requestId: crypto.randomUUID(), expectedVersion: d.order.version } }); }
      }
      for (const id of batches) { const b = (await (await staff.request.get(base + '/api/admin/preorders/' + id)).json()).data.batch; if (b.status !== 'CLOSED') await staff.request.post(base + '/api/admin/preorders/' + id + '/close', { headers: { 'X-XSRF-TOKEN': t }, data: { requestId: crypto.randomUUID(), expectedVersion: b.version, note: 'Own browser fixture cleanup' } }); }
      for (const id of products) { let p = (await (await staff.request.get(base + '/api/admin/products/' + id)).json()).data; if (p.status === 'PUBLISHED') p = (await (await staff.request.patch(base + '/api/admin/products/' + id + '/publication', { headers: { 'X-XSRF-TOKEN': t }, data: { expectedVersion: p.version, published: false } })).json()).data; if (p.status === 'DRAFT') await staff.request.delete(base + '/api/admin/products/' + id + '?expectedVersion=' + p.version, { headers: { 'X-XSRF-TOKEN': t } }); }
    }
    if (staff) await staff.close(); if (customer) await customer.close(); await browser.close();
  }
})().catch(e => { console.error(String(e.message).slice(0, 300)); console.error(String(e.stack).split('\n').filter(x => x.includes('smoke_preorder_fulfillment_browser.cjs:')).join('\n')); process.exit(1); });
