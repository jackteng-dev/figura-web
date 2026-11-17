<script setup lang="ts">
import { computed,onBeforeUnmount,onMounted,ref } from 'vue'
import { useRouter } from 'vue-router'
import { CustomerApiError, getCustomer } from '@/api/customer'
import { useCustomerStore } from '@/stores/customer'
import { reloadGuest, guestLines, setGuest, removeGuest, mergeGuestCart, lastMerge, rememberReturn, serverCount, countOf, MAX_QTY } from './guestCart'
import { getCart,setCartItem,removeCartItem,issueText,type CartView } from '@/api/shopping'
import { getAddresses,type AddressView } from '@/api/shopping'
import { placeOrder,type PlaceOrder } from '@/api/orders'
import { money } from '@/api/catalog'
import ProductCover from './ProductCover.vue'
import { useCatalog } from './useCatalog'
const catalog=useCatalog(),imageOf=(productId:string)=>catalog.products.value.find(p=>p.id===productId)?.image
onMounted(()=>catalog.load())
const router=useRouter(),cart=ref<CartView>(),quantities=ref<Record<string,number>>({}),busy=ref(false),error=ref(''),success=ref(''),needsReload=ref(false)
const addresses=ref<AddressView[]>([]),addressId=ref(''),orderAttempt=ref<PlaceOrder>(),orderUnknown=ref(false)
const selectedAddress=computed(()=>addresses.value.find(a=>a.id===addressId.value))
async function load(){if(orderUnknown.value)return;if(busy.value)return;busy.value=true;error.value='';try{const [loadedCart,loadedAddresses]=await Promise.all([getCart(),getAddresses()]);cart.value=loadedCart;serverCount.value=countOf(loadedCart);addresses.value=loadedAddresses;if(!addresses.value.some(a=>a.id===addressId.value))addressId.value=addresses.value[0]?.id||'';quantities.value=Object.fromEntries(cart.value.items.map(i=>[i.skuId,i.quantity]));needsReload.value=false}catch(e){await failure(e)}finally{busy.value=false}}
async function failure(e:unknown){error.value=e instanceof Error?e.message:'操作失敗';if(e instanceof CustomerApiError&&e.status===401){rememberReturn('/shop/cart');await router.replace('/shop/login')}}
async function change(skuId:string,remove=false){if(busy.value||!cart.value||needsReload.value||orderUnknown.value)return;busy.value=true;error.value='';success.value='';try{cart.value=remove?await removeCartItem(skuId,cart.value.version):await setCartItem(skuId,quantities.value[skuId],cart.value.version);serverCount.value=countOf(cart.value);quantities.value=Object.fromEntries(cart.value.items.map(i=>[i.skuId,i.quantity]));success.value=remove?'款式已移除。':'數量已更新。'}catch(e){needsReload.value=!(e instanceof CustomerApiError&&e.status===400);await failure(e);if(!(e instanceof CustomerApiError))error.value='回應未確認，請重新核對購物車後再操作。'}finally{busy.value=false}}
async function checkout(){
 if(busy.value||!cart.value||needsReload.value)return
 if(!orderUnknown.value){
  const address=addresses.value.find(a=>a.id===addressId.value)
  if(!cart.value.ready||!address)return
  if(cart.value.items.some(i=>quantities.value[i.skuId]!==i.quantity)){error.value='請先更新或重新核對未儲存的數量。';return}
  if(!window.confirm('確認金額與收件地址，建立待付款訂單？庫存保留 30 分鐘，付款僅提供模擬，不會實際收款。'))return
  orderAttempt.value={requestId:crypto.randomUUID(),cartVersion:cart.value.version,addressId:address.id,addressVersion:address.version,expectedSubtotalTwd:cart.value.subtotalTwd}
 }
 busy.value=true;error.value=''
 try{await placeOrder(orderAttempt.value!);orderUnknown.value=false;await router.push('/shop/orders')}
 catch(e){await failure(e);orderUnknown.value=!(e instanceof CustomerApiError&&[400,404,409].includes(e.status));if(orderUnknown.value)error.value='下單結果未確認，請用同一操作重試，或到我的訂單核對；不要重新建立另一筆。';else{needsReload.value=true;orderAttempt.value=undefined}}
 finally{busy.value=false}
}
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
 if(guestLines.value.length){busy.value=true;try{mergeNote.value=await mergeGuestCart()}finally{busy.value=false}}
 await load()
}
onMounted(start)
onBeforeUnmount(()=>{lastMerge.value=null})
// 合併結果：成功件數、未加入的款式與原因、需要核對的款式（結果未確認）與錯誤，全部顯示給顧客
const titleOf=(productId:string)=>catalog.products.value.find(p=>p.id===productId)?.title||'已下架商品'
const mergeMerged=computed(()=>mergeNote.value?.merged?`已把登入前加入的 ${mergeNote.value.merged} 種款式合併進你的購物車（同款數量相加）。`:'')
const guestQty=ref<Record<string,number>>({})
const guestView=computed(()=>{
 const products=new Map(catalog.products.value.map(p=>[p.id,p]))
 return guestLines.value.map(l=>{
  const p=products.get(l.productId),sku=p?.skus.find(s=>s.id===l.skuId)
  const issue=!p||!sku?'UNAVAILABLE':!sku.available?'SOLD_OUT':null
  return {...l,title:p?.title||'已下架商品',label:sku?.label||'—',price:sku?.priceTwd??null,image:p?.image,issue,lineTotal:sku&&!issue?sku.priceTwd*l.quantity:null}
 })
})
const guestSubtotal=computed(()=>guestView.value.reduce((s,l)=>s+(l.lineTotal||0),0))
const guestReady=computed(()=>guestView.value.some(l=>!l.issue))
function syncGuestQty(){guestQty.value=Object.fromEntries(guestLines.value.map(l=>[l.skuId,l.quantity]))}
syncGuestQty()
function guestUpdate(skuId:string){error.value='';success.value='';try{setGuest(skuId,Number(guestQty.value[skuId]));success.value='數量已更新。'}catch(e){error.value=e instanceof Error?e.message:'數量不正確';syncGuestQty()}}
function guestRemove(skuId:string){error.value='';removeGuest(skuId);syncGuestQty();success.value='款式已移除。'}
function goLogin(path:'/shop/login'|'/shop/register'){rememberReturn('/shop/cart');router.push(path)}
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
   <div v-if="mergeNote.uncertain.length||mergeNote.error" class="shop-error" role="alert">
    <p v-if="mergeNote.error">{{ mergeNote.error }}</p>
    <ul v-if="mergeNote.uncertain.length"><li v-for="m in mergeNote.uncertain" :key="'u'+m.skuId">{{ titleOf(m.productId) }}（登入前加入 {{ m.quantity }} 件）：{{ m.reason }}</li></ul>
   </div>
   <div v-if="mergeNote.skipped.length" class="merge-skipped" role="status"><p>以下款式沒有加入購物車：</p><ul><li v-for="m in mergeNote.skipped" :key="'s'+m.skuId">{{ titleOf(m.productId) }}（{{ m.quantity }} 件）：{{ m.reason }}</li></ul></div>
  </div>
  <p v-if="mode==='loading'&&!error" role="status">正在載入…</p>
  <button v-if="mode==='loading'&&error" class="shop-button" @click="start">重新載入</button>

  <!-- 訪客購物車 -->
  <div v-if="mode==='guest'" class="cart-layout">
   <div class="cart-lines">
    <div class="cart-toolbar"><span>尚未登入：購物車先存在這台裝置，結帳時再登入；價格與庫存以下單時伺服器核對為準。</span></div>
    <p v-if="!guestView.length" data-testid="guest-cart-empty" class="shop-empty">購物車目前是空的。<router-link to="/shop/products">探索收藏商品 →</router-link></p>
    <article v-for="item in guestView" :key="item.skuId" class="cart-line" :class="{ issue: item.issue }" :data-testid="'guest-cart-'+item.skuId">
     <router-link class="thumb" :to="'/shop/products/'+item.productId" :aria-label="'查看商品 '+item.title"><ProductCover :image="item.image" /></router-link>
     <div class="line-info"><h2>{{ item.title }}</h2><p>款式：{{ item.label }}</p><p>{{ item.price===null?'下架款式暫不計價':money(item.price)+'／件' }}</p><p v-if="item.issue" class="shop-error">{{ issueText(item.issue as any) }}</p></div>
     <form class="qty-form" @submit.prevent="guestUpdate(item.skuId)"><label :for="'gqty-'+item.skuId">數量</label><input :id="'gqty-'+item.skuId" v-model.number="guestQty[item.skuId]" type="number" min="1" :max="MAX_QTY" step="1" required :disabled="item.issue==='UNAVAILABLE'"><button class="shop-button ghost" :disabled="item.issue==='UNAVAILABLE'">更新數量</button></form>
     <div class="line-end"><strong class="line-total">{{ item.lineTotal===null?'不計價':money(item.lineTotal) }}</strong><button class="remove-button" @click="guestRemove(item.skuId)">移除款式</button></div>
    </article>
    <p v-if="guestView.some(i=>i.issue)" class="issue-note">有問題的款式未計入小計，請調整或移除。</p>
    <div class="pre-hint">預購商品不會放進購物車，請在商品頁直接「預購下單」。</div>
   </div>
   <aside v-if="guestView.length" class="checkout-panel" aria-labelledby="guest-checkout-title">
    <h2 id="guest-checkout-title">結帳</h2>
    <div class="sum-row"><span>預估商品小計</span><span data-testid="guest-cart-subtotal">{{ money(guestSubtotal) }}</span></div>
    <div class="sum-row"><span>運費</span><span>NT$ 0</span></div>
    <div class="sum-row total"><span>預估金額</span><strong>{{ money(guestSubtotal) }}</strong></div>
    <p class="fine">登入後購物車會自動合併到你的帳號，並由伺服器重新核對價格與庫存，再選擇收件地址下單。</p>
    <button class="shop-button primary checkout-btn" :disabled="!guestReady" @click="goLogin('/shop/login')">登入後結帳</button>
    <p class="fine guest-register">還沒有帳號？<a href="/shop/register" @click.prevent="goLogin('/shop/register')">建立顧客帳號</a></p>
   </aside>
  </div>

  <div v-if="mode==='member'" class="cart-layout">
   <div class="cart-lines">
    <div class="cart-toolbar"><span>價格與商品狀態由伺服器重新核對，購物車不保留庫存。</span><button class="shop-button ghost" :disabled="busy||orderUnknown" @click="load">重新核對購物車</button></div>
    <p v-if="busy&&!cart" role="status">正在載入…</p>
    <template v-if="cart">
     <p v-if="!cart.items.length" data-testid="cart-empty" class="shop-empty">購物車目前是空的。<router-link to="/shop/products">探索收藏商品 →</router-link></p>
     <article v-for="item in cart.items" :key="item.skuId" class="cart-line" :class="{ issue: item.issue }" :data-testid="'cart-'+item.skuId">
      <router-link class="thumb" :to="'/shop/products/'+item.productId" :aria-label="'查看商品 '+item.title"><ProductCover :image="imageOf(item.productId)" /></router-link>
      <div class="line-info"><h2>{{ item.title }}</h2><p>款式：{{ item.label }}</p><p>{{ item.unitPriceTwd===null?'下架款式暫不計價':money(item.unitPriceTwd)+'／件' }}</p><p v-if="item.issue" class="shop-error">{{ issueText(item.issue) }}</p></div>
      <form class="qty-form" @submit.prevent="change(item.skuId)"><label :for="'qty-'+item.skuId">數量</label><input :id="'qty-'+item.skuId" v-model.number="quantities[item.skuId]" type="number" min="1" max="99" step="1" required :disabled="busy||needsReload||orderUnknown||item.issue==='UNAVAILABLE'"><button class="shop-button ghost" :disabled="busy||needsReload||orderUnknown||item.issue==='UNAVAILABLE'">更新數量</button></form>
      <div class="line-end"><strong class="line-total">{{ item.lineTotalTwd===null?'不計價':money(item.lineTotalTwd) }}</strong><button class="remove-button" :disabled="busy||needsReload||orderUnknown" @click="change(item.skuId,true)">移除款式</button></div>
     </article>
     <p v-if="cart.items.some(i=>i.issue)" class="issue-note">有問題的款式未計入小計，請調整或移除。</p>
    </template>
    <div class="pre-hint">預購商品不會放進購物車，請在商品頁直接「預購下單」，到 <router-link to="/shop/preorder-orders">我的預購</router-link> 查看。</div>
   </div>

   <aside v-if="cart?.items.length" class="checkout-panel" aria-labelledby="checkout-title">
    <h2 id="checkout-title">確認訂單</h2>
    <div class="sum-row"><span>商品小計</span><span data-testid="cart-subtotal">可用款式小計：{{ money(cart.subtotalTwd) }}</span></div>
    <div class="sum-row"><span>運費</span><span>NT$ 0</span></div>
    <div class="sum-row total"><span>應付金額</span><strong data-testid="order-total">確認總額：{{ money(cart.subtotalTwd) }}</strong></div>
    <label for="checkout-address">收件地址</label><select id="checkout-address" v-model="addressId" :disabled="busy||orderUnknown"><option value="" disabled>請選擇本人地址</option><option v-for="a in addresses" :key="a.id" :value="a.id">{{ a.recipientName }} · {{ a.postalCode }} {{ a.city }}{{ a.district }}{{ a.street }} · {{ a.phone }}</option></select>
    <p v-if="selectedAddress" class="ship-to" data-testid="checkout-shipping">{{ selectedAddress.recipientName }} · {{ selectedAddress.phone }}<br>{{ selectedAddress.postalCode }} {{ selectedAddress.city }}{{ selectedAddress.district }}{{ selectedAddress.street }}</p>
    <p v-if="!addresses.length" class="shop-error">請先新增收件地址，再重新核對購物車。</p>
    <router-link to="/shop/addresses" class="addr-link">管理收件地址 →</router-link>
    <button class="shop-button primary checkout-btn" :disabled="busy||needsReload||(!orderUnknown&&(!cart.ready||!addressId))" @click="checkout">{{ orderUnknown?'用同一操作重試下單':'確認下單，保留庫存' }}</button>
    <p class="fine">送出後保留庫存 30 分鐘，請在時限內完成付款；逾時自動取消並釋放庫存。付款僅提供模擬，不會實際收款。</p>
    <router-link to="/shop/orders">我的訂單 →</router-link>
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
.qty-form{display:flex;flex-direction:column;gap:6px;width:120px}.shop-shell .qty-form label{margin:0;font-size:12px;color:#4b5060}.shop-shell .qty-form input{text-align:center;padding:8px}.qty-form .shop-button{padding:8px;min-height:38px;font-size:13px}
.line-end{display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:96px}.line-total{font-size:17px;font-weight:900}
.remove-button{border:0;background:transparent;color:#4b5060;font:inherit;font-size:14px;text-decoration:underline;padding:8px 4px;cursor:pointer;min-height:40px}.remove-button:disabled{opacity:.5;cursor:not-allowed}
.issue-note{margin:0;font-size:14px}
.merge-note{margin:0 0 12px;display:flex;flex-direction:column;gap:8px}.merge-note p{margin:0}.merge-note ul{margin:6px 0 0;padding-left:20px}.merge-skipped{background:#fff7f1;border:1px solid #fed7bd;border-radius:12px;padding:12px 14px;font-size:14px;color:#7c2d12}.guest-register{text-align:center;font-size:14px}
.pre-hint{background:#fff7f1;border:1px solid #fed7bd;border-radius:12px;padding:14px 16px;font-size:14px;color:#7c2d12}.shop-shell .pre-hint a{color:#9a3412;font-weight:700}
.checkout-panel{flex:1 1 340px;min-width:0;background:#fff;border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:10px;position:sticky;top:140px}
.checkout-panel h2{font-size:20px;margin:0 0 4px}
.sum-row{display:flex;justify-content:space-between;gap:12px;font-size:14px;color:#4b5060}.sum-row.total{border-top:1px solid #e3e5ec;padding-top:12px;align-items:baseline;color:#15161a;font-weight:700}.sum-row.total strong{font-size:22px;font-weight:900;color:#c2410c;text-align:right}
.ship-to{font-size:13px;margin:0;background:#f3f4f8;border-radius:10px;padding:10px 12px}.addr-link{font-size:14px}
.checkout-btn{font-size:17px;padding:16px;margin-top:6px}.fine{font-size:12px;margin:0}
@media(max-width:768px){.cart-line{grid-template-columns:72px minmax(0,1fr);gap:12px}.thumb{width:72px}.qty-form{width:auto;flex-direction:row;align-items:center;grid-column:1/-1;flex-wrap:wrap}.shop-shell .qty-form input{width:90px}.line-end{grid-column:1/-1;flex-direction:row;justify-content:space-between;align-items:center}.checkout-panel{position:static}}
</style>
