<script setup lang="ts">
import { ref, watch } from 'vue'
import ProductCover from './ProductCover.vue'
import { useRoute } from 'vue-router'
import { publicProduct, money, type PublicProduct } from '@/api/catalog'
import { getCart,setCartItem } from '@/api/shopping'
import { getCustomer,CustomerApiError } from '@/api/customer'
import { useRouter } from 'vue-router'
const router=useRouter(),quantity=ref(1),adding=ref(false),message=ref(''),addError=ref(''),uncertain=ref(false)
const route = useRoute(), product = ref<PublicProduct>(), selected = ref(''), error = ref(''), loading = ref(false)
let request = 0
async function load() {
  const generation = ++request; loading.value = true; error.value = ''; product.value = undefined
  try { const result = await publicProduct(String(route.params.id)); if (generation === request) { product.value = result; selected.value = result.skus.find(s => s.available)?.id || '' } }
  catch (e: any) { if (generation === request) error.value = e.message }
  finally { if (generation === request) loading.value = false }
}
async function add(){
  if(adding.value||uncertain.value||!selected.value)return;adding.value=true;message.value='';addError.value=''
  const skuId=selected.value,amount=quantity.value
  try{
    await getCustomer();const cart=await getCart();const old=cart.items.find(i=>i.skuId===skuId);const total=(old?.quantity||0)+amount
    if(!Number.isInteger(total)||total<1||total>99)throw new Error('同款式最多 99 件，請核對購物車數量。')
    await setCartItem(skuId,total,cart.version);message.value='已加入購物車。'
  }catch(e){if(e instanceof CustomerApiError&&e.status===401)await router.push('/shop/login');else if(e instanceof TypeError||(e instanceof CustomerApiError&&e.status>=500)){uncertain.value=true;addError.value='回應未確認，請先到購物車核對，再決定是否加入。'}else addError.value=e instanceof Error?e.message:'操作失敗，請核對購物車。'}finally{adding.value=false}
}
watch(() => route.params.id, load, { immediate: true })
</script>
<template>
  <router-link to="/shop/products">← 返回收藏商品</router-link>
  <p v-if="loading" role="status">正在載入商品…</p>
  <div v-else-if="error" class="shop-error detail-error" role="alert">{{ error }} <button class="shop-button" @click="load">重新載入</button></div>
  <article v-else-if="product" class="product-detail">
    <ProductCover :image="product.image" :category="product.category" />
    <section><p class="eyebrow">{{ product.brand }} / {{ product.category }}<span v-if="product.work"> · {{product.work}}</span></p><h1>{{ product.title }}</h1><p class="product-description">{{ product.description }}</p>
      <fieldset class="sku-options"><legend>選擇款式</legend><label v-for="sku in product.skus" :key="sku.id" class="sku-choice"><input v-model="selected" type="radio" name="sku" :value="sku.id" :disabled="!sku.available"><span>{{ sku.label }}<small class="sku-availability">{{ sku.available ? '有庫存' : '暫無庫存' }}</small></span><strong>{{ money(sku.priceTwd) }}</strong></label></fieldset>
      <form @submit.prevent="add"><label for="purchase-quantity">加入數量</label><input id="purchase-quantity" v-model.number="quantity" type="number" min="1" max="99" step="1" required :disabled="adding||uncertain||!selected"><button class="shop-button" style="margin-top:16px" :disabled="adding||uncertain||!selected">加入購物車</button></form>
      <p v-if="message" class="shop-success" role="status">{{ message }} <router-link to="/shop/cart">查看購物車 →</router-link></p><p v-if="addError" class="shop-error" role="alert">{{ addError }} <router-link to="/shop/cart">核對購物車 →</router-link></p>
      <p class="purchase-note">加入購物車不保留庫存，價格與可用狀態會重新核對。現貨下單已開放，付款與配送目前提供模擬演練。</p>
    </section>
  </article>
</template>
<style scoped>
.product-detail { margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:48px;overflow-wrap:anywhere; }.product-cover { min-height:360px;background:#e3e7d9;display:flex;flex-direction:column;gap:22px;justify-content:center;align-items:center;border-radius:12px; }.product-cover strong { font:48px Georgia;letter-spacing:6px;color:#64735c; }.product-description { white-space:pre-wrap; }.sku-options { border:0;padding:0;margin:28px 0; }.sku-options legend { font-size:16px; }.shop-shell .sku-choice { display:flex;gap:12px;align-items:center;padding:16px;border:1px solid #c9cec2;border-radius:6px;margin:12px 0; }.sku-choice strong { margin-left:auto;white-space:nowrap; }.sku-choice input { flex:0 0 auto; }.sku-choice span { min-width:0;overflow-wrap:anywhere; }.purchase-note { border-top:1px solid #d9d9cd;padding-top:24px;font-size:13px; }.detail-error { margin-top:24px; }@media(max-width:750px) { .product-detail { grid-template-columns:1fr;gap:28px; }.product-cover { min-height:240px; } }
.sku-availability { display:block;font-size:12px;margin-top:5px;color:#687468; }
</style>
