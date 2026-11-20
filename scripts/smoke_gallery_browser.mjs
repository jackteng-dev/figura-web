// Real production dist -> isolated local API/MySQL/Redis/SeaweedFS. No API mocks.
// No package install: Chrome DevTools Protocol via Node's native WebSocket.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
const base=process.env.SHOP_FRONTEND_URL||'http://127.0.0.1:15179'
assert.equal(new URL(base).hostname,'127.0.0.1','Only loopback demo')
const out=resolve('work/comfyui-gallery-browser');await mkdir(out,{recursive:true})
const env=Object.fromEntries((await readFile(process.env.FIGURA_GALLERY_ENV||'../figura-api/work/gallery.env','utf8')).split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)]}))
assert.match(env.DB_URL,/^jdbc:mysql:\/\/127\.0\.0\.1:43306\/figura_shop_demo\?/,'Requires this task’s new disposable DB')
const checks=[],profile=resolve(out,'chrome-'+Date.now())
const chrome=spawn(process.env.PLAYWRIGHT_CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-extensions','--disable-sync','--no-first-run','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
let ws,cdp,evaluate,onPaused
function check(name,condition){assert(condition,name);checks.push(name)}
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await delay(100)}throw Error('Timeout: '+expression)}
async function navigate(path,selector){await cdp('Page.navigate',{url:base+path});await until(`location.pathname===${JSON.stringify(path.split('?')[0])}&&!!document.querySelector(${JSON.stringify(selector)})`)}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)}
async function api(path,method='GET',body){
 return evaluate(`(async()=>{const c=await(await fetch('/api/auth/csrf')).json();const r=await fetch('/api'+${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json','X-XSRF-TOKEN':c.data.token},${body===undefined?'':`body:JSON.stringify(${JSON.stringify(body)}),`}});const result=await r.json();if(!r.ok||result.code!==0)throw Error('API '+${JSON.stringify(path)}+' '+r.status);return result.data})()`)
}
async function upload(id,input,file){
 const b64=(await readFile(file)).toString('base64')
 return evaluate(`(async()=>{const c=await(await fetch('/api/auth/csrf')).json(),f=new FormData();for(const[k,v]of Object.entries(${JSON.stringify(input)}))f.append(k,String(v));f.append('file',new File([Uint8Array.from(atob(${JSON.stringify(b64)}),c=>c.charCodeAt(0))],'sample.jpg',{type:'image/jpeg'}));const r=await fetch('/api/admin/products/'+${JSON.stringify(id)}+'/image',{method:'POST',headers:{'X-XSRF-TOKEN':c.data.token},body:f});const result=await r.json();if(!r.ok||result.code!==0)throw Error('Upload '+r.status);return result.data.current})()`)
}
try{
 let port;for(let i=0;i<100&&!port;i++){try{[port]=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')}catch{await delay(100)}}assert(port,'Chrome startup')
 const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl)
 await new Promise((ok,bad)=>{ws.onopen=ok;ws.onerror=bad})
 let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(m.method==='Fetch.requestPaused'&&onPaused)onPaused(m.params).catch(e=>console.error(e.message));if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}}
 cdp=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
 evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
 await cdp('Page.enable');await cdp('DOM.enable')
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`window.__errors=[];window.__lcp=0;addEventListener('error',e=>{if(e.message)window.__errors.push(e.message)});new PerformanceObserver(list=>{for(const e of list.getEntries())window.__lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});`})
 await navigate('/shop','h1')
 await evaluate(`(async()=>{const c=await(await fetch('/api/auth/csrf')).json();const f=new URLSearchParams({username:'shop_admin',password:${JSON.stringify(env.DEMO_ADMIN_PASSWORD)},deviceId:crypto.randomUUID()});const r=await fetch('/api/admin/login',{method:'POST',headers:{'X-XSRF-TOKEN':c.data.token},body:f});if(!r.ok)throw Error('Login failed '+r.status+' '+(await r.json()).message)})()`)
 const actor=await api('/auth/me');const samples=JSON.parse(await readFile('workflows/figura/samples.json','utf8')),fixtures=[]
 for(const [key,title] of [['001','月梨信差'],['068','冷熔鍋爐姊']]){
  let product=await api('/admin/products','POST',{title:`${title} · ComfyUI 本機驗收 ${crypto.randomUUID().slice(0,8)}`,brand:'ELPSY',category:'公仔',description:'AI 生成的虛構公仔概念圖，非實物攝影。本機隔離圖組驗收。',expectedVersion:0,skus:[{code:'GALLERY-'+crypto.randomUUID(),label:'標準款',priceTwd:1280,enabled:true}]})
  const files={}
  for(const [shot,type]of [['main','MAIN'],['face','FACE'],['accessory','DETAIL'],['base','DETAIL']]){
   const run=(await import('node:fs/promises')).readdir;const folders=await run(`src/brand/comfyui-figure-samples/figura-ai-${key}/r1/${shot}`)
   const folder=`src/brand/comfyui-figure-samples/figura-ai-${key}/r1/${shot}/${folders[0]}`
   const manifest=JSON.parse(await readFile(folder+'/manifest.json','utf8'));assert.equal(manifest.masterSha256,samples['FIGURA-AI-'+key].masterSha256);assert.equal(manifest.review.decision,'pass')
   const jpg=manifest.derivatives.filter(a=>a.format==='jpg').sort((a,b)=>b.width-a.width)[0];files[shot]=resolve(folder,jpg.file)
   const detail=await upload(product.id,{requestId:crypto.randomUUID(),expectedVersion:product.version,expectedActorId:actor.id,operation:'ADD',type,alt:`${title}，AI 虛構公仔概念圖，${shot}`},files[shot]);product={...product,version:detail.version}
  }
  product=await api(`/admin/products/${product.id}/publication`,'PATCH',{expectedVersion:product.version,published:true})
  fixtures.push({id:product.id,title:product.title,files});check(`${title}: four reviewed r1 images stored through real API`,true)
 }
 await writeFile(resolve(out,'fixtures.json'),JSON.stringify(fixtures,null,2))
 const measurements=[]
 for(const width of [1440,390]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1050,deviceScaleFactor:1,mobile:false})
  for(const f of fixtures){
   await navigate('/shop/products/'+f.id,'.product-gallery');await until(`document.querySelectorAll('.thumbnails button').length===4&&document.querySelector('.expand img')?.naturalWidth>0`)
   check(`${f.title} ${width}px: thumbnails and no overflow`,await evaluate(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.expand img').loading==='eager'`))
   const first=await evaluate(`document.querySelector('.expand img').currentSrc`)
   await click('.thumbnails button:nth-child(2)');await until(`document.querySelector('.expand img')?.complete&&document.querySelector('.expand img')?.naturalWidth>0`)
   check(`${f.title} ${width}px: selecting thumbnail changes image`,first!==await evaluate(`document.querySelector('.expand img').currentSrc`))
   await click('.expand');check(`${f.title} ${width}px: zoom opens`,await evaluate(`document.querySelector('dialog').open`))
   await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'})
   check(`${f.title} ${width}px: zoom keyboard navigation`,await evaluate(`document.querySelector('.thumbnails button:nth-child(3)').getAttribute('aria-pressed')==='true'`))
   await click('dialog .close');check(`${f.title} ${width}px: close restores focus`,await evaluate(`!document.querySelector('dialog').open&&document.activeElement===document.querySelector('.expand')`))
   await evaluate(`(()=>{const el=document.querySelector('.expand');el.dispatchEvent(new TouchEvent('touchstart',{changedTouches:[new Touch({identifier:1,target:el,clientX:300,clientY:250})]}));el.dispatchEvent(new TouchEvent('touchend',{changedTouches:[new Touch({identifier:1,target:el,clientX:100,clientY:250})]}))})()`)
   check(`${f.title} ${width}px: horizontal swipe changes image`,await evaluate(`document.querySelector('.thumbnails button:nth-child(4)').getAttribute('aria-pressed')==='true'`))
   await click('.thumbnails button:first-child');await until(`document.querySelector('.expand img')?.naturalWidth>0`)
   measurements.push({title:f.title,width,...await evaluate(`({lcpMs:window.__lcp,currentSrc:document.querySelector('.expand img').currentSrc,srcset:document.querySelector('.expand img').srcset})`)})
   const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(out,`${f.id}-${width}.png`),Buffer.from(shot.data,'base64'))
   check(`${f.title} ${width}px: no uncaught browser errors`,await evaluate(`window.__errors.length===0`))
  }
 }
 // Exercise actual employee UI against the same disposable product.
 const f=fixtures[0];let p=await api('/admin/products/'+f.id);await api(`/admin/products/${f.id}/publication`,'PATCH',{expectedVersion:p.version,published:false})
 await navigate('/admin/products','h1');await until(`Array.from(document.querySelectorAll('.product-row')).some(e=>e.innerText.includes(${JSON.stringify(f.title)}))`)
 await evaluate(`Array.from(document.querySelectorAll('.product-row')).find(e=>e.innerText.includes(${JSON.stringify(f.title)})).click()`)
 await until(`document.querySelectorAll('.image-panel .gallery-assets article').length===4`)
 await until(`!document.querySelector('.image-panel .gallery-assets article button:nth-of-type(2)').disabled`)
 const root=await cdp('DOM.getDocument'),node=await cdp('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#product-image-file'})
 await cdp('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[f.files.face,f.files.base]})
 await until(`document.querySelectorAll('.image-panel input[id^="image-alt-"]').length===2`)
 await evaluate(`document.querySelectorAll('.image-panel input[id^="image-alt-"]').forEach((el,i)=>{el.value='本機額外驗收特寫 '+i;el.dispatchEvent(new Event('input',{bubbles:true}))})`)
 await until(`!Array.from(document.querySelectorAll('.image-panel button')).find(e=>e.textContent==='上傳商品圖片').disabled`)
 await evaluate(`Array.from(document.querySelectorAll('.image-panel button')).find(e=>e.textContent==='上傳商品圖片').click()`)
 await until(`document.querySelectorAll('.image-panel .gallery-assets article').length===6&&!document.querySelector('.image-panel [role=alert]')`)
 await until(`!document.querySelector('.image-panel .gallery-assets article button:nth-of-type(2)').disabled`);check('employee: multi-file preview and sequential uploads',(await api('/admin/products/'+f.id+'/image?gallery=true')).images.length===6)
 const galleryBefore=await api('/admin/products/'+f.id+'/image?gallery=true');let lostBody
 onPaused=async event=>{if(event.request.method==='POST'&&event.responseStatusCode===200){lostBody=event.request.postData;await cdp('Fetch.failRequest',{requestId:event.requestId,errorReason:'Aborted'})}else await cdp('Fetch.continueRequest',{requestId:event.requestId})}
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/admin/products/*/image',requestStage:'Response'}]})
 await evaluate(`document.querySelectorAll('.image-panel .gallery-assets article')[1].querySelector('button').click()`)
 await until(`Array.from(document.querySelectorAll('.image-panel button')).some(e=>e.textContent==='重試同一圖片操作')&&!!document.querySelector('.image-panel [role=alert]')`)
 await cdp('Fetch.disable');check('employee: lost ACK freezes new writes after a real committed command',!!lostBody)
 const beforeRetry=await api('/admin/products/'+f.id+'/image?gallery=true');check('employee: lost ACK already committed exactly one event',beforeRetry.events.length===galleryBefore.events.length+1)
 let retriedBody
 onPaused=async event=>{retriedBody=event.request.postData;await cdp('Fetch.continueRequest',{requestId:event.requestId})}
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/admin/products/*/image',requestStage:'Response'}]})
 await evaluate(`Array.from(document.querySelectorAll('.image-panel button')).find(e=>e.textContent==='重試同一圖片操作').click()`)
 await until(`!document.querySelector('.image-panel [role=alert]')&&!Array.from(document.querySelectorAll('.image-panel button')).some(e=>e.textContent==='重試同一圖片操作')`)
 await cdp('Fetch.disable');check('employee: retry uses identical UUID and body',lostBody===retriedBody)
 check('employee: original command replay does not add an event',(await api('/admin/products/'+f.id+'/image?gallery=true')).events.length===beforeRetry.events.length)
 await until(`!document.querySelector('.image-panel .gallery-assets article button:nth-of-type(2)').disabled`)

 await until(`document.querySelectorAll('.image-panel .gallery-assets article')[1].innerText.includes('主圖 ·')`);check('employee: set primary image',true)
 onPaused=async event=>{await cdp('Fetch.failRequest',{requestId:event.requestId,errorReason:'Aborted'})}
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/admin/products/*/image?gallery=true',requestStage:'Response'}]})
 await evaluate(`Array.from(document.querySelectorAll('.image-panel .gallery-assets article')[1].querySelectorAll('button')).find(e=>e.textContent==='向前').click()`)
 await until(`document.querySelector('.image-panel [role=alert]')?.textContent.includes('圖片操作已確認')`)
 check('employee: ACK then GET failure allows only read reconciliation',!await evaluate(`Array.from(document.querySelectorAll('.image-panel button')).some(e=>e.textContent==='重試同一圖片操作')`))
 await cdp('Fetch.disable')
 await evaluate(`Array.from(document.querySelectorAll('.image-panel button')).find(e=>e.textContent==='核對圖片').click()`)
 await until(`!document.querySelector('.image-panel [role=alert]')&&!document.querySelector('.image-panel .gallery-assets article button:nth-of-type(2)').disabled`)

 await until(`document.querySelector('.image-panel .gallery-assets article').innerText.includes('主圖 ·')`);check('employee: reorder persists',true)
 // Replace an extra image through the real file picker, then remove the extras.
 const beforeReplace=await api('/admin/products/'+f.id+'/image?gallery=true'),oldExtra=beforeReplace.images[4].id
 await evaluate(`Array.from(document.querySelectorAll('.image-panel .gallery-assets article')[4].querySelectorAll('button')).find(e=>e.textContent==='替換圖片').click()`)
 const replacementNode=await cdp('DOM.querySelector',{nodeId:(await cdp('DOM.getDocument')).root.nodeId,selector:'#product-image-file'})
 await cdp('DOM.setFileInputFiles',{nodeId:replacementNode.nodeId,files:[f.files.accessory]})
 await until(`document.querySelectorAll('.image-panel input[id^="image-alt-"]').length===1`)
 await evaluate(`(()=>{const el=document.querySelector('.image-panel input[id^="image-alt-"]');el.value='本機替換特寫';el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
 await until(`!Array.from(document.querySelectorAll('.image-panel button')).find(e=>e.textContent==='上傳商品圖片').disabled`)
 await evaluate(`Array.from(document.querySelectorAll('.image-panel button')).find(e=>e.textContent==='上傳商品圖片').click()`)
 await until(`document.querySelector('.image-panel').innerText.includes('本機替換特寫')&&!document.querySelector('.image-panel .gallery-assets article button:nth-of-type(2)').disabled`)
 check('employee: replacement keeps six images and retires the old image',(await api('/admin/products/'+f.id+'/image?gallery=true')).images.every(i=>i.id!==oldExtra))
 await cdp('Page.setInterceptFileChooserDialog',{enabled:false})
 for(let n=0;n<2;n++){
  // Accept only this scripted remove confirmation on the disposable fixture.
  const original=ws.onmessage
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==='Page.javascriptDialogOpening')cdp('Page.handleJavaScriptDialog',{accept:true});original(event)}
  await evaluate(`Array.from(document.querySelectorAll('.image-panel .gallery-assets article')[4].querySelectorAll('button')).find(e=>e.textContent==='移除圖片').click()`)
  await until(`document.querySelectorAll('.image-panel .gallery-assets article').length===${5-n}&&!document.querySelector('.image-panel .gallery-assets article button:nth-of-type(2)').disabled`)
  ws.onmessage=original
 }
 check('employee: removing images persists a four-image gallery',(await api('/admin/products/'+f.id+'/image?gallery=true')).images.length===4)
 // Restore the full figure as primary and its original order before leaving the fixture.
 let restored=await api('/admin/products/'+f.id+'/image?gallery=true');const main=restored.images.find(i=>i.type==='MAIN')
 restored=(await api('/admin/products/'+f.id+'/image','POST',{requestId:crypto.randomUUID(),expectedVersion:restored.version,expectedActorId:actor.id,action:'COVER',imageId:main.id})).current
 const ordered=[main.id,...restored.images.filter(i=>i.id!==main.id).map(i=>i.id)]
 restored=(await api('/admin/products/'+f.id+'/image','POST',{requestId:crypto.randomUUID(),expectedVersion:restored.version,expectedActorId:actor.id,action:'REORDER',imageIds:ordered})).current
 await api('/admin/products/'+f.id+'/publication','PATCH',{expectedVersion:restored.version,published:true})

 // Simulate a broken media URL with DevTools; response data stays real.
 await navigate('/shop/products/'+fixtures[1].id,'.product-gallery');await until(`document.querySelectorAll('.thumbnails button').length===4`)
 await cdp('Network.enable');await cdp('Network.setBlockedURLs',{urls:['*/api/catalog/products/*/image/*']})
 await click('.thumbnails button:nth-child(2)');await until(`document.querySelector('.expand .cover-empty')?.innerText.includes('暫時無法載入')`);check('customer: broken image shows readable fallback',true)
 await cdp('Network.setBlockedURLs',{urls:[]})
 check('product image endpoint remains compatible for the App',!!(await api('/catalog/products/'+fixtures[1].id)).image.url)
 for(const width of [1440,390]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1050,deviceScaleFactor:1,mobile:false})
  await cdp('Page.navigate',{url:process.env.FIGURA_SAMPLE_URL||'http://127.0.0.1:18279/docs/comfyui-figure-samples.html'})
  await until(`location.pathname.endsWith('/docs/comfyui-figure-samples.html')&&document.images.length===12`)
  await evaluate(`Array.from(document.images).forEach(i=>i.loading='eager')`)
  await until(`Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)`)
  check(`static comparison ${width}px: 8 AVIF and 4 rejected WebP decode`,await evaluate(`Array.from(document.images).filter(i=>i.currentSrc.endsWith('.avif')).length===8&&Array.from(document.images).filter(i=>i.currentSrc.endsWith('.webp')).length===4`))
  check(`static comparison ${width}px: readable disclosure and no overflow`,await evaluate(`document.documentElement.scrollWidth<=innerWidth&&document.body.innerText.includes('作者尚未簽核')`))
  const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(out,`comparison-${width}.png`),Buffer.from(shot.data,'base64'))
 }
 await writeFile(resolve(out,'results.json'),JSON.stringify({scope:'local isolated production-dist integration; not production CWV or device acceptance',checks,passed:checks.length,measurements},null,2));console.log(JSON.stringify({passed:checks.length,checks},null,2))
 await cdp('Browser.close')
}catch(error){
 if(cdp&&evaluate){try{await writeFile(resolve(out,'failure.txt'),await evaluate('document.body.innerText'));const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,'failure.png'),Buffer.from(shot.data,'base64'))}catch{}}
 throw error
}finally{ws?.close();if(chrome.exitCode===null)chrome.kill()}
