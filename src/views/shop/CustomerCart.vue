<script setup lang="ts">
import { computed,onBeforeUnmount,onMounted,reactive,ref } from 'vue'
import { onBeforeRouteLeave,useRouter } from 'vue-router'
import { CustomerApiError, getCustomer } from '@/api/customer'
import { useCustomerStore } from '@/stores/customer'
import { reviewItems, clearReview, loadReview, reloadGuest, guestLines, setGuest, removeGuest, mergeGuestCart, lastMerge, rememberReturn, serverCount, countOf, guestKey, MAX_QTY, MAX_PRE_QTY } from './guestCart'
import { getCart,setCartItem,removeCartItem,setCartPreorder,removeCartPreorder,issueText,preorderIssueText,type CartView } from '@/api/shopping'
import { publicBatch, type PublicBatch } from '@/api/preorders'
import { money } from '@/api/catalog'
import ProductCover from './ProductCover.vue'
import { useCatalog } from './useCatalog'
const catalog=useCatalog(),imageOf=(productId:string)=>catalog.products.value.find(p=>p.id===productId)?.image
onMounted(()=>catalog.load())
const router=useRouter(),cart=ref<CartView>(),quantities=ref<Record<string,number>>({}),busy=ref(false),error=ref(''),success=ref(''),needsReload=ref(false)
async function load(){if(busy.value)return;busy.value=true;error.value='';pending.clear();clearTimeout(timer);timer=undefined;try{const loadedCart=await getCart();cart.value=loadedCart;serverCount.value=countOf(loadedCart);quantities.value=serverQuantities(cart.value);needsReload.value=false}catch(e){if(cart.value)quantities.value=serverQuantities(cart.value);await failure(e)}finally{busy.value=false}}
/** 輸入框鍵：現貨用 skuId，預購用 B:<batchId>。 */
const preKey=(batchId:string)=>'B:'+batchId
const serverQuantities=(c:CartView):Record<string,number>=>Object.fromEntries([...c.items.map(i=>[i.skuId,i.quantity] as const),...(c.preorders||[]).map(p=>[preKey(p.batchId),p.quantity] as const)])
async function failure(e:unknown){error.value=e instanceof Error?e.message:'操作失敗';if(e instanceof CustomerApiError&&e.status===401){rememberReturn('/shop/cart');await router.replace('/shop/login')}}
// 數量用 −／＋ 或直接輸入，停手約 0.35 秒後自動儲存（不用另按「更新」）。
// quantities 是輸入框顯示的草稿；pending 才是已驗證、排隊要送的數量。每次仍是「整車版本＋絕對數量」寫入，
// 一次只送一筆；送出中再按的數量排隊，等這次回應後用新版本送最新值。
const pending=reactive(new Map<string,number>()),saving=ref(false),editing=ref('')
let timer:ReturnType<typeof setTimeout>|undefined,inflight:Promise<void>|null=null
const serverQty=(key:string)=>key.startsWith('B:')?cart.value?.preorders.find(p=>preKey(p.batchId)===key)?.quantity:cart.value?.items.find(i=>i.skuId===key)?.quantity
const maxOf=(key:string)=>key.startsWith('B:')?MAX_PRE_QTY:99
const validFor=(key:string,q:unknown):q is number=>Number.isInteger(q)&&(q as number)>=1&&(q as number)<=maxOf(key)
function queue(skuId:string,q:number,delay=350){pending.set(skuId,q);clearTimeout(timer);timer=setTimeout(flush,delay)}
function flush(){
 timer=undefined
 if(busy.value||needsReload.value)return
 for(const [skuId,q] of [...pending]){pending.delete(skuId);const now=serverQty(skuId);if(now!==undefined&&now!==q){void change(skuId,false,q);return}}
}
function bump(skuId:string,delta:number){const draft=quantities.value[skuId],base=pending.get(skuId)??(validFor(skuId,draft)?draft:serverQty(skuId)??1),q=base+delta;if(!validFor(skuId,q))return;error.value='';quantities.value[skuId]=q;queue(skuId,q)}
function typed(skuId:string){const q=quantities.value[skuId];if(!validFor(skuId,q)){error.value=`數量需為 1–${maxOf(skuId)} 的整數。`;quantities.value[skuId]=pending.get(skuId)??serverQty(skuId)??1;return}error.value='';queue(skuId,q,0)}
// 400：只有這一款數量不合法，還原這一款，其他排隊的照送。
// 409：伺服器明確拒絕（庫存不足、別處改過購物車），沒有寫入；自動重讀一次顯示實際數量，不重送。
// 其他（網路中斷、回應無法判讀）：結果未知，鎖住直到手動「重新核對購物車」。
async function change(skuId:string,remove=false,q?:number){
 if(busy.value||!cart.value||needsReload.value)return
 let done!:()=>void;inflight=new Promise(r=>done=r)
 busy.value=true;saving.value=!remove;error.value='';success.value='';let rejected=false;if(remove)pending.delete(skuId)
 try{const pre=skuId.startsWith('B:'),batch=skuId.slice(2)
  cart.value=pre?(remove?await removeCartPreorder(batch,cart.value.version):await setCartPreorder(batch,q!,cart.value.version)):(remove?await removeCartItem(skuId,cart.value.version):await setCartItem(skuId,q!,cart.value.version));serverCount.value=countOf(cart.value)
  // 送出中又按過、或正在輸入的款式保留畫面上的數字
  quantities.value=Object.fromEntries(Object.entries(serverQuantities(cart.value)).map(([k,v])=>[k,editing.value===k?(quantities.value[k]??v):pending.get(k)??v] as const));if(remove)success.value='品項已移除。'}
 catch(e){
  const status=e instanceof CustomerApiError?e.status:0
  if(status===400&&!remove){pending.delete(skuId);quantities.value[skuId]=serverQty(skuId)??1}
  else{pending.clear();clearTimeout(timer);timer=undefined;rejected=status===409;needsReload.value=status!==400}
  await failure(e);if(!(e instanceof CustomerApiError))error.value='回應未確認，請重新核對購物車後再操作。'
 }
 finally{
  busy.value=false;saving.value=false;inflight=null;done()
  if(rejected){const why=error.value;await load();if(!needsReload.value&&!error.value)error.value=why.replace(/[，,]?\s*請重新核對$/,'')+'，已改回購物車目前的數量。'}
  else if(pending.size&&!timer)flush()
 }
}
// 離開前先把排隊的數量送完（最多等 8 秒）；仍未完成才詢問。重新整理／關閉分頁時有未送數量則由瀏覽器提醒。
onBeforeRouteLeave(async to=>{
 if(to.path==='/shop/login')return true
 if(timer){clearTimeout(timer);flush()}
 const until=Date.now()+8000
 while(inflight&&Date.now()<until)await Promise.race([inflight,new Promise(r=>setTimeout(r,300))])
 return !(inflight||pending.size)||window.confirm('購物車數量還在儲存，確定要離開嗎？')
})
const warnUnload=(e:BeforeUnloadEvent)=>{if(inflight||pending.size)e.preventDefault()}
window.addEventListener('beforeunload',warnUnload)
onBeforeUnmount(()=>{window.removeEventListener('beforeunload',warnUnload);clearTimeout(timer)})
// 結帳在獨立的結帳頁：購物車只管商品與數量。離開時上面的守衛會先把排隊的數量存完。
const hasLines=computed(()=>!!cart.value&&(cart.value.items.length>0||(cart.value.preorders||[]).length>0))
function goCheckout(){if(busy.value||pending.size||needsReload.value||!cart.value?.checkoutReady)return;void router.push('/shop/checkout')}
// ---- 訪客／會員模式 ----
// 未登入：顯示這台瀏覽器的訪客購物車（只存款式與數量），價格與狀態取公開商品資料；結帳時才要求登入。
// 已登入：若有訪客購物車先合併，再讀本人伺服器購物車（原有流程）。
const customerStore=useCustomerStore(),mode=ref<'loading'|'guest'|'member'>('loading'),mergeNote=ref(lastMerge.value)
async function start(){
 mode.value='loading';error.value=''
 try{customerStore.profile=await getCustomer()}
 catch(e){if(e instanceof CustomerApiError&&e.status===401){customerStore.clear();mode.value='guest';return}error.value=e instanceof Error?e.message:'讀取登入狀態失敗，請重試。';return}
 mode.value='member'
 reloadGuest()
 loadReview(customerStore.profile!.id)
 if(guestLines.value.length){busy.value=true;try{mergeNote.value=await mergeGuestCart(customerStore.profile!.id)}finally{busy.value=false}}
 await load()
}
onMounted(start)
onBeforeUnmount(()=>{lastMerge.value=null})
// 合併結果：成功件數、未加入的款式與原因、需要核對的款式（結果未確認）與錯誤，全部顯示給顧客
// 商品或款式查不到（已下架、目錄讀取失敗）時，以款式編號前 8 碼辨識
const titleOf=(productId:string,skuId?:string)=>{const p=catalog.products.value.find(x=>x.id===productId);const s=p?.skus.find(x=>x.id===skuId);const code=skuId?`（款式編號 ${skuId.slice(0,8)}）`:'';if(!p)return '已下架商品'+code;return s?`${p.title}・${s.label}`:p.title+code}
const mergeMerged=computed(()=>mergeNote.value?.merged?`已把登入前加入的 ${mergeNote.value.merged} 種款式合併進你的購物車（同款數量相加）。`:'')
const guestQty=ref<Record<string,number>>({})
// 訪客預購品項：價格、配額、截單狀態取公開批次資料（讀不到視為已下架）
const guestBatches=ref<Record<string,PublicBatch|null>>({})
async function loadGuestBatches(){for(const l of guestLines.value){if(l.batchId&&!(l.batchId in guestBatches.value)){const id=l.batchId;try{guestBatches.value={...guestBatches.value,[id]:await publicBatch(id)}}catch{guestBatches.value={...guestBatches.value,[id]:null}}}}}
const guestView=computed(()=>{
 const products=new Map(catalog.products.value.map(p=>[p.id,p]))
 return guestLines.value.map(l=>{
  const key=guestKey(l)
  if(l.batchId){
   const b=guestBatches.value[l.batchId]
   const issue=b===undefined?null:!b?'UNAVAILABLE':!b.orderingEnabled?'CLOSED':l.quantity>b.availableQuota?'INSUFFICIENT_QUOTA':null
   return {...l,key,pre:true,title:b?.productTitle||'預購商品',label:b?`${b.name}・${b.skuLabel}`:'—',price:b?.priceTwd??null,image:products.get(l.productId)?.image,issue,arrival:b?`${b.arrivalFrom} ～ ${b.arrivalTo}`:'',lineTotal:b&&!issue?b.priceTwd*l.quantity:null}
  }
  const p=products.get(l.productId),sku=p?.skus.find(s=>s.id===l.skuId)
  const issue=!p||!sku?'UNAVAILABLE':!sku.available?'SOLD_OUT':null
  return {...l,key,pre:false,title:p?.title||'已下架商品',label:sku?.label||'—',price:sku?.priceTwd??null,image:p?.image,issue,arrival:'',lineTotal:sku&&!issue?sku.priceTwd*l.quantity:null}
 })
})
const guestIssueText=(item:{pre:boolean;issue:string|null})=>item.pre?preorderIssueText(item.issue as any):issueText(item.issue as any)
const guestSubtotal=computed(()=>guestView.value.reduce((s,l)=>s+(l.lineTotal||0),0))
const guestReady=computed(()=>guestView.value.some(l=>!l.issue))
function syncGuestQty(){guestQty.value=Object.fromEntries(guestLines.value.map(l=>[guestKey(l),l.quantity]))}
syncGuestQty()
onMounted(()=>{void loadGuestBatches()})
function guestBump(skuId:string,delta:number){const q=(guestQty.value[skuId]||1)+delta;if(q<1||q>(skuId.startsWith('B:')?MAX_PRE_QTY:MAX_QTY))return;guestQty.value[skuId]=q;guestUpdate(skuId)}
function guestUpdate(skuId:string){error.value='';success.value='';try{setGuest(skuId,Number(guestQty.value[skuId]))}catch(e){error.value=e instanceof Error?e.message:'數量不正確';syncGuestQty()}}
function guestRemove(skuId:string){error.value='';removeGuest(skuId);syncGuestQty();success.value='品項已移除。'}
// 訪客：登入（或註冊後登入）會合併訪客購物車，接著回到結帳頁
function goLogin(path:'/shop/login'|'/shop/register'){rememberReturn('/shop/checkout');router.push(path)}
</script>
<template>
 <section class="cart-page">
  <div class="cart-head">
   <h1>我的購物車</h1>
   <ol class="steps" aria-label="結帳步驟"><li aria-current="step">1 購物車</li><li>2 建立訂單</li><li>3 付款</li></ol>
  </div>
  <p v-if="error" role="alert" class="shop-error">{{ error }}</p><p v-if="success" role="status" class="shop-success">{{ success }}</p>
  <div v-if="mode==='member'&&mergeNote" class="merge-note" data-testid="merge-result">
   <p v-if="mergeMerged" class="shop-success" role="status">{{ mergeMerged }}</p>
   <p v-if="mergeNote.error" class="shop-error" role="alert">{{ mergeNote.error }}</p>
  </div>
  <div v-if="mode==='member'&&reviewItems.length" class="review-box" data-testid="merge-review">
   <div v-if="reviewItems.some(r=>r.kind==='uncertain')" class="shop-error" role="alert">
    <p>以下款式在登入前加入購物車，但合併結果未確認，可能已經加入。請核對下方購物車數量，需要時自行調整：</p>
    <ul><li v-for="m in reviewItems.filter(r=>r.kind==='uncertain')" :key="'u'+m.skuId">{{ titleOf(m.productId,m.skuId) }}（登入前加入 {{ m.quantity }} 件）：{{ m.reason }}</li></ul>
   </div>
   <div v-if="reviewItems.some(r=>r.kind==='skipped')" class="merge-skipped" role="status"><p>以下款式沒有加入購物車：</p>
    <ul><li v-for="m in reviewItems.filter(r=>r.kind==='skipped')" :key="'s'+m.skuId">{{ titleOf(m.productId,m.skuId) }}（{{ m.quantity }} 件）：{{ m.reason }}</li></ul>
   </div>
   <button type="button" class="shop-button ghost" @click="clearReview">我已了解</button>
  </div>
  <p v-if="mode==='loading'&&!error" role="status">正在載入…</p>
  <button v-if="mode==='loading'&&error" class="shop-button" @click="start">重新載入</button>

  <!-- 訪客購物車 -->
  <div v-if="mode==='guest'" class="cart-layout">
   <div class="cart-lines">
    <div class="cart-toolbar"><span>尚未登入：購物車先存在這台裝置，結帳時再登入；價格與庫存以下單時伺服器核對為準。</span></div>
    <p v-if="!guestView.length" data-testid="guest-cart-empty" class="shop-empty">購物車目前是空的。<router-link to="/shop/products">探索收藏商品 →</router-link></p>
    <article v-for="item in guestView" :key="item.key" class="cart-line" :class="{ issue: item.issue }" :data-testid="item.pre?'guest-cart-pre-'+item.batchId:'guest-cart-'+item.skuId">
     <router-link class="thumb" :to="'/shop/products/'+item.productId" :aria-label="'查看商品 '+item.title"><ProductCover :image="item.image" /></router-link>
     <div class="line-info"><p class="kind-tag" :class="item.pre?'pre':'stock'">{{ item.pre?'預購':'現貨' }}</p><h2>{{ item.title }}</h2><p>{{ item.pre?'批次':'款式' }}：{{ item.label }}</p><p v-if="item.arrival">預計到貨 {{ item.arrival }}</p><p>{{ item.price===null?'下架款式暫不計價':money(item.price)+'／件' }}</p><p v-if="item.issue" class="shop-error">{{ guestIssueText(item) }}</p></div>
     <div class="qty-step" role="group" :aria-label="'數量：'+item.title"><button type="button" aria-label="減少數量" :disabled="item.issue==='UNAVAILABLE'||guestQty[item.key]<=1" @click="guestBump(item.key,-1)">−</button><input :id="'gqty-'+item.key" aria-label="數量" v-model.number="guestQty[item.key]" type="number" inputmode="numeric" min="1" :max="item.pre?MAX_PRE_QTY:MAX_QTY" step="1" :disabled="item.issue==='UNAVAILABLE'" @change="guestUpdate(item.key)" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"><button type="button" aria-label="增加數量" :disabled="item.issue==='UNAVAILABLE'||guestQty[item.key]>=(item.pre?MAX_PRE_QTY:MAX_QTY)" @click="guestBump(item.key,1)">+</button></div>
     <div class="line-end"><strong class="line-total">{{ item.lineTotal===null?'不計價':money(item.lineTotal) }}</strong><button class="remove-button" @click="guestRemove(item.key)">移除</button></div>
    </article>
    <p v-if="guestView.some(i=>i.issue)" class="issue-note">有問題的款式未計入小計，請調整或移除。</p>
    <div class="pre-hint">現貨與預購可以放在同一個購物車；結帳時系統會自動拆成現貨訂單與各預購批次的訂單。</div>
   </div>
   <aside v-if="guestView.length" class="checkout-panel" aria-labelledby="guest-checkout-title">
    <h2 id="guest-checkout-title">結帳</h2>
    <div class="sum-row"><span>預估商品小計</span><span data-testid="guest-cart-subtotal">{{ money(guestSubtotal) }}</span></div>
    <div class="sum-row"><span>運費</span><span>結帳時顯示</span></div>
    <div class="sum-row total"><span>預估金額</span><strong>{{ money(guestSubtotal) }}</strong></div>
    <p class="fine">登入後購物車會自動合併到你的帳號並進入結帳頁，由伺服器重新核對價格與庫存，再確認收件資料下單。</p>
    <button class="shop-button primary checkout-btn" :disabled="!guestReady" @click="goLogin('/shop/login')">登入後結帳</button>
    <p class="fine guest-register">還沒有帳號？<a href="/shop/register" @click.prevent="goLogin('/shop/register')">建立顧客帳號</a></p>
   </aside>
  </div>

  <div v-if="mode==='member'" class="cart-layout">
   <div class="cart-lines">
    <div class="cart-toolbar"><span>價格與商品狀態由伺服器重新核對，購物車不保留庫存。</span><button class="shop-button ghost" :disabled="busy" @click="load">重新核對購物車</button></div>
    <p v-if="busy&&!cart" role="status">正在載入…</p>
    <template v-if="cart">
     <p v-if="!hasLines" data-testid="cart-empty" class="shop-empty">購物車目前是空的。<router-link to="/shop/products">探索收藏商品 →</router-link></p>
     <article v-for="item in cart.items" :key="item.skuId" class="cart-line" :class="{ issue: item.issue }" :data-testid="'cart-'+item.skuId">
      <router-link class="thumb" :to="'/shop/products/'+item.productId" :aria-label="'查看商品 '+item.title"><ProductCover :image="imageOf(item.productId)" /></router-link>
      <div class="line-info"><h2>{{ item.title }}</h2><p>款式：{{ item.label }}</p><p>{{ item.unitPriceTwd===null?'下架款式暫不計價':money(item.unitPriceTwd)+'／件' }}</p><p v-if="item.issue" class="shop-error">{{ issueText(item.issue) }}</p></div>
      <div class="qty-step" role="group" :aria-label="'數量：'+item.title"><button type="button" aria-label="減少數量" :disabled="(busy&&!saving)||needsReload||item.issue==='UNAVAILABLE'||quantities[item.skuId]<=1" @click="bump(item.skuId,-1)">−</button><input :id="'qty-'+item.skuId" aria-label="數量" v-model.number="quantities[item.skuId]" type="number" inputmode="numeric" min="1" max="99" step="1" :disabled="(busy&&!saving)||needsReload||item.issue==='UNAVAILABLE'" @focus="editing=item.skuId" @blur="editing=''" @change="typed(item.skuId)" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"><button type="button" aria-label="增加數量" :disabled="(busy&&!saving)||needsReload||item.issue==='UNAVAILABLE'||quantities[item.skuId]>=99" @click="bump(item.skuId,1)">+</button></div>
      <div class="line-end"><strong class="line-total">{{ item.lineTotalTwd===null?'不計價':money(item.lineTotalTwd) }}</strong><button class="remove-button" :disabled="busy||needsReload" @click="change(item.skuId,true)">移除款式</button></div>
     </article>
     <h2 v-if="cart.preorders.length" class="section-title">預購（結帳時每個批次各成一張訂單）</h2>
     <article v-for="p in cart.preorders" :key="'pre-'+p.batchId" class="cart-line" :class="{ issue: p.issue }" :data-testid="'cart-pre-'+p.batchId">
      <router-link class="thumb" :to="'/shop/products/'+p.productId+'#batch-'+p.batchId" :aria-label="'查看預購 '+p.title"><ProductCover :image="imageOf(p.productId)" /></router-link>
      <div class="line-info"><p class="kind-tag pre">預購</p><h2>{{ p.title }}</h2><p>批次：{{ p.batchName }}・{{ p.label }}</p><p>預計到貨 {{ p.arrivalFrom }} ～ {{ p.arrivalTo }}</p><p>{{ money(p.unitPriceTwd) }}／件 · 剩餘配額 {{ p.availableQuota }}</p><p v-if="p.issue" class="shop-error">{{ preorderIssueText(p.issue) }}</p></div>
      <div class="qty-step" role="group" :aria-label="'數量：'+p.title"><button type="button" aria-label="減少數量" :disabled="(busy&&!saving)||needsReload||p.issue==='UNAVAILABLE'||quantities[preKey(p.batchId)]<=1" @click="bump(preKey(p.batchId),-1)">−</button><input :id="'qty-pre-'+p.batchId" aria-label="數量" v-model.number="quantities[preKey(p.batchId)]" type="number" inputmode="numeric" min="1" :max="MAX_PRE_QTY" step="1" :disabled="(busy&&!saving)||needsReload||p.issue==='UNAVAILABLE'" @focus="editing=preKey(p.batchId)" @blur="editing=''" @change="typed(preKey(p.batchId))" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"><button type="button" aria-label="增加數量" :disabled="(busy&&!saving)||needsReload||p.issue==='UNAVAILABLE'||quantities[preKey(p.batchId)]>=MAX_PRE_QTY" @click="bump(preKey(p.batchId),1)">+</button></div>
      <div class="line-end"><strong class="line-total">{{ p.issue?'不計價':money(p.lineTotalTwd) }}</strong><button class="remove-button" :disabled="busy||needsReload" @click="change(preKey(p.batchId),true)">移除</button></div>
     </article>
     <p v-if="cart.items.some(i=>i.issue)||cart.preorders.some(p=>p.issue)" class="issue-note">有問題的品項未計入小計，請調整或移除。</p>
    </template>
    <div class="pre-hint">現貨與預購可以放在同一個購物車；結帳時系統會自動拆成現貨訂單與各預購批次的訂單，購物車不保留庫存或配額。</div>
   </div>

   <aside v-if="cart&&hasLines" class="checkout-panel" aria-labelledby="checkout-title">
    <h2 id="checkout-title">購物車小計</h2>
    <div class="sum-row"><span>現貨小計</span><span data-testid="cart-subtotal">可用款式小計：{{ money(cart.subtotalTwd) }}</span></div>
    <div v-if="cart.preorders.length" class="sum-row"><span>預購小計</span><span data-testid="cart-pre-subtotal">{{ money(cart.preorderSubtotalTwd) }}</span></div>
    <div class="sum-row"><span>運費</span><span>結帳時顯示</span></div>
    <div class="sum-row total"><span>預估金額</span><strong data-testid="cart-total">{{ money(cart.totalTwd) }}</strong></div>
    <button class="shop-button primary checkout-btn" data-testid="go-checkout" :disabled="busy||pending.size>0||needsReload||!cart.checkoutReady" @click="goCheckout">前往結帳</button>
    <p v-if="!cart.checkoutReady" class="fine warn">有品項無法購買，請調整或移除後再結帳。</p>
    <p class="fine">收件資料與付款方式在下一步填寫；前往結帳不會保留庫存，按「確認下單」時才保留。</p>
   </aside>
  </div>
 </section>
