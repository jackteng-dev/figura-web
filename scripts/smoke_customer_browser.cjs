const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs'), crypto = require('node:crypto');
const base = process.env.SHOP_FRONTEND_URL || 'http://127.0.0.1:15176';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('只允許 loopback 演練');
if (!process.env.DEMO_ADMIN_PASSWORD) throw Error('需私有展示店長密碼');
const username='web_'+crypto.randomUUID().replaceAll('-','').slice(0,18),password=crypto.randomBytes(18).toString('base64url');
const checks=[],errors=[];function check(name,ok){if(!ok)throw Error(name);checks.push(name)}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH||undefined,headless:true});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).hostname===new URL(base).hostname?r.continue():r.abort());
  await page.goto(base+'/shop');await page.getByRole('heading',{name:/讓喜歡的角色/}).waitFor();check('公開商店入口可讀且不導向員工登入',page.url().endsWith('/shop'));
  await page.goto(base+'/shop/not-a-page');await page.getByRole('heading',{name:'找不到這個頁面 😢'}).waitFor();check('顧客未知路由留商店並顯示找不到頁面',page.url().endsWith('/shop/not-a-page'));await page.getByRole('link',{name:'返回首頁',exact:true}).click();await page.waitForURL('**/shop');
  await page.goto(base+'/shop/account');await page.waitForURL('**/shop/login');check('匿名會員中心導向顧客登入',true);
  await page.goto(base+'/shop/register');await page.getByLabel('顧客帳號',{exact:true}).fill(username);await page.getByLabel('暱稱',{exact:true}).fill('網頁會員');await page.getByLabel('密碼',{exact:true}).fill(password);await page.getByRole('button',{name:'建立帳號',exact:true}).click();await page.waitForURL('**/shop/login?**');await page.getByRole('status').filter({hasText:'帳號已建立'}).waitFor();check('顧客註冊真實 API 成功',true);
  check('註冊後不保留密碼欄位',await page.getByLabel('密碼',{exact:true}).inputValue()==='');
  await page.getByLabel('密碼',{exact:true}).fill('wrong-password-2026');await page.getByRole('button',{name:'登入會員',exact:true}).click();await page.getByRole('alert').waitFor();check('錯誤密碼保留顧客頁並顯示錯誤',new URL(page.url()).pathname==='/shop/login');
  await page.getByLabel('密碼',{exact:true}).fill(password);await page.getByRole('button',{name:'登入會員',exact:true}).click();await page.waitForURL('**/shop/account');await page.getByTestId('member-username').waitFor();check('顧客登入會員中心回本人',await page.getByTestId('member-username').innerText()===username);
  check('顧客獨立 Cookie HttpOnly 且 Strict',(await context.cookies()).filter(c=>['customerAccessToken','customerRefreshToken'].includes(c.name)).every(c=>c.httpOnly&&c.sameSite==='Strict')&&(await context.cookies()).filter(c=>c.name.startsWith('customer')).length===2);
  await page.getByLabel('暱稱',{exact:true}).fill('我的網頁收藏');await page.getByRole('button',{name:'儲存暱稱',exact:true}).click();await page.getByRole('status').filter({hasText:'暱稱已儲存'}).waitFor();await page.reload();await page.getByTestId('member-name').filter({hasText:'我的網頁收藏'}).waitFor();check('暱稱儲存後重整仍保留',true);
  const attack='<img src=x onerror="window.__customerXss=1">';await page.getByLabel('暱稱',{exact:true}).fill(attack);await page.getByRole('button',{name:'儲存暱稱',exact:true}).click();await page.getByRole('status').waitFor();check('會員暱稱以文字顯示不執行 HTML',await page.getByTestId('member-name').innerText()===attack&&await page.locator('img[src="x"]').count()===0&&await page.evaluate(()=>window.__customerXss===undefined));
  let refreshes=0;page.on('request',r=>{if(r.url().endsWith('/api/customer/auth/refresh'))refreshes++});await context.clearCookies({name:'customerAccessToken'});await page.goto(base+'/shop/account');await page.getByTestId('member-username').waitFor();check('顧客 access 缺失以一次專屬 refresh 恢復',refreshes===1);
  await page.goto(base+'/admin/login');await page.getByPlaceholder('請輸入用戶名').fill('shop_admin');await page.getByPlaceholder('請輸入密碼').fill(process.env.DEMO_ADMIN_PASSWORD);await page.getByRole('button',{name:'Login',exact:true}).click();await page.waitForURL('**/home');await page.getByRole('heading',{name:'ELPSY Shop 工作首頁'}).waitFor();await page.goto(base+'/shop/account');await page.getByTestId('member-username').waitFor();check('同一瀏覽器顧客與員工身分可共存',await page.getByTestId('member-username').innerText()===username&&(await context.cookies()).some(c=>c.name==='accessToken'));
  await page.getByRole('button',{name:'登出會員',exact:true}).click();await page.waitForURL('**/shop/login');await page.goto(base+'/home');await page.getByRole('heading',{name:'ELPSY Shop 工作首頁'}).waitFor();check('登出顧客不登出員工',true);
  await page.goto(base+'/shop/account');await page.waitForURL('**/shop/login');check('員工登入不能代替顧客身分',true);
  check('localStorage／sessionStorage 不存顧客密碼',await page.evaluate(secret=>!JSON.stringify({...localStorage,...sessionStorage}).includes(secret),password));
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/shop/register');await page.getByRole('heading',{name:'建立顧客帳號',exact:true}).waitFor();check('390px 顧客註冊頁無橫向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check('正式 build 無未捕捉 JavaScript 錯誤',errors.length===0);
  fs.mkdirSync('work/customer-20261007',{recursive:true});fs.writeFileSync('work/customer-20261007/browser-customer.json',JSON.stringify({passed:checks.length,checks,errors,syntheticAccountsCreated:1},null,2));await page.screenshot({path:'work/customer-20261007/customer-register-mobile.png',fullPage:true});console.log('顧客正式瀏覽器驗證通過',checks.length,'項');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
