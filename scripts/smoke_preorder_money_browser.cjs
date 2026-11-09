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
    await page.goto(base + '/shop/preorder-orders'); let card = page.locator(`[data-order-id="${one.o.id}"]`), panel = card.locator('.preorder-payment-panel');
    await panel.getByRole('button', { name: '建立預購模擬付款', exact: true }).waitFor();
    check('預購本人頁有獨立付款面板', await panel.getByRole('heading', { name: '預購付款模擬', exact: true }).isVisible() && await card.locator('.mock-payment-panel').count() === 0);
    let lose = true, writes = [];
    await page.route('**/api/customer/preorders/*/mock-payments', async r => { if (r.request().method() !== 'POST') return r.continue(); writes.push(r.request().postData()); if (lose) { lose = false; await r.fetch(); return r.abort('failed'); } return r.continue(); });
    await panel.getByRole('button', { name: '建立預購模擬付款', exact: true }).click(); await panel.getByRole('alert').filter({ hasText: '尚未確認' }).waitFor();
    check('建立未知ACK凍結取消與重讀', await card.getByRole('button', { name: '取消預購', exact: true }).isDisabled() && await page.getByRole('button', { name: '重新載入', exact: true }).isDisabled());
    await panel.getByRole('button', { name: '重試原預購付款建立', exact: true }).click(); await panel.getByRole('status').filter({ hasText: '已建立' }).waitFor();
    let opts = (await api(customer, orderPath(one.o.id) + '/mock-payments')).data;
    check('建立同UUID/body僅一筆付款', writes.length === 2 && writes[0] === writes[1] && opts.items.length === 1);
    await page.unroute('**/api/customer/preorders/*/mock-payments');
    await panel.getByRole('button', { name: '模擬預購付款失敗', exact: true }).click(); await panel.getByRole('status').filter({ hasText: '模擬付款失敗' }).waitFor();
    await panel.getByRole('button', { name: '建立預購模擬付款', exact: true }).waitFor();
    check('失敗UI可在期限內重建付款', await panel.getByRole('button', { name: '建立預購模擬付款', exact: true }).isVisible());
    let failRead = false, startPosts = 0;
    await page.route('**/api/customer/preorders/*/mock-payments', async r => { if (r.request().method() === 'POST') { startPosts++; const response = await r.fetch(); failRead = true; return r.fulfill({ response }); } return failRead ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"code":1,"message":"synthetic read failure"}' }) : r.continue(); });
    await panel.getByRole('button', { name: '建立預購模擬付款', exact: true }).click(); await panel.getByRole('alert').filter({ hasText: '建立已確認' }).waitFor();
    check('建立ACK後GET失敗清pending且只重讀', startPosts === 1 && await panel.getByRole('button', { name: '重試原預購付款建立', exact: true }).count() === 0 && await panel.getByRole('button', { name: '建立預購模擬付款', exact: true }).isDisabled());
    failRead = false; await panel.getByRole('button', { name: '核對預購付款', exact: true }).click(); await panel.getByRole('button', { name: '模擬預購付款成功', exact: true }).waitFor(); await page.unroute('**/api/customer/preorders/*/mock-payments');
    check('建立ACK後不重POST', startPosts === 1);
    lose = true; const notices = [];
    await page.route('**/api/customer/preorder-payments/*/simulate', async r => { notices.push(r.request().postData()); if (lose) { lose = false; await r.fetch(); return r.abort('failed'); } return r.continue(); });
    await panel.getByRole('button', { name: '模擬預購付款成功', exact: true }).click(); await panel.getByRole('alert').filter({ hasText: '尚未確認' }).waitFor();
    check('付款通知未知ACK鎖定取消', await card.getByRole('button', { name: '取消預購', exact: true }).isDisabled());
    await panel.getByRole('button', { name: '重試原預購付款通知', exact: true }).click(); await panel.getByRole('status').filter({ hasText: '模擬付款成功' }).waitFor();
    const paid = (await api(customer, orderPath(one.o.id))).data, batch = (await api(staff, '/admin/preorders/' + one.b.id)).data.batch;
    check('通知同event/body重播只移轉配額一次', notices.length === 2 && notices[0] === notices[1] && paid.status === 'PAID' && batch.heldQuantity === 0 && batch.paidQuantity === 2);
    check('已付款UI取消入口關閉', await card.getByRole('button', { name: '取消預購', exact: true }).count() === 0);
    await page.unroute('**/api/customer/preorder-payments/*/simulate');
    fs.mkdirSync('work/preorder-money-20261007', { recursive: true }); await page.screenshot({ path: 'work/preorder-money-20261007/customer-paid-mobile.png', fullPage: true }); check('390px預購付款頁無水平溢出', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    async function open(id) { await admin.goto(base + '/admin/preorder-orders'); await admin.getByRole('button', { name: '查看 ' + id, exact: true }).waitFor(); await admin.getByRole('button', { name: '查看 ' + id, exact: true }).click(); await admin.locator('.preorder-order-detail').getByText(id, { exact: false }).first().waitFor(); }
    await open(one.o.id); check('員工真預購詳情與退款入口', await admin.getByRole('button', { name: '模擬預購整筆退款', exact: true }).isVisible());
    await admin.getByLabel('退款核對原因', { exact: true }).fill('Browser refund <img src=x onerror=alert(1)>'); lose = true; const refunds = [];
    await admin.route('**/api/admin/preorder-orders/*/mock-refund', async r => { refunds.push(r.request().postData()); if (lose) { lose = false; await r.fetch(); return r.abort('failed'); } return r.continue(); });
    await admin.getByRole('button', { name: '模擬預購整筆退款', exact: true }).click(); await admin.locator('.preorder-orders-admin').getByRole('alert').filter({ hasText: '尚未確認' }).waitFor();
    check('退款未知ACK凍結原因與重讀', await admin.getByLabel('退款核對原因', { exact: true }).isDisabled() && await admin.getByRole('button', { name: '重讀資料', exact: true }).isDisabled());
    await admin.getByRole('button', { name: '重試原退款操作', exact: true }).click(); await admin.getByRole('status').filter({ hasText: '原退款操作已核對' }).waitFor();
    let detail = (await api(staff, staffPath(one.o.id))).data;
    check('退款原UUID/body僅一筆audit與配額釋放', refunds.length === 2 && refunds[0] === refunds[1] && detail.order.status === 'REFUNDED' && detail.refunds.length === 1 && (await api(staff, '/admin/preorders/' + one.b.id)).data.batch.paidQuantity === 0);
    await admin.unroute('**/api/admin/preorder-orders/*/mock-refund'); await admin.locator('.preorder-order-detail details').first().click();
    check('內部原因純文字不執行HTML', await admin.locator('.preorder-order-detail img').count() === 0 && (await admin.locator('.preorder-order-detail').innerText()).includes('<img src=x onerror=alert(1)>'));
    await panel.getByRole('button', { name: '核對預購付款', exact: true }).click(); await panel.getByText('已模擬退款', { exact: true }).waitFor(); check('顧客看到safe模擬退款而無staff note', !(await card.innerText()).includes('Browser refund'));
    const two = await fixture(); const pi = (await api(customer, orderPath(two.o.id) + '/mock-payments', 'POST', { requestId: crypto.randomUUID(), expectedOrderVersion: two.o.version })).data.payment;
    await api(customer, orderPath(two.o.id) + '/cancel', 'POST', { requestId: crypto.randomUUID(), expectedVersion: two.o.version }); await page.reload(); const lateCard = page.locator(`[data-order-id="${two.o.id}"]`), latePanel = lateCard.locator('.preorder-payment-panel');
    await latePanel.getByRole('button', { name: '模擬預購付款成功', exact: true }).click(); await latePanel.getByRole('status').filter({ hasText: '待核對' }).waitFor();
    check('晚到成功UI不復活訂單與quota', (await api(customer, orderPath(two.o.id))).data.status === 'CANCELLED' && (await api(staff, '/admin/preorders/' + two.b.id)).data.batch.heldQuantity === 0);
    await open(two.o.id); await admin.getByLabel('退款核對原因', { exact: true }).fill('保留未送核對原因'); detail = (await api(staff, staffPath(two.o.id))).data;
    check('詳情保留原晚到成功證據', detail.reviews[0].evidence.some(e => e.outcome === 'SUCCESS' && e.disposition === 'REVIEW_REQUIRED'));
    await api(staff, staffPath(two.o.id) + '/mock-review-refund/' + pi.id, 'POST', command(detail.order, '外部核對演練'));
    await admin.getByRole('button', { name: '模擬預購核對退款 ' + pi.id, exact: true }).click(); await admin.locator('.preorder-orders-admin').getByRole('alert').filter({ hasText: '版本已變更' }).waitFor();
    check('409保留原因與禁送不自動覆寫', await admin.getByLabel('退款核對原因', { exact: true }).inputValue() === '保留未送核對原因' && await admin.getByRole('button', { name: '模擬預購核對退款 ' + pi.id, exact: true }).isDisabled());
    await admin.getByRole('button', { name: '重讀資料', exact: true }).click(); await admin.getByRole('button', { name: '重新開啟此訂單', exact: true }).click(); await admin.getByLabel('退款核對原因', { exact: true }).waitFor();
    check('重讀後明確重開顯示已核對', (await admin.locator('.preorder-order-detail').innerText()).includes('已核對退款') && await admin.getByRole('button', { name: '模擬預購核對退款 ' + pi.id, exact: true }).count() === 0);
    const three = await fixture(); const p3 = (await api(customer, orderPath(three.o.id) + '/mock-payments', 'POST', { requestId: crypto.randomUUID(), expectedOrderVersion: three.o.version })).data.payment; await api(customer, '/customer/preorder-payments/' + p3.id + '/simulate', 'POST', { eventId: crypto.randomUUID(), outcome: 'SUCCESS' }); await open(three.o.id); await admin.getByLabel('退款核對原因', { exact: true }).fill('ACK後只讀演練'); let posts = 0; failRead = false;
    await admin.route('**/api/admin/preorder-orders/*/mock-refund', async r => { posts++; const response = await r.fetch(); failRead = true; return r.fulfill({ response }); });
    await admin.route('**/api/admin/preorder-orders?*', r => failRead ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"code":1,"message":"synthetic read failure"}' }) : r.continue());
    await admin.getByRole('button', { name: '模擬預購整筆退款', exact: true }).click(); await admin.locator('.preorder-orders-admin').getByRole('alert').filter({ hasText: '退款已確認' }).waitFor();
    check('退款ACK後GET故障清pending不重送', posts === 1 && await admin.getByRole('button', { name: '重試原退款操作', exact: true }).count() === 0);
    failRead = false; await admin.getByRole('button', { name: '重讀資料', exact: true }).click(); await admin.waitForFunction(() => ![...document.querySelectorAll('.preorder-orders-admin [role=status]')].some(x => x.textContent.includes('處理中'))); check('ACK後重讀不再POST', posts === 1); await admin.unroute('**/api/admin/preorder-orders/*/mock-refund'); await admin.unroute('**/api/admin/preorder-orders?*');
    await admin.setViewportSize({ width: 390, height: 844 }); await admin.waitForFunction(() => ![...document.querySelectorAll('.preorder-orders-admin [role=status]')].some(x => x.textContent.includes('處理中'))); check('手機表格操作欄不擠成逐字高行', await admin.locator('.preorder-orders-admin tbody tr').evaluateAll(rows => rows.every(r => r.getBoundingClientRect().height < 260))); await admin.screenshot({ path: 'work/preorder-money-20261007/staff-refund-mobile.png', fullPage: true }); check('390px退款詳情無document溢出', await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await login(staff, false); await open(one.o.id); check('普通員工唯讀可核對但無退款操作', await admin.getByText('目前為唯讀，不能執行預購退款或核對。', { exact: true }).isVisible() && await admin.getByRole('button', { name: '模擬預購整筆退款', exact: true }).count() === 0 && await admin.getByLabel('退款核對原因', { exact: true }).count() === 0);
    check('無未捕捉JS錯誤', errors.length === 0);
    fs.writeFileSync('work/preorder-money-20261007/browser-preorder_money.json', JSON.stringify({ passed: checks.length, checks }, null, 2));
  } finally {
    if (staff && customer) {
      const token = (await (await staff.request.get(base + '/api/auth/csrf')).json()).data.token;
      await staff.request.post(base + '/api/admin/login', { headers: { 'X-XSRF-TOKEN': token }, form: { username: 'shop_admin', password: process.env.DEMO_ADMIN_PASSWORD, deviceId: crypto.randomUUID() } });
      const t = (await (await staff.request.get(base + '/api/auth/csrf')).json()).data.token;
      for (const id of orders) {
        let d = (await (await staff.request.get(base + '/api/admin/preorder-orders/' + id)).json()).data;
        for (const review of d.reviews) if (!review.refunded) { await staff.request.post(base + '/api/admin/preorder-orders/' + id + '/mock-review-refund/' + review.paymentId, { headers: { 'X-XSRF-TOKEN': t }, data: { requestId: crypto.randomUUID(), expectedOrderVersion: d.order.version, note: 'Own browser fixture cleanup' } }); d = (await (await staff.request.get(base + '/api/admin/preorder-orders/' + id)).json()).data; }
        if (d.order.status === 'PAID') await staff.request.post(base + '/api/admin/preorder-orders/' + id + '/mock-refund', { headers: { 'X-XSRF-TOKEN': t }, data: { requestId: crypto.randomUUID(), expectedOrderVersion: d.order.version, note: 'Own browser fixture cleanup' } });
        if (d.order.status === 'PENDING') { const c = (await (await customer.request.get(base + '/api/auth/csrf')).json()).data.token; await customer.request.post(base + '/api/customer/preorders/' + id + '/cancel', { headers: { 'X-XSRF-TOKEN': c }, data: { requestId: crypto.randomUUID(), expectedVersion: d.order.version } }); }
      }
      for (const id of batches) { const b = (await (await staff.request.get(base + '/api/admin/preorders/' + id)).json()).data.batch; if (b.status !== 'CLOSED') await staff.request.post(base + '/api/admin/preorders/' + id + '/close', { headers: { 'X-XSRF-TOKEN': t }, data: { requestId: crypto.randomUUID(), expectedVersion: b.version, note: 'Own browser fixture cleanup' } }); }
      for (const id of products) { let p = (await (await staff.request.get(base + '/api/admin/products/' + id)).json()).data; if (p.status === 'PUBLISHED') p = (await (await staff.request.patch(base + '/api/admin/products/' + id + '/publication', { headers: { 'X-XSRF-TOKEN': t }, data: { expectedVersion: p.version, published: false } })).json()).data; if (p.status === 'DRAFT') await staff.request.delete(base + '/api/admin/products/' + id + '?expectedVersion=' + p.version, { headers: { 'X-XSRF-TOKEN': t } }); }
    }
    if (staff) await staff.close(); if (customer) await customer.close(); await browser.close();
  }
})().catch(e => { console.error(String(e.message).slice(0, 300)); console.error(String(e.stack).split('\n').filter(x => x.includes('smoke_preorder_money_browser.cjs:')).join('\n')); process.exit(1); });
