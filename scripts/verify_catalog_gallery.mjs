// Read-only browser verification against the existing loopback demo catalog.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createWriteStream} from 'node:fs'
import {setTimeout as delay} from 'node:timers/promises'
const root='http://127.0.0.1:15181'
const manifest=JSON.parse(await readFile('docs/verification/catalog-gallery-manifest.json','utf8'))
const wanted=new Set(process.argv.slice(2))
const products=manifest.products.filter(p=>!wanted.size||wanted.has(p.productKey))
const out=resolve('work/catalog-gallery/browser');await mkdir(out,{recursive:true})
const profile=resolve(out,'chrome-'+Date.now())
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-gpu-sandbox','--disable-gpu','--disable-extensions','--disable-sync','--no-first-run','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']})
chrome.stderr.pipe(createWriteStream(resolve(out,'chrome.stderr.log')))
let ws,cdp,evaluate
const checks=[]
const network=[]
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await delay(100)}throw Error('Timeout: '+expression)}
try{
 let port;for(let i=0;i<100&&!port;i++){try{[port]=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')}catch{await delay(100)}}assert(port,'Chrome startup')
 const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl)
 await new Promise((ok,bad)=>{ws.onopen=ok;ws.onerror=bad})
 let id=0;const pending=new Map()
 ws.onclose=e=>{for(const p of pending.values())p.reject(Error('CDP closed '+e.code));pending.clear()}
 ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(m.method==='Network.loadingFailed')network.push(m.params);if(m.method==='Network.responseReceived'&&m.params.type==='Image')network.push({url:m.params.response.url,status:m.params.response.status});if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}}
 cdp=(method,params={})=>new Promise((ok,bad)=>{const requestId=++id;const timeout=setTimeout(()=>{pending.delete(requestId);bad(Error('CDP timeout '+method))},30000);pending.set(requestId,{resolve:r=>{clearTimeout(timeout);ok(r)},reject:e=>{clearTimeout(timeout);bad(e)}});ws.send(JSON.stringify({id:requestId,method,params}))})
 evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value}
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable')
 for(const width of [1440,390]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1050,deviceScaleFactor:1,mobile:false})
  for(const [n,p]of products.entries()){
   const expected=Object.values(p.slots).filter(s=>s.status==='complete').length
   const path='/shop/products/'+p.id
   await cdp('Page.navigate',{url:root+path})
   await until(`location.pathname===${JSON.stringify(path)}&&document.querySelector('.product-gallery .expand img')?.naturalWidth>0`)
   await until(`document.querySelectorAll('.thumbnails button').length===${expected>1?expected:0}`)
   const state=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,ai:document.querySelector('.product-gallery').textContent.includes('AI 生成示意圖'),alt:document.querySelector('.expand img').alt,src:document.querySelector('.expand img').currentSrc})`)
   assert(!state.overflow,p.productKey+' overflow');assert(state.ai,p.productKey+' visible AI label');assert(state.alt.includes('AI 生成示意圖'),p.productKey+' AI alt')
   const gallery=await(await fetch(root+'/api/catalog/products/'+p.id+'/image')).json()
   assert.equal(gallery.data.length,expected,p.productKey+' gallery count')
   assert.equal(gallery.data.find(i=>i.primary).id,p.master.imageId,p.productKey+' original main')
   const accepted=new Set(Object.entries(p.slots).filter(([,s])=>s.status==='complete').map(([t])=>t))
   assert(gallery.data.every(i=>accepted.has(i.type)),p.productKey+' rejected image leaked')
   for(let i=0;i<expected;i++){
    if(expected>1)await evaluate(`document.querySelectorAll('.thumbnails button')[${i}].click()`)
    const imageId=gallery.data[i].id
    await until(`document.querySelector('.expand img')?.src.includes(${JSON.stringify(imageId)})&&document.querySelector('.expand img')?.currentSrc.includes(${JSON.stringify(imageId)})&&document.querySelector('.expand img')?.complete&&document.querySelector('.expand img')?.naturalWidth>0`)
   }
   await evaluate(`document.querySelector('.expand').click()`)
   assert(await evaluate(`document.querySelector('dialog').open`),p.productKey+' zoom')
   await evaluate(`document.querySelector('dialog .close').click()`)
   assert(await evaluate(`document.activeElement===document.querySelector('.expand')`),p.productKey+' focus restore')
   checks.push({key:p.productKey,width,images:expected,originalMain:true,aiLabel:true,decodedAll:true,noRejectedUploads:true,noOverflow:true,zoom:true})
   if(n<3){const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,p.productKey+'-'+width+'.png'),Buffer.from(shot.data,'base64'))}
   console.log(p.productKey+' '+width+'px: verified '+expected+' local images')
  }
 }
 const report={date:new Date().toISOString(),url:root,scope:'real existing loopback demo, read-only, no API mocks',authorApproval:'pending',products:products.length,checks}
 const destination=wanted.size?resolve(out,'pilot-verification.json'):resolve('docs/verification/catalog-gallery-browser-2026-11-20.json')
 await writeFile(destination,JSON.stringify(report,null,2)+'\n')
}catch(error){
 try{await writeFile(resolve(out,'failure.json'),JSON.stringify(await evaluate(`({url:location.href,text:document.body.innerText.slice(0,5000),images:[...document.images].map(i=>({src:i.src,currentSrc:i.currentSrc,srcset:i.srcset,complete:i.complete,width:i.naturalWidth}))})`),null,2));await writeFile(resolve(out,'network.json'),JSON.stringify(network,null,2));const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,'failure.png'),Buffer.from(shot.data,'base64'))}catch{}
 throw error
}finally{ws?.close();chrome.kill()}
