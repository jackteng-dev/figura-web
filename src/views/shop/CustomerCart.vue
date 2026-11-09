<script setup lang="ts">
import { computed,onMounted,ref } from 'vue'
import { useRouter } from 'vue-router'
import { CustomerApiError } from '@/api/customer'
import { getCart,setCartItem,removeCartItem,issueText,type CartView } from '@/api/shopping'
import { getAddresses,type AddressView } from '@/api/shopping'
import { placeOrder,type PlaceOrder } from '@/api/orders'
import { money } from '@/api/catalog'
const router=useRouter(),cart=ref<CartView>(),quantities=ref<Record<string,number>>({}),busy=ref(false),error=ref(''),success=ref(''),needsReload=ref(false)
const addresses=ref<AddressView[]>([]),addressId=ref(''),orderAttempt=ref<PlaceOrder>(),orderUnknown=ref(false)
const selectedAddress=computed(()=>addresses.value.find(a=>a.id===addressId.value))
async function load(){if(orderUnknown.value)return;if(busy.value)return;busy.value=true;error.value='';try{const [loadedCart,loadedAddresses]=await Promise.all([getCart(),getAddresses()]);cart.value=loadedCart;addresses.value=loadedAddresses;if(!addresses.value.some(a=>a.id===addressId.value))addressId.value=addresses.value[0]?.id||'';quantities.value=Object.fromEntries(cart.value.items.map(i=>[i.skuId,i.quantity]));needsReload.value=false}catch(e){await failure(e)}finally{busy.value=false}}
async function failure(e:unknown){error.value=e instanceof Error?e.message:'操作失敗';if(e instanceof CustomerApiError&&e.status===401)await router.replace('/shop/login')}
async function change(skuId:string,remove=false){if(busy.value||!cart.value||needsReload.value||orderUnknown.value)return;busy.value=true;error.value='';success.value='';try{cart.value=remove?await removeCartItem(skuId,cart.value.version):await setCartItem(skuId,quantities.value[skuId],cart.value.version);quantities.value=Object.fromEntries(cart.value.items.map(i=>[i.skuId,i.quantity]));success.value=remove?'款式已移除。':'數量已更新。'}catch(e){needsReload.value=!(e instanceof CustomerApiError&&e.status===400);await failure(e);if(!(e instanceof CustomerApiError))error.value='回應未確認，請重新核對購物車後再操作。'}finally{busy.value=false}}
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
onMounted(load)
</script>
<template>
 <section class="cart-page"><h1>我的購物車</h1><p>價格與商品狀態由伺服器重新核對。購物車不保留庫存。確認下單後保留 30 分鐘；付款僅提供模擬，不會實際收款。</p>
 <p v-if="error" role="alert" class="shop-error">{{ error }}</p><p v-if="success" role="status" class="shop-success">{{ success }}</p>
 <button class="shop-button" :disabled="busy||orderUnknown" @click="load">重新核對購物車</button>
 <p v-if="busy&&!cart" role="status">正在載入…</p>
 <template v-if="cart"><p v-if="!cart.items.length" data-testid="cart-empty">購物車目前是空的。<router-link to="/shop/products">探索收藏商品 →</router-link></p>
 <article v-for="item in cart.items" :key="item.skuId" class="cart-line" :data-testid="'cart-'+item.skuId">
  <div><h2>{{ item.title }}</h2><p>{{ item.label }}</p><p>{{ item.unitPriceTwd===null?'下架款式暫不計價':money(item.unitPriceTwd)+'／件' }}</p><p v-if="item.issue" class="shop-error">{{ issueText(item.issue) }}</p></div>
  <form @submit.prevent="change(item.skuId)"><label :for="'qty-'+item.skuId">數量</label><input :id="'qty-'+item.skuId" v-model.number="quantities[item.skuId]" type="number" min="1" max="99" step="1" required :disabled="busy||needsReload||orderUnknown||item.issue==='UNAVAILABLE'"><button class="shop-button" :disabled="busy||needsReload||orderUnknown||item.issue==='UNAVAILABLE'">更新數量</button></form>
  <button class="shop-button remove-button" :disabled="busy||needsReload||orderUnknown" @click="change(item.skuId,true)">移除款式</button>
 </article><p v-if="cart.items.length" class="cart-total" data-testid="cart-subtotal">可用款式小計：{{ money(cart.subtotalTwd) }}</p><p v-if="cart.items.some(i=>i.issue)">有問題的款式未計入小計，請調整或移除。</p></template>
 <section v-if="cart?.items.length" class="checkout-panel"><h2>確認訂單</h2><p>配送費：NT$ 0（此階段展示設定）。尚未串接物流與金流，建立訂單不會收款。</p>
 <label for="checkout-address">收件地址</label><select id="checkout-address" v-model="addressId" :disabled="busy||orderUnknown"><option value="" disabled>請選擇本人地址</option><option v-for="a in addresses" :key="a.id" :value="a.id">{{ a.recipientName }} · {{ a.postalCode }} {{ a.city }}{{ a.district }}{{ a.street }} · {{ a.phone }}</option></select>
 <p v-if="selectedAddress" data-testid="checkout-shipping">{{ selectedAddress.recipientName }} · {{ selectedAddress.phone }}<br>{{ selectedAddress.postalCode }} {{ selectedAddress.city }}{{ selectedAddress.district }}{{ selectedAddress.street }}</p>
 <p v-if="!addresses.length">請先新增收件地址，再重新核對購物車。</p><p data-testid="order-total">確認總額：{{ money(cart.subtotalTwd) }}</p>
 <button class="shop-button" :disabled="busy||needsReload||(!orderUnknown&&(!cart.ready||!addressId))" @click="checkout">{{ orderUnknown?'用同一操作重試下單':'確認下單，保留庫存' }}</button>
 <p><router-link to="/shop/orders">我的訂單 →</router-link></p></section>
 <router-link to="/shop/addresses">管理收件地址 →</router-link></section>
</template>
<style scoped>
.checkout-panel{margin:32px 0;padding:24px;background:#fffdf8;border:1px solid #d9d9cd;border-radius:10px}.checkout-panel select{width:100%;padding:12px;min-width:0}.checkout-panel h2{font-size:22px}.cart-line{display:grid;grid-template-columns:minmax(0,1fr) 180px auto;gap:24px;align-items:center;padding:24px 0;border-bottom:1px solid #d9d9cd;overflow-wrap:anywhere}.cart-line h2{font-size:20px}.cart-line form .shop-button{margin-top:12px}.remove-button{background:#626a61}.cart-total{font-size:22px;margin-top:24px}@media(max-width:650px){.cart-line{grid-template-columns:minmax(0,1fr)}.cart-line form{max-width:180px}.remove-button{justify-self:start}}
</style>
