<script setup lang="ts">
// 直接購買：只買這一款，不經過也不改動購物車。未登入時由路由守衛導向登入，登入後回到這一頁。
// 下單成功後直接前往該筆訂單的付款區。
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProductCover from './ProductCover.vue'
import { publicProduct, money, type PublicProduct } from '@/api/catalog'
import { getAddresses, type AddressView } from '@/api/shopping'
import { placeDirectOrder, type DirectOrder } from '@/api/orders'
import { CustomerApiError } from '@/api/customer'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const route = useRoute(), router = useRouter()
const productId = typeof route.query.product === 'string' && UUID.test(route.query.product) ? route.query.product : ''
const skuId = typeof route.query.sku === 'string' && UUID.test(route.query.sku) ? route.query.sku : ''
const rawQty = Number(route.query.qty)
const quantity = ref(Number.isInteger(rawQty) && rawQty >= 1 && rawQty <= 99 ? rawQty : 1)

const product = ref<PublicProduct>(), addresses = ref<AddressView[]>([]), addressId = ref('')
const busy = ref(false), error = ref(''), needsReload = ref(false), attempt = ref<DirectOrder>(), unknown = ref(false)
const sku = computed(() => product.value?.skus.find(s => s.id === skuId))
const subtotal = computed(() => sku.value ? sku.value.priceTwd * quantity.value : 0)
const selectedAddress = computed(() => addresses.value.find(a => a.id === addressId.value))
const validQty = computed(() => Number.isInteger(quantity.value) && quantity.value >= 1 && quantity.value <= 99)

async function load() {
  if (busy.value || unknown.value) return
  busy.value = true; error.value = ''
  try {
    if (!productId || !skuId) { error.value = '找不到要購買的商品，請回商品頁重新選擇。'; return }
    const [p, list] = await Promise.all([publicProduct(productId), getAddresses()])
    product.value = p; addresses.value = list
    if (!list.some(a => a.id === addressId.value)) addressId.value = list[0]?.id || ''
    if (!sku.value) error.value = '這個款式已不存在，請回商品頁重新選擇。'
    else if (!sku.value.available) error.value = '這個款式目前沒有庫存。'
    needsReload.value = false
  } catch (e) {
    if (e instanceof CustomerApiError && e.status === 401) { await router.replace('/shop/login'); return }
    error.value = e instanceof Error ? e.message : '無法載入商品'
  } finally { busy.value = false }
}