</template>
<style scoped>
.cart-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.cart-head h1{margin:0}
.steps{list-style:none;margin:0;padding:0;display:flex;gap:8px;flex-wrap:wrap;font-size:14px}.steps li{background:#fff;color:#4b5060;padding:7px 14px;border-radius:999px}.steps li[aria-current]{background:#1b1f3b;color:#fff;font-weight:700}
.cart-layout{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
.cart-lines{flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:12px}
.cart-toolbar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;font-size:13px;color:#4b5060}
.cart-line{background:#fff;border-radius:14px;padding:16px;display:grid;grid-template-columns:96px minmax(0,1fr) auto auto;gap:16px;align-items:center;overflow-wrap:anywhere;border:1px solid transparent}
.cart-line.issue{border-color:#f5c2c2}
.thumb{display:block;width:96px}.thumb :deep(.cover-empty small){display:none}
.line-info h2{font-size:16px;margin:0 0 4px;line-height:1.45}.shop-shell .line-info p{margin:0;font-size:13px}.shop-shell .line-info .shop-error{margin-top:6px;display:inline-block;padding:6px 10px}
.qty-step{display:inline-flex;align-items:stretch;border:1px solid #d6d9e2;border-radius:10px;overflow:hidden;background:#fff;height:40px}
.qty-step button{width:38px;border:0;background:#f3f4f8;color:#15161a;font:inherit;font-size:18px;line-height:1;cursor:pointer}.qty-step button:hover:not(:disabled){background:#e6e8ef}.qty-step button:disabled{color:#b5b8c4;cursor:not-allowed}
.shop-shell .qty-step input{width:48px;border:0;border-left:1px solid #d6d9e2;border-right:1px solid #d6d9e2;border-radius:0;padding:0;margin:0;text-align:center;font-size:15px;font-weight:700;-moz-appearance:textfield;appearance:textfield}.qty-step input::-webkit-inner-spin-button,.qty-step input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.line-end{display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:96px}.line-total{font-size:17px;font-weight:900}
.remove-button{border:0;background:transparent;color:#4b5060;font:inherit;font-size:14px;text-decoration:underline;padding:8px 4px;cursor:pointer;min-height:40px}.remove-button:disabled{opacity:.5;cursor:not-allowed}
.issue-note{margin:0;font-size:14px}
.section-title{font-size:16px;margin:8px 0 0}.shop-shell .kind-tag{display:inline-block;font-size:12px;border-radius:6px;padding:1px 8px;margin:0 0 4px}.kind-tag.stock{background:#eef2ff;color:#3730a3}.kind-tag.pre{background:#fff7ed;color:#9a3412}
.merge-note{margin:0 0 12px;display:flex;flex-direction:column;gap:8px}.merge-note p{margin:0}.merge-note ul{margin:6px 0 0;padding-left:20px}.review-box{margin:0 0 12px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}.review-box>div{align-self:stretch}.review-box ul{margin:6px 0;padding-left:20px}.merge-skipped{background:#fff7f1;border:1px solid #fed7bd;border-radius:12px;padding:12px 14px;font-size:14px;color:#7c2d12}.guest-register{text-align:center;font-size:14px}
.pre-hint{background:#fff7f1;border:1px solid #fed7bd;border-radius:12px;padding:14px 16px;font-size:14px;color:#7c2d12}.shop-shell .pre-hint a{color:#9a3412;font-weight:700}
.checkout-panel{flex:1 1 340px;min-width:0;background:#fff;border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:10px;position:sticky;top:140px}
.checkout-panel h2{font-size:20px;margin:0 0 4px}
.sum-row{display:flex;justify-content:space-between;gap:12px;font-size:14px;color:#4b5060}.sum-row.total{border-top:1px solid #e3e5ec;padding-top:12px;align-items:baseline;color:#15161a;font-weight:700}.sum-row.total strong{font-size:22px;font-weight:900;color:#c2410c;text-align:right}
.checkout-btn{font-size:17px;padding:16px;margin-top:6px}.fine{font-size:12px;margin:0}.warn{color:#b42318}
@media(max-width:768px){.cart-line{grid-template-columns:72px minmax(0,1fr);gap:12px}.thumb{width:72px}.qty-step{grid-column:1/-1;justify-self:start}.line-end{grid-column:1/-1;flex-direction:row;justify-content:space-between;align-items:center}.checkout-panel{position:static}}
</style>
