const { chromium }=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs=require('node:fs');const secrets=process.env;
const base=process.env.SHOP_FRONTEND_URL || 'http://127.0.0.1:15176';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('只允許 loopback 演練');
if (!secrets.DEMO_ADMIN_PASSWORD || !secrets.DEMO_STAFF_PASSWORD) throw Error('需私有展示帳密');
const checks=[],errors=[];function check(name,ok){if(!ok)throw Error(name);checks.push(name)}
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).hostname===new URL(base).hostname?r.continue():r.abort());
 async function login(name,password){await page.goto(base+'/admin/login');await page.getByPlaceholder('請輸入用戶名').fill(name);await page.getByPlaceholder('請輸入密碼').fill(password);await page.getByRole('button',{name:'Login',exact:true}).click();await page.waitForURL('**/home');await page.getByText('ELPSY Shop 工作首頁',{exact:true}).waitFor();}
 await page.goto(base+'/admin/login');await page.getByText('後台管理系統',{exact:true}).waitFor();check('正式登入頁可顯示且沒有預填私有帳密',(await page.locator('input[type=password]').inputValue())==='');
 await login('shop_admin',secrets.DEMO_ADMIN_PASSWORD);check('ADMIN 真實 Cookie／CSRF 登入',(await context.cookies()).some(c=>c.name==='accessToken'&&c.httpOnly));
 check('工作首頁不顯示假營收',await page.getByText('目前完成登入與開發基準',{exact:false}).isVisible());
 await page.getByRole('link',{name:'權限目錄',exact:true}).click();await page.waitForURL('**/admin/permissions');await page.getByRole('heading',{name:'權限目錄',exact:true}).waitFor();check('ADMIN 動態權限路由可載入',true);
 let refreshes=0;page.on('request',r=>{if(r.url().endsWith('/api/auth/refresh'))refreshes++});await context.clearCookies({name:'accessToken'});await page.goto(base+'/home');await page.getByText('ELPSY Shop 工作首頁',{exact:true}).waitFor();check('缺少 access Cookie 可經 refresh 恢復',refreshes===1);
 await page.goto(base+'/admin/login');await login('shop_staff',secrets.DEMO_STAFF_PASSWORD);
 check('切換 STAFF 不殘留 ADMIN 動態菜單',await page.getByRole('link',{name:'權限目錄',exact:true}).count()===0);
 await page.goto(base+'/admin/permissions');await page.getByText('找不到這個頁面 😢',{exact:true}).waitFor();check('STAFF 不能進入存取管理路由',await page.getByRole('heading',{name:'權限目錄',exact:true}).count()===0);
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/admin/login');await page.getByText('後台管理系統',{exact:true}).waitFor();check('390px 登入頁可讀且無橫向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check('正式 build 無未捕捉 JavaScript 錯誤',errors.length===0);
 fs.mkdirSync('work/verification',{recursive:true});fs.writeFileSync('work/verification/browser-results.json',JSON.stringify({passed:checks.length,checks,errors},null,2));console.log('正式 build 瀏覽器驗證通過',checks.length,'項');
}finally{await browser.close()}})().catch(e=>{console.error(e.message);console.error('pageerrors',errors);process.exitCode=1});