async function submit() {
  if (busy.value || needsReload.value) return
  if (!unknown.value) {
    const address = selectedAddress.value
    if (!product.value || !sku.value || !sku.value.available || !address) return
    if (!validQty.value) { error.value = '數量需為 1–99 的整數。'; return }
    attempt.value = { requestId: crypto.randomUUID(), productId, skuId, quantity: quantity.value, addressId: address.id, addressVersion: address.version, expectedSubtotalTwd: subtotal.value }
  }
  busy.value = true; error.value = ''
  try {
    const result = await placeDirectOrder(attempt.value!)
    unknown.value = false
    await router.replace({ path: '/shop/orders', query: { pay: result.order.id } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '下單失敗'
    unknown.value = !(e instanceof CustomerApiError && [400, 401, 404, 409].includes(e.status))
    if (e instanceof CustomerApiError && e.status === 401) { await router.replace('/shop/login'); return }
    if (unknown.value) error.value = '下單結果未確認，請按「用同一操作重試」，或到我的訂單核對；不要重新建立另一筆。'
    else { needsReload.value = true; attempt.value = undefined }
  } finally { busy.value = false }
}
onMounted(load)
</script>

<template>
 <section class="buy-now">
  <div class="head">
   <h1>直接購買</h1>
   <ol class="steps" aria-label="結帳步驟"><li aria-current="step">1 確認訂單</li><li>2 付款</li></ol>
  </div>
  <p v-if="error" role="alert" class="shop-error">{{ error }} <button v-if="needsReload" class="link" @click="load">重新核對</button></p>
  <div v-if="product && sku" class="layout">
   <article class="item" data-testid="buy-now-item">
    <router-link class="thumb" :to="'/shop/products/' + product.id" :aria-label="'查看商品 ' + product.title"><ProductCover :image="product.image" :category="product.category" /></router-link>
    <div class="info">
     <h2>{{ product.title }}</h2>
     <p>款式：{{ sku.label }}</p>
     <p>{{ money(sku.priceTwd) }} / 件</p>
    </div>
    <div class="qty">
     <label for="buy-qty">數量</label>
     <input id="buy-qty" v-model.number="quantity" type="number" min="1" max="99" step="1" :disabled="busy || unknown">
    </div>
    <strong class="line-total">{{ money(subtotal) }}</strong>
   </article>

   <aside class="panel" aria-labelledby="buy-summary">
    <h2 id="buy-summary">訂單金額</h2>
    <div class="row"><span>商品小計</span><span>{{ money(subtotal) }}</span></div>
    <div class="row"><span>運費</span><span>NT$ 0</span></div>
    <div class="row total"><span>應付金額</span><strong data-testid="buy-now-total">{{ money(subtotal) }}</strong></div>
    <label for="buy-address">收件地址</label>
    <select id="buy-address" v-model="addressId" :disabled="busy || unknown">
     <option value="" disabled>請選擇本人地址</option>
     <option v-for="a in addresses" :key="a.id" :value="a.id">{{ a.recipientName }} · {{ a.postalCode }} {{ a.city }}{{ a.district }}{{ a.street }} · {{ a.phone }}</option>
    </select>
    <p v-if="selectedAddress" class="ship-to">{{ selectedAddress.recipientName }} · {{ selectedAddress.phone }}<br>{{ selectedAddress.postalCode }} {{ selectedAddress.city }}{{ selectedAddress.district }}{{ selectedAddress.street }}</p>
    <p v-if="!addresses.length" class="shop-error">請先新增收件地址，再回到這一頁。</p>
    <router-link to="/shop/addresses" class="addr-link">管理收件地址 →</router-link>
    <button class="shop-button primary submit" data-testid="buy-now-submit" :disabled="busy || needsReload || (!unknown && (!sku.available || !addressId || !validQty))" @click="submit">{{ unknown ? '用同一操作重試' : '確認下單並前往付款' }}</button>
    <p class="fine">只購買這一款，不會改動購物車。送出後保留庫存 30 分鐘，請在時限內完成付款；逾時自動取消。</p>
   </aside>
  </div>
 </section>
</template>

<style scoped>
.head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.head h1{margin:0}
.steps{list-style:none;margin:0;padding:0;display:flex;gap:8px;flex-wrap:wrap;font-size:14px}.steps li{background:#fff;color:#4b5060;padding:7px 14px;border-radius:999px}.steps li[aria-current]{background:#1b1f3b;color:#fff;font-weight:700}
.layout{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
.item{flex:999 1 520px;min-width:0;background:#fff;border-radius:14px;padding:16px;display:grid;grid-template-columns:96px minmax(0,1fr) auto auto;gap:16px;align-items:center;overflow-wrap:anywhere}
.thumb{display:block;width:96px;aspect-ratio:1;border-radius:10px;overflow:hidden}
.info h2{font-size:17px;margin:0 0 6px}.info p{margin:2px 0;font-size:14px;color:#4b5060}
.qty{display:flex;flex-direction:column;gap:6px;font-size:13px}.qty input{width:90px;padding:10px;border:1px solid #d5d8e0;border-radius:8px;text-align:center;font-size:16px}
.line-total{font-size:18px;white-space:nowrap}
.panel{flex:1 1 300px;background:#fff;border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:10px}
.panel h2{margin:0 0 6px;font-size:20px}.row{display:flex;justify-content:space-between;font-size:14px;color:#4b5060}
.row.total{border-top:1px solid #e3e5ec;padding-top:12px;margin-top:4px;color:#15161a;align-items:baseline}.row.total strong{font-size:24px;color:#c2410c}
.panel label{font-size:14px;font-weight:700;margin-top:8px}.panel select{padding:10px;border:1px solid #d5d8e0;border-radius:8px;font:inherit}
.ship-to{font-size:13px;color:#4b5060;margin:0}.addr-link{font-size:13px}
.submit{margin-top:8px;padding:14px;font-size:16px}.fine{font-size:12px;color:#4b5060;margin:0}
.link{border:0;background:transparent;color:#1d4ed8;text-decoration:underline;cursor:pointer;font:inherit}
@media(max-width:600px){.item{grid-template-columns:72px minmax(0,1fr);}.thumb{width:72px}.qty,.line-total{grid-column:2}}
</style>
