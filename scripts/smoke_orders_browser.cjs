// Production dist -> real JAR/MySQL/Redis. No mocked prices, owners, or writes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),crypto=require('node:crypto');
const base=process.env.SHOP_FRONTEND_URL||'http://127.0.0.1:15176';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Only loopback demo');
const checks=[],errors=[];function check(name,ok){if(!ok)throw Error(name);checks.push(name)}
let product,admin;
async function api(context,path,method='GET',body,form=false){
 const csrf=await context.request.get(base+'/api/auth/csrf');const token=(await csrf.json()).data.token;
 const r=await context.request.fetch(base+'/api'+path,{method,headers:method==='GET'?{}:{'X-XSRF-TOKEN':token},...(body===undefined?{}:form?{form:body}:{data:body})});
 return {status:r.status(),...(await r.json())};
}
async function member(context){const name='webcart_'+crypto.randomUUID().replaceAll('-','').slice(0,18),password=crypto.randomBytes(18).toString('base64url');let r=await api(context,'/customer/auth/register','POST',{username:name,password,displayName:'合成購物會員'});if(r.status!==201)throw Error('member register');r=await api(context,'/customer/auth/login','POST',{username:name,password,deviceId:crypto.randomUUID(),rememberMe:false});if(r.status!==200)throw Error('member login');return r.data}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH||undefined});
 let customerContext,other;
 try{
  admin=await browser.newContext();let r=await api(admin,'/admin/login','POST',{username:'shop_admin',password:process.env.DEMO_ADMIN_PASSWORD,deviceId:crypto.randomUUID()},true);if(r.status!==200)throw Error('admin login');
  r=await api(admin,'/admin/products','POST',{title:'Browser order '+crypto.randomUUID(),brand:'ELPSY',category:'公仔',description:'合成訂單頁資料',expectedVersion:0,skus:[{code:'WEB-ORDER-'+crypto.randomUUID(),label:'標準款',priceTwd:1280,enabled:true}]});if(r.status!==201)throw Error('create product');product=r.data;
  const sku=product.skus[0].id,pp='/admin/products/'+product.id,inv=pp+'/skus/'+sku+'/inventory';
  r=await api(admin,inv+'/adjustments','POST',{requestId:crypto.randomUUID(),expectedVersion:0,delta:3,reason:'RESTOCK',note:'合成頁面測試'});if(r.status!==201)throw Error('restock');product=(await api(admin,pp+'/publication','PATCH',{expectedVersion:0,published:true})).data;
  customerContext=await browser.newContext({viewport:{width:1440,height:1000}});const context=customerContext,page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>new URL(route.request().url()).hostname===new URL(base).hostname?route.continue():route.abort());
  await page.goto(base+'/shop/orders');await page.waitForURL('**/shop/login');check('匿名訂單導向顧客登入',true);
  await member(context);await page.goto(base+'/shop/orders');await page.getByTestId('orders-empty').waitFor();check('本人初始訂單空白',true);
  const addressId=crypto.randomUUID(),address={expectedVersion:0,recipientName:'<img src=x onerror="window.__orderXss=1">',phone:'0912345678',postalCode:'100',city:'測試市',district:'測試區',street:'合成路 1 號'};
  r=await api(context,'/customer/addresses/'+addressId,'PUT',address);if(r.status!==200)throw Error('address create');
  await api(context,'/customer/cart/items/'+sku,'PUT',{expectedVersion:0,quantity:2});await page.goto(base+'/shop/cart');await page.getByTestId('order-total').filter({hasText:'2,560'}).waitFor();check('下單前顯示伺服器總額與本人收件地址',await page.getByLabel('收件地址',{exact:true}).inputValue()===addressId&&(await page.getByTestId('checkout-shipping').innerText()).includes('合成路 1 號')&&(await page.getByTestId('checkout-shipping').innerText()).includes('0912345678'));
  await page.setViewportSize({width:390,height:844});fs.mkdirSync('work/orders-20261007',{recursive:true});await page.screenshot({path:'work/orders-20261007/checkout-mobile.png',fullPage:true});check('390px確認下單表單無橫向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1440,height:1000});
  let lost=0;await page.route(base+'/api/customer/orders',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();if(response.status()!==200)throw Error('lost ACK order commit');lost++;await route.abort('failed')});
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'確認下單，保留庫存',exact:true}).click();await page.getByRole('alert').filter({hasText:'下單結果未確認'}).waitFor();check('真實提交後遺失回應保留重試操作',lost===1&&(await api(context,'/customer/orders')).data.total===1);
  check('未知結果凍結地址與購物車修改',await page.getByLabel('收件地址',{exact:true}).isDisabled()&&await page.getByRole('button',{name:'重新核對購物車',exact:true}).isDisabled());
  await page.unroute(base+'/api/customer/orders');await page.getByRole('button',{name:'用同一操作重試下單',exact:true}).click();await page.waitForURL('**/shop/orders');let order=(await api(context,'/customer/orders')).data.items[0];const card=page.getByTestId('order-'+order.id);await card.waitFor();
  check('同操作重試只一筆訂單與保留2件',(await api(context,'/customer/orders')).data.total===1&&(await api(admin,inv)).data.reserved===2);
  check('訂單顯示快照金額收件資訊與30分鐘期限',(await card.innerText()).includes('2,560')&&(await card.innerText()).includes('合成路 1 號')&&Math.abs((Date.parse(order.expiresAt)-Date.parse(order.createdAt))/60000-30)<0.1);
  check('收件人HTML以文字呈現',await page.locator('img[src=x]').count()===0&&await page.evaluate(()=>window.__orderXss===undefined));
  check('下單清空購物車',(await api(context,'/customer/cart')).data.items.length===0);
  other=await browser.newContext();await member(other);check('第二顧客不能讀取第一人訂單',(await api(other,'/customer/orders')).data.total===0&&(await api(other,'/customer/orders/'+order.id)).status===404);
  await page.reload();await card.waitFor();check('訂單重整仍保存',true);
  await api(context,'/customer/addresses/'+addressId+'?expectedVersion=1','DELETE');product=(await api(admin,pp+'/publication','PATCH',{expectedVersion:product.version,published:false})).data;const edit={title:'Changed draft',brand:product.brand,category:product.category,description:product.description,expectedVersion:product.version,skus:product.skus.map(s=>({...s,priceTwd:2500}))};product=(await api(admin,pp,'PUT',edit)).data;
  await page.getByRole('button',{name:'重新核對訂單',exact:true}).click();await card.waitFor();check('刪除地址與改草稿價格後訂單快照不变',(await card.innerText()).includes('合成路 1 號')&&(await card.innerText()).includes('2,560')&&!(await card.innerText()).includes('Changed draft'));
  await page.setViewportSize({width:390,height:844});fs.mkdirSync('work/orders-20261007',{recursive:true});await page.screenshot({path:'work/orders-20261007/orders-mobile.png',fullPage:true});check('訂單品項文字有可讀深色樣式',await card.locator('li').first().evaluate(el=>getComputedStyle(el).color)==='rgb(41, 46, 41)');check('390px訂單無橫向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  page.once('dialog',d=>d.accept());await card.getByRole('button',{name:'取消訂單',exact:true}).click();await card.getByRole('heading',{name:'已取消',exact:true}).waitFor();check('顧客取消釋放庫存與移除取消按鈕',(await api(admin,inv)).data.reserved===0&&await card.getByRole('button',{name:'取消訂單',exact:true}).count()===0);
  await api(context,'/customer/addresses/'+crypto.randomUUID(),'PUT',address);product=(await api(admin,pp+'/publication','PATCH',{expectedVersion:product.version,published:true})).data;
  let cart=(await api(context,'/customer/cart')).data;await api(context,'/customer/cart/items/'+sku,'PUT',{expectedVersion:cart.version,quantity:1});await page.goto(base+'/shop/cart');await page.getByTestId('order-total').filter({hasText:'2,500'}).waitFor();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'確認下單，保留庫存',exact:true}).click();await page.waitForURL('**/shop/orders');order=(await api(context,'/customer/orders')).data.items[0];
  if(!/^[0-9a-f-]{36}$/.test(order.id))throw Error('invalid order UUID');const {execFileSync}=require('node:child_process');
  const container=process.env.SHOP_MYSQL_TEST_CONTAINER;if(!container||!/^elpsy-[a-z0-9-]+-mysql-1$/.test(container))throw Error('需明確指定專用SHOP_MYSQL_TEST_CONTAINER');
  const dbEnv={...process.env,MYSQL_PWD:process.env.DB_PASSWORD};for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dbEnv[key];
  try{execFileSync('docker',['--host=unix:///var/run/docker.sock','exec','-e','MYSQL_PWD',container,'mysql','-u','shop_demo','-D','elpsy_shop_demo','-e',"UPDATE customer_order SET expires_at=CURRENT_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id='"+order.id+"'"],{stdio:'pipe',env:dbEnv})}catch{throw Error('專用MySQL逾時fixture更新失敗，未輸出私有連線資訊')}
  let expired=false;for(let i=0;i<90;i++){if((await api(context,'/customer/orders/'+order.id)).data.status==='EXPIRED'){expired=true;break}await page.waitForTimeout(500)}if(!expired)throw Error('隔離訂單未在排程時間窗內逾時')
  await page.getByRole('button',{name:'重新核對訂單',exact:true}).click();await page.getByTestId('order-'+order.id).getByRole('heading',{name:'已逾時',exact:true}).waitFor();check('真實排程釋放逾時庫存',(await api(admin,inv)).data.reserved===0);
  check('未捕捉JS錯誤為0',errors.length===0);fs.writeFileSync('work/orders-20261007/browser-orders.json',JSON.stringify({passed:checks.length,checks,errors},null,2));console.log('訂單正式瀏覽器通過',checks.length,'項');
 }finally{
  if(customerContext){for(const o of (await api(customerContext,'/customer/orders')).data?.items||[])if(o.status==='PENDING_PAYMENT')await api(customerContext,'/customer/orders/'+o.id+'/cancel','POST',{expectedVersion:o.version})}
  if(product&&admin){let p=(await api(admin,'/admin/products/'+product.id)).data;if(p?.status==='PUBLISHED')p=(await api(admin,'/admin/products/'+p.id+'/publication','PATCH',{expectedVersion:p.version,published:false})).data;if(p?.status==='DRAFT')await api(admin,'/admin/products/'+p.id+'?expectedVersion='+p.version,'DELETE')}
  await browser.close();
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1});
