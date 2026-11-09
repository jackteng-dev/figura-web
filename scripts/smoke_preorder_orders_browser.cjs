// Real production UI -> production API. Synthetic loopback fixtures only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs'), crypto = require('node:crypto');
const base = process.env.SHOP_FRONTEND_URL || 'http://127.0.0.1:15176';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Loopback only');
const checks = [], errors = [], products = [], batches = [];
function check(name, ok) { if (!ok) throw Error('Check failed: ' + name); checks.push(name); console.log(name); }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, headless: true });
  let ctx, staff;
  try {
    staff = await browser.newContext(); ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', r => new URL(r.request().url()).hostname === new URL(base).hostname ? r.continue() : r.abort());
    async function api(context, path, method = 'GET', data) {
      const headers = method === 'GET' ? {} : { 'X-XSRF-TOKEN': (await (await context.request.get(base + '/api/auth/csrf')).json()).data.token };
      const r = await context.request.fetch(base + '/api' + path, { method, headers, data }); return { status: r.status(), data: (await r.json()).data };
    }
    const csrf = (await (await staff.request.get(base + '/api/auth/csrf')).json()).data.token;
    check('隔離管理員登入', (await staff.request.post(base + '/api/admin/login', { headers: { 'X-XSRF-TOKEN': csrf }, form: { username: 'shop_admin', password: process.env.DEMO_ADMIN_PASSWORD, deviceId: crypto.randomUUID() } })).status() === 200);
    const username = 'pre_' + crypto.randomUUID().replaceAll('-', '').slice(0, 20), password = crypto.randomBytes(24).toString('base64url');
    check('合成顧客建立', (await api(ctx, '/customer/auth/register', 'POST', { username, password, displayName: '預購UI測試' })).status === 201);
    await page.goto(base + '/shop/preorders/' + crypto.randomUUID() + '/checkout'); await page.waitForURL('**/shop/login');
    check('預購結帳需本人登入', await page.getByRole('heading', { name: '顧客登入', exact: true }).isVisible());
    await page.getByLabel('顧客帳號', { exact: true }).fill(username); await page.getByLabel('密碼', { exact: true }).fill(password); await page.getByRole('button', { name: '登入會員', exact: true }).click(); await page.waitForURL('**/shop/account');
    const aid = crypto.randomUUID(), address = { expectedVersion: 0, recipientName: '合成收件人', phone: '0912345678', postalCode: '100', city: '測試市', district: '測試區', street: '合成路 1 號' };
    check('本人地址建立', (await api(ctx, '/customer/addresses/' + aid, 'PUT', address)).status === 200);
    async function fixture(capacity = 5) {
      let p = (await api(staff, '/admin/products', 'POST', { title: 'Preorder order browser ' + crypto.randomUUID(), brand: 'ELPSY', category: '公仔', description: 'Synthetic', expectedVersion: 0, skus: [{ code: 'PO-' + crypto.randomUUID(), label: '限定款', priceTwd: 1280, enabled: true }] })).data; products.push(p.id);
      p = (await api(staff, '/admin/products/' + p.id + '/publication', 'PATCH', { expectedVersion: p.version, published: true })).data;
      const deadline = new Date(Date.now() + 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z'), arrival = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      let b = (await api(staff, '/admin/preorders', 'POST', { productId: p.id, skuId: p.skus[0].id, name: 'Browser order batch ' + crypto.randomUUID(), description: '<img src=x onerror=alert(1)>', priceTwd: 1800, capacity, deadlineAt: deadline, arrivalFrom: arrival, arrivalTo: arrival, expectedVersion: 0, requestId: crypto.randomUUID(), note: 'Synthetic preorder checkout' })).data.current; batches.push(b.id);
      b = (await api(staff, '/admin/preorders/' + b.id + '/open', 'POST', { expectedVersion: b.version, requestId: crypto.randomUUID(), note: 'Synthetic preorder checkout' })).data.current; return { p, b };
    }
    async function open(b) { await page.goto(base + '/shop/preorders/' + b.id + '/checkout'); await page.getByRole('heading', { name: b.name, exact: true }).waitFor(); await page.waitForFunction(() => !document.querySelector('fieldset')?.disabled); }
    async function listReady() { await page.waitForFunction(() => ![...document.querySelectorAll('.my-preorders [role=status]')].some(x => x.textContent.includes('處理中'))); }
    const first = await fixture(); await open(first.b); await page.getByLabel('預購數量', { exact: true }).fill('2');
    check('真結帳價格與地址選單', await page.getByLabel('收件地址', { exact: true }).inputValue() === aid && (await page.locator('form').innerText()).includes('3,600'));
    fs.mkdirSync('work/preorder-orders-20261007', { recursive: true }); await page.screenshot({ path: 'work/preorder-orders-20261007/checkout-mobile.png', fullPage: true });
    check('390px結帳沒有水平溢出', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const writes = []; let lose = true;
    await page.route('**/api/customer/preorders', async r => { if (r.request().method() !== 'POST') return r.continue(); writes.push(r.request().postData()); if (lose) { lose = false; await r.fetch(); return r.abort('failed'); } return r.continue(); });
    await page.getByRole('button', { name: '確認預購並保留配額', exact: true }).click(); await page.getByRole('alert').filter({ hasText: '尚未確認' }).waitFor();
    check('丟失下單ACK凍結數量地址與重讀', await page.getByLabel('預購數量').isDisabled() && await page.getByLabel('收件地址', { exact: true }).isDisabled() && await page.getByRole('button', { name: '重新載入並核對', exact: true }).isDisabled());
    await page.getByRole('button', { name: '重試原下單操作', exact: true }).click(); await page.getByRole('heading', { name: '預購訂單已建立', exact: true }).waitFor();
    let own = (await api(ctx, '/customer/preorders')).data.items; let order = own.find(o => o.batchId === first.b.id);
    check('原UUID/body重試僅一筆訂單', writes.length === 2 && writes[0] === writes[1] && own.filter(o => o.batchId === first.b.id).length === 1 && order.quantity === 2);
    check('下單成功顯示伺服器保留期限', (await page.locator('.summary').innerText()).includes('保留期限') && order.expiresAt.endsWith('+08:00'));
    await page.unroute('**/api/customer/preorders'); await page.getByRole('link', { name: '查看我的預購', exact: true }).click(); await page.locator(`[data-order-id="${order.id}"]`).waitFor(); await listReady();
    const cancels = []; lose = true;
    await page.route('**/api/customer/preorders/*/cancel', async r => { cancels.push(r.request().postData()); if (lose) { lose = false; await r.fetch(); return r.abort('failed'); } return r.continue(); });
    await page.locator(`[data-order-id="${order.id}"]`).getByRole('button', { name: '取消預購', exact: true }).click(); await page.getByRole('alert').filter({ hasText: '尚未確認' }).waitFor();
    check('取消未知ACK鎖定其他操作', await page.getByRole('button', { name: '重新載入', exact: true }).isDisabled() && await page.getByRole('button', { name: '取消預購', exact: true }).isDisabled());
    await page.getByRole('button', { name: '重試原取消操作', exact: true }).click(); await page.getByRole('status').filter({ hasText: '預購已取消' }).waitFor(); await listReady();
    order = (await api(ctx, '/customer/preorders/' + order.id)).data;
    check('取消原UUID/body重試只釋放一次', cancels.length === 2 && cancels[0] === cancels[1] && order.status === 'CANCELLED' && (await api(staff, '/admin/preorders/' + first.b.id)).data.batch.heldQuantity === 0);
    await page.unroute('**/api/customer/preorders/*/cancel');
    check('預購頁沒有現貨付款入口', await page.locator('.mock-payment-panel').count() === 0 && await page.getByText('預購付款與退款為模擬，不會實際收款或轉帳。', { exact: false }).isVisible());
    const second = await fixture(); await open(second.b); await page.getByLabel('預購數量').fill('2');
    await api(ctx, '/customer/addresses/' + aid, 'PUT', { ...address, expectedVersion: 1, recipientName: '更新後收件人' });
    await page.getByRole('button', { name: '確認預購並保留配額', exact: true }).click(); await page.getByRole('alert').filter({ hasText: '地址已變更' }).waitFor();
    check('地址409保留數量並要求重讀', await page.getByLabel('預購數量').inputValue() === '2' && await page.getByRole('button', { name: '確認預購並保留配額', exact: true }).isDisabled());
    await page.getByRole('button', { name: '重新載入並核對', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('fieldset')?.disabled); await page.getByRole('button', { name: '確認預購並保留配額', exact: true }).click(); await page.getByRole('heading', { name: '預購訂單已建立', exact: true }).waitFor();
    own = (await api(ctx, '/customer/preorders')).data.items; order = own.find(o => o.batchId === second.b.id);
    check('明確重送取最新地址快照', order.shipping.recipientName === '更新後收件人' && order.quantity === 2);
    await page.getByRole('link', { name: '查看我的預購', exact: true }).click(); await page.locator(`[data-order-id="${order.id}"]`).waitFor(); await listReady();
    let cancelPosts = 0, failRead = false;
    await page.route('**/api/customer/preorders/*/cancel', async r => { cancelPosts++; const response = await r.fetch(); failRead = true; return r.fulfill({ response }); });
    await page.route('**/api/customer/preorders?*', r => failRead ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"code":1,"message":"synthetic read failure"}' }) : r.continue());
    await page.locator(`[data-order-id="${order.id}"]`).getByRole('button', { name: '取消預購', exact: true }).click(); await page.getByRole('alert').filter({ hasText: '取消已確認' }).waitFor();
    check('取消ACK後GET故障只重讀', cancelPosts === 1 && await page.getByRole('button', { name: '重試原取消操作', exact: true }).count() === 0 && await page.getByRole('button', { name: '取消預購', exact: true }).isDisabled());
    failRead = false; await page.getByRole('button', { name: '重新載入', exact: true }).click(); await listReady(); await page.locator(`[data-order-id="${order.id}"]`).getByText('已取消', { exact: false }).waitFor();
    check('ACK後重讀不產生第二次POST', cancelPosts === 1);
    await page.unroute('**/api/customer/preorders/*/cancel'); await page.unroute('**/api/customer/preorders?*');
    await page.screenshot({ path: 'work/preorder-orders-20261007/orders-mobile.png', fullPage: true }); check('390px本人預購無水平溢出', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const bid of batches) { const b = (await api(staff, '/admin/preorders/' + bid)).data.batch; await api(staff, '/admin/preorders/' + bid + '/close', 'POST', { requestId: crypto.randomUUID(), expectedVersion: b.version, note: 'Browser fixture cleanup' }); }
    await page.goto(base + '/shop/preorders/' + first.b.id); await page.getByText('已截單', { exact: true }).waitFor(); check('截單批次不提供下單入口', await page.getByRole('link', { name: '預購下單', exact: true }).count() === 0);
    check('無未捕捉JS錯誤', errors.length === 0);
    fs.writeFileSync('work/preorder-orders-20261007/browser-preorder_orders.json', JSON.stringify({ passed: checks.length, checks }, null, 2));
  } finally {
    if (ctx && staff) {
      const token = (await (await ctx.request.get(base + '/api/auth/csrf')).json()).data.token;
      const own = (await (await ctx.request.get(base + '/api/customer/preorders')).json()).data;
      for (const o of own?.items || []) if (o.status === 'PENDING') await ctx.request.post(base + '/api/customer/preorders/' + o.id + '/cancel', { headers: { 'X-XSRF-TOKEN': token }, data: { requestId: crypto.randomUUID(), expectedVersion: o.version } });
      const t = (await (await staff.request.get(base + '/api/auth/csrf')).json()).data.token;
      for (const bid of batches) { const b = (await (await staff.request.get(base + '/api/admin/preorders/' + bid)).json()).data.batch; if (b.status !== 'CLOSED') await staff.request.post(base + '/api/admin/preorders/' + bid + '/close', { headers: { 'X-XSRF-TOKEN': t }, data: { requestId: crypto.randomUUID(), expectedVersion: b.version, note: 'Browser fixture cleanup' } }); }
      for (const pid of products) { let p = (await (await staff.request.get(base + '/api/admin/products/' + pid)).json()).data; if (p.status === 'PUBLISHED') p = (await (await staff.request.patch(base + '/api/admin/products/' + pid + '/publication', { headers: { 'X-XSRF-TOKEN': t }, data: { expectedVersion: p.version, published: false } })).json()).data; if (p.status === 'DRAFT') await staff.request.delete(base + '/api/admin/products/' + pid + '?expectedVersion=' + p.version, { headers: { 'X-XSRF-TOKEN': t } }); }
    }
    if (ctx) await ctx.close(); if (staff) await staff.close(); await browser.close();
  }
})().catch(e => { console.error(String(e.message).slice(0, 500)); console.error(String(e.stack).split('\n').filter(x => x.includes('smoke_preorder_orders_browser.cjs:')).join('\n')); process.exit(1); });
