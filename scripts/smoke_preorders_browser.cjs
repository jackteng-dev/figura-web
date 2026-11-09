const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs'), crypto = require('node:crypto');
const base = process.env.SHOP_FRONTEND_URL || 'http://127.0.0.1:15176';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Loopback only');
const checks = [], errors = [], batches = [];
function check(name, value) { if (!value) throw new Error('Check failed: ' + name); checks.push(name); console.log(name); }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, headless: true });
  let ctx, product;
  try {
    ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => new URL(r.request().url()).hostname === new URL(base).hostname ? r.continue() : r.abort());
    async function api(path, method = 'GET', data) {
      const headers = method === 'GET' ? {} : { 'X-XSRF-TOKEN': (await (await ctx.request.get(base + '/api/auth/csrf')).json()).data.token };
      const r = await ctx.request.fetch(base + '/api' + path, { method, headers, data }); return { status: r.status(), data: (await r.json()).data };
    }
    async function login(admin) {
      await page.goto(base + '/admin/login'); await page.getByPlaceholder('請輸入用戶名').fill(admin ? 'shop_admin' : 'shop_staff');
      await page.getByPlaceholder('請輸入密碼').fill(process.env[admin ? 'DEMO_ADMIN_PASSWORD' : 'DEMO_STAFF_PASSWORD']);
      await page.getByRole('button', { name: 'Login', exact: true }).click(); await page.waitForURL('**/home');
    }
    async function ready() { await page.waitForFunction(() => { const b = [...document.querySelectorAll('.preorder-admin button')].find(x => x.textContent.trim() === '重讀資料'); return b && !b.disabled && !document.querySelector('.preorder-admin [role=alert]') && ![...document.querySelectorAll('.preorder-admin [role=status]')].some(x => x.textContent.includes('載入中'));  }); }
    async function open() { await page.goto(base + '/admin/preorders'); await page.getByRole('heading', { name: '預購批次管理', exact: true }).waitFor(); await ready(); }
    async function form(name) {
      await page.getByRole('button', { name: '新增預購批次', exact: true }).click();
      await page.getByLabel('批次商品', { exact: true }).selectOption(product.id);
      await page.getByLabel('批次款式', { exact: true }).selectOption(product.skus[0].id);
      await page.getByLabel('批次名稱', { exact: true }).fill(name);
      await page.getByLabel('批次說明', { exact: true }).fill('<img src=x onerror=alert(1)> 合成批次');
      await page.getByLabel('截止時間（台北時間）', { exact: true }).fill(new Date(Date.now() + 8 * 3600000 + 7 * 86400000).toISOString().slice(0, 16));
      await page.getByLabel('預計到貨起日', { exact: true }).fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
      await page.getByLabel('預計到貨迄日', { exact: true }).fill(new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10));
      await page.getByLabel('異動原因', { exact: true }).fill('Chromium 合成資料');
    }
    async function saved() { await page.getByRole('status').filter({ hasText: /已保存|已核對/ }).waitFor(); await ready(); }
    async function allBatches() { const all = []; let p = 1; while (true) { const r = (await api('/admin/preorders?page=' + p++)).data; all.push(...r.items); if (all.length >= r.total) return all; } }
    await login(true);
    product = (await api('/admin/products', 'POST', { title: 'Browser preorder ' + crypto.randomUUID(), brand: 'ELPSY', category: '公仔', description: '合成預購商品', expectedVersion: 0, skus: [{ code: 'PRE-' + crypto.randomUUID(), label: '限定款', priceTwd: 1280, enabled: true }] })).data;
    product = (await api('/admin/products/' + product.id + '/publication', 'PATCH', { expectedVersion: 0, published: true })).data;
    await open(); check('動態預購路由與真管理頁', await page.getByRole('button', { name: '新增預購批次', exact: true }).isVisible());
    const name = 'Browser batch ' + crypto.randomUUID(); await form(name); await page.getByRole('button', { name: '保存批次草稿', exact: true }).click(); await saved();
    let b = (await allBatches()).find(x => x.name === name); batches.push(b.id);
    check('真表單建立獨立配額草稿', b.status === 'DRAFT' && b.capacity === 100 && b.heldQuantity === 0 && b.paidQuantity === 0);
    await page.getByRole('button', { name: '編輯批次草稿', exact: true }).click(); await page.getByLabel('預購單價（TWD）', { exact: true }).fill('2222'); await page.getByLabel('異動原因', { exact: true }).fill('驗證並行修改');
    let { id, status, version, openedAt, closedAt, productTitle, skuLabel, heldQuantity, paidQuantity, ...write } = b;
    write = { ...write, expectedVersion: version, requestId: crypto.randomUUID(), note: '並行編輯', capacity: 101 };
    check('另一編輯者實際改版', (await api('/admin/preorders/' + b.id, 'PUT', write)).status === 201);
    await page.getByRole('button', { name: '保存批次草稿', exact: true }).click(); await page.locator('.preorder-admin [role=alert]').filter({ hasText: '版本' }).waitFor();
    check('409 保留未送價格並凍結再送', await page.getByLabel('預購單價（TWD）').inputValue() === '2222' && await page.getByRole('button', { name: '保存批次草稿', exact: true }).isDisabled());
    await page.getByRole('button', { name: '重讀資料', exact: true }).click(); await ready(); await page.getByRole('button', { name: '關閉編輯', exact: true }).click();
    await page.getByRole('button', { name: '查看 ' + name, exact: true }).click(); await ready(); await page.getByRole('button', { name: '編輯批次草稿', exact: true }).click();
    check('重讀後明確重開編輯取最新條件', await page.getByLabel('供應配額').inputValue() === '101'); await page.getByRole('button', { name: '關閉編輯', exact: true }).click();
    await page.getByLabel('操作原因', { exact: true }).fill('開放演練'); await page.getByRole('button', { name: '開放批次', exact: true }).click(); await saved();
    b = (await api('/admin/preorders/' + b.id)).data.batch;
    check('真UI開放且無草稿編輯按鈕', b.status === 'OPEN' && await page.getByRole('button', { name: '編輯批次草稿', exact: true }).count() === 0);
    const anon = await browser.newContext({ viewport: { width: 390, height: 844 } }); const publicPage = await anon.newPage(); publicPage.on('pageerror', e => errors.push(e.message));
    await publicPage.goto(base + '/shop/preorders/' + b.id); await publicPage.getByRole('heading', { name, exact: true }).waitFor();
    check('匿名顧客批次詳情與預購下單入口', publicPage.url().includes('/shop/preorders/') && await publicPage.getByRole('link', { name: '預購下單', exact: true }).isVisible());
    check('純文字說明沒有執行HTML', await publicPage.locator('.preorder-cards img').count() === 0 && (await publicPage.locator('.preorder-cards').innerText()).includes('<img src=x onerror=alert(1)>'));
    check('顧客頁價格配額與台北截止時間', (await publicPage.locator('.preorder-cards').innerText()).includes('101 件') && await publicPage.getByText('截止時間（台北）', { exact: true }).isVisible());
    fs.mkdirSync('work/preorders-20261007', { recursive: true }); await publicPage.screenshot({ path: 'work/preorders-20261007/customer-mobile.png', fullPage: true });
    check('390px 顧客頁無水平溢出', await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByLabel('操作原因', { exact: true }).fill('截單演練'); await page.getByRole('button', { name: '批次截單', exact: true }).click(); await saved();
    await publicPage.reload(); await publicPage.getByText('已截單', { exact: true }).waitFor(); check('真UI截單與顧客進度', (await api('/admin/preorders/' + b.id)).data.batch.status === 'CLOSED');
    await publicPage.route('**/api/catalog/preorders/' + b.id, r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"code":1,"message":"synthetic unavailable"}' })); await publicPage.getByRole('button', { name: '重新載入', exact: true }).click(); await publicPage.getByRole('alert').waitFor(); check('公開讀取故障保留重試且不導向員工登入', publicPage.url().includes('/shop/preorders/') && await publicPage.getByRole('button', { name: '重新載入', exact: true }).isEnabled()); await anon.close();
    const retryName = 'Retry batch ' + crypto.randomUUID(); await form(retryName); let writes = [], drop = true;
    await page.route('**/api/admin/preorders', async r => { if (r.request().method() !== 'POST') return r.continue(); writes.push(r.request().postData()); if (drop) { drop = false; await r.fetch(); return r.abort('failed'); } return r.continue(); });
    await page.getByRole('button', { name: '保存批次草稿', exact: true }).click(); await page.getByRole('button', { name: '重試同一操作', exact: true }).waitFor();
    check('ACK 遺失凍結批次表單', await page.getByLabel('批次名稱').isDisabled()); await page.getByRole('button', { name: '重試同一操作', exact: true }).click(); await saved(); await page.unroute('**/api/admin/preorders');
    const matches = (await allBatches()).filter(x => x.name === retryName); batches.push(matches[0].id);
    check('原 UUID/body 重試僅一筆批次', writes.length === 2 && writes[0] === writes[1] && matches.length === 1);
    const getName = 'Get failure batch ' + crypto.randomUUID(); await form(getName); let posts = 0, fail = false;
    await page.route('**/api/admin/preorders', async r => { if (r.request().method() !== 'POST') return r.continue(); posts++; const response = await r.fetch(); fail = true; return r.fulfill({ response }); });
    await page.route('**/api/admin/preorders?*', r => fail ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"code":1,"message":"synthetic unavailable"}' }) : r.continue());
    await page.getByRole('button', { name: '保存批次草稿', exact: true }).click(); await page.locator('.preorder-admin [role=alert]').waitFor();
    check('ACK 後 GET 故障不重新POST', posts === 1 && await page.getByRole('button', { name: '重試同一操作', exact: true }).count() === 0);
    fail = false; await page.getByRole('button', { name: '重讀資料', exact: true }).click(); await ready(); await page.unroute('**/api/admin/preorders'); await page.unroute('**/api/admin/preorders?*'); batches.push((await allBatches()).find(x => x.name === getName).id); check('ACK 後僅重讀資料', posts === 1);
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'work/preorders-20261007/staff-mobile.png', fullPage: true }); if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) console.log('Overflow:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.preorder-admin *')].filter(e => e.getBoundingClientRect().right > innerWidth).slice(0,8).map(e => ({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))))); check('390px 批次管理無水平溢出', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.batch-detail details').first().click(); check('稽核純文字可核對且無指紋', (await page.locator('.batch-detail details').first().innerText()).includes('操作 ID') && !(await page.locator('.batch-detail pre').allTextContents()).some(x => x.includes('fingerprint')));
    for (const batchId of batches) { const v = (await api('/admin/preorders/' + batchId)).data.batch; if (v.status !== 'CLOSED') await api('/admin/preorders/' + batchId + '/close', 'POST', { expectedVersion: v.version, requestId: crypto.randomUUID(), note: 'browser fixture cleanup' }); }
    product = (await api('/admin/products/' + product.id + '/publication', 'PATCH', { expectedVersion: product.version, published: false })).data; await api('/admin/products/' + product.id + '?expectedVersion=' + product.version, 'DELETE');
    await login(false); let readOnlyProductReads = 0; await page.route('**/api/admin/products?*', r => { readOnlyProductReads++; return r.fulfill({status:403,contentType:'application/json',body:'{"code":1,"message":"synthetic catalog grant unavailable"}'}); }); await open(); check('唯讀批次查詢不依賴商品選單授權', readOnlyProductReads === 0); check('普通員工唯讀管理頁', await page.getByText('目前為唯讀，不能新增或編輯批次。', { exact: true }).isVisible() && await page.getByRole('button', { name: '新增預購批次', exact: true }).count() === 0);
    check('無未捕捉JavaScript錯誤', errors.length === 0);
    fs.writeFileSync('work/preorders-20261007/browser-preorders.json', JSON.stringify({ passed: checks.length, checks }, null, 2)); console.log('預購批次 Chromium 通過 ' + checks.length + ' 項');
  } finally { if (ctx) await ctx.close(); await browser.close(); }
})().catch(e => { console.error(JSON.stringify(String(e.message).slice(0,500))); console.error(String(e.stack).split('\n').filter(x => x.includes('smoke_preorders_browser.cjs:')).join('\n')); process.exit(1); });
