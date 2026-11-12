<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ProductCover from './ProductCover.vue'
import ProductCard from './ProductCard.vue'
import { useRoute } from 'vue-router'
import { publicProduct, money, type PublicProduct } from '@/api/catalog'
import { getCart,setCartItem } from '@/api/shopping'
import { getCustomer,CustomerApiError } from '@/api/customer'
import { taipeiTime } from '@/api/preorders'
import { useRouter } from 'vue-router'
import { useCatalog, daysLeft } from './useCatalog'
const router=useRouter(),quantity=ref(1),adding=ref(false),message=ref(''),addError=ref(''),uncertain=ref(false)
const route = useRoute(), product = ref<PublicProduct>(), selected = ref(''), error = ref(''), loading = ref(false)
const catalog = useCatalog()
let request = 0
async function load() {
  const generation = ++request; loading.value = true; error.value = ''; product.value = undefined
  try { const result = await publicProduct(String(route.params.id)); if (generation === request) { product.value = result; selected.value = result.skus.find(s => s.available)?.id || '' } }
  catch (e: any) { if (generation === request) error.value = e.message }
  finally { if (generation === request) loading.value = false }
  catalog.load()
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

const selectedSku = computed(() => product.value?.skus.find(s => s.id === selected.value))
const displayPrice = computed(() => {
  if (!product.value?.skus.length) return ''
  if (selectedSku.value) return money(selectedSku.value.priceTwd)
  const prices = product.value.skus.map(s => s.priceTwd)
  return money(Math.min(...prices)) + (new Set(prices).size > 1 ? ' 起' : '')
})
const batches = computed(() => product.value ? catalog.batchesByProduct.value.get(product.value.id) || [] : [])
const related = computed(() => {
  const p = product.value
  if (!p) return []
  const same = catalog.products.value.filter(x => x.id !== p.id && ((p.work && x.work === p.work) || x.brand === p.brand))
  return same.slice(0, 5)
})
const step = (d: number) => { const n = (Number(quantity.value) || 1) + d; quantity.value = Math.min(99, Math.max(1, n)) }
</script>

<template>
  <nav class="shop-crumbs" aria-label="麵包屑">
    <router-link to="/shop">首頁</router-link> ／ <router-link to="/shop/products">所有商品</router-link>
    <template v-if="product"> ／ <router-link :to="{ path: '/shop/products', query: { category: product.category } }">{{ product.category }}</router-link></template>
  </nav>
  <p v-if="loading" role="status">正在載入商品…</p>
  <div v-else-if="error" class="shop-error" role="alert">{{ error }} <button class="shop-button" @click="load">重新載入</button> <router-link to="/shop/products">← 返回商品列表</router-link></div>
  <template v-else-if="product">
    <article class="product-detail">
      <div class="gallery"><ProductCover :image="product.image" :category="product.category" /></div>

      <div class="buy">
        <section class="shop-card info">
          <div class="tags">
            <router-link :to="{ path: '/shop/products', query: { brand: product.brand } }">{{ product.brand }}</router-link>
            <router-link v-if="product.work" :to="{ path: '/shop/products', query: { work: product.work } }">{{ product.work }}</router-link>
            <router-link :to="{ path: '/shop/products', query: { category: product.category } }">{{ product.category }}</router-link>
          </div>
          <h1>{{ product.title }}</h1>
          <div class="price-row"><span class="price">{{ displayPrice }}</span><span class="muted">含稅・運費 NT$ 0</span></div>

          <fieldset v-if="product.skus.length" class="sku-options">
            <legend>選擇款式</legend>
            <label v-for="sku in product.skus" :key="sku.id" class="sku-choice" :class="{ on: selected === sku.id, off: !sku.available }">
              <input v-model="selected" type="radio" name="sku" :value="sku.id" :disabled="!sku.available">
              <span class="sku-name">{{ sku.label }}<small class="sku-availability" :class="sku.available ? 'ok' : 'none'">{{ sku.available ? '有庫存' : '暫無庫存' }}</small></span>
              <strong>{{ money(sku.priceTwd) }}</strong>
            </label>
          </fieldset>

          <div v-if="selectedSku" class="stock-note">現貨供應中・確認下單後保留庫存 30 分鐘，付款後安排出貨</div>
          <div v-else-if="product.skus.length" class="stock-note none">目前所有款式暫無現貨<template v-if="batches.length">，可參考下方預購批次</template></div>

          <form class="add-form" @submit.prevent="add">
            <div class="qty-row">
              <label for="purchase-quantity">加入數量</label>
              <div class="stepper">
                <button type="button" aria-label="減少數量" :disabled="adding||uncertain||!selected||quantity<=1" @click="step(-1)">−</button>
                <input id="purchase-quantity" v-model.number="quantity" type="number" min="1" max="99" step="1" required :disabled="adding||uncertain||!selected">
                <button type="button" aria-label="增加數量" :disabled="adding||uncertain||!selected||quantity>=99" @click="step(1)">+</button>
              </div>
            </div>
            <div class="actions">
              <button class="shop-button primary" :disabled="adding||uncertain||!selected">加入購物車</button>
              <router-link class="shop-button ghost" to="/shop/cart">前往購物車</router-link>
            </div>
          </form>
          <p v-if="message" class="shop-success" role="status">{{ message }} <router-link to="/shop/cart">查看購物車 →</router-link></p>
          <p v-if="addError" class="shop-error" role="alert">{{ addError }} <router-link to="/shop/cart">核對購物車 →</router-link></p>
          <p class="purchase-note">加入購物車不保留庫存，價格與可用狀態會在下單時重新核對。付款與配送目前為模擬演練。</p>
        </section>

        <section v-for="b in batches" :key="b.id" class="preorder-box" :aria-label="'預購批次 ' + b.name">
          <div class="pre-head"><span class="pre-title">預購批次：{{ b.name }}</span><span class="pre-days">剩 {{ daysLeft(b.deadlineAt) }} 天截單</span></div>
          <p class="pre-sku">款式：{{ b.skuLabel }}・<b>{{ money(b.priceTwd) }}</b></p>
          <dl class="pre-grid">
            <div><dt>截單（台北）</dt><dd>{{ taipeiTime(b.deadlineAt) }}</dd></div>
            <div><dt>預計到貨</dt><dd>{{ b.arrivalFrom }} ～ {{ b.arrivalTo }}</dd></div>
            <div><dt>剩餘配額</dt><dd>{{ b.availableQuota }} 件</dd></div>
          </dl>
          <p class="pre-note">預購不放入購物車，直接建立預購訂單；下單保留配額，請於時限內付款，到貨前可整筆退款。</p>
          <div class="actions">
            <router-link class="shop-button primary" :to="'/shop/preorders/' + b.id + '/checkout'">預購下單・保留配額</router-link>
            <router-link class="shop-button ghost" :to="'/shop/preorders/' + b.id">批次詳情</router-link>
          </div>
        </section>
      </div>
    </article>

    <section class="shop-card desc" aria-labelledby="desc-title">
      <h2 id="desc-title">商品介紹</h2>
      <div class="desc-body">
        <p class="product-description">{{ product.description || '尚無商品介紹。' }}</p>
        <table>
          <tbody>
            <tr><th scope="row">品牌</th><td>{{ product.brand }}</td></tr>
            <tr v-if="product.work"><th scope="row">作品</th><td>{{ product.work }}</td></tr>
            <tr><th scope="row">類型</th><td>{{ product.category }}</td></tr>
            <tr><th scope="row">款式</th><td>{{ product.skus.map(s => s.label).join('、') }}</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="related.length" class="related" aria-labelledby="related-title">
      <div class="shop-section-head"><h2 id="related-title">{{ product.work ? '同作品・同品牌商品' : '同品牌商品' }}</h2></div>
      <div class="shop-grid"><ProductCard v-for="p in related" :key="p.id" :product="p" compact /></div>
    </section>
  </template>
</template>

<style scoped>
.product-detail { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; overflow-wrap: anywhere; }
.gallery { flex: 1 1 480px; min-width: 0; background: #fff; border-radius: 16px; padding: 16px; position: sticky; top: 140px; }
.buy { flex: 1 1 420px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.info { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
.tags { display: flex; gap: 8px; flex-wrap: wrap; }
.shop-shell .tags a { background: #f3f4f8; color: #15161a; font-size: 13px; padding: 5px 10px; border-radius: 8px; }
.shop-shell .tags a:hover { background: #e3e5ec; }
.info h1 { margin: 0; }
.price-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.price { font-size: 32px; font-weight: 900; color: #c2410c; }
.muted { font-size: 13px; color: #4b5060; }
.sku-options { border: 0; padding: 0; margin: 4px 0 0; min-width: 0; }
.sku-options legend { font-size: 14px; font-weight: 700; margin-bottom: 8px; float: none; width: auto; }
.shop-shell .sku-choice { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border: 1px solid #d5d8e1; border-radius: 12px; margin: 0 0 8px; cursor: pointer; background: #fff; }
.shop-shell .sku-choice.on { border: 2px solid #1b1f3b; background: #fffbea; padding: 11px 13px; }
.shop-shell .sku-choice.off { background: #f3f4f8; border-style: dashed; cursor: not-allowed; }
.sku-choice input { flex: 0 0 auto; }
.sku-name { min-width: 0; font-weight: 700; }
.sku-choice strong { margin-left: auto; white-space: nowrap; }
.sku-availability { display: block; font-size: 12px; font-weight: 400; margin-top: 2px; }
.sku-availability.ok { color: #1e3a8a; } .sku-availability.none { color: #6b7080; }
.stock-note { background: #eef3ff; color: #1e3a8a; border-radius: 10px; padding: 10px 14px; font-size: 14px; }
.stock-note.none { background: #f3f4f8; color: #4b5060; }
.add-form { display: flex; flex-direction: column; gap: 12px; }
.qty-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.shop-shell .qty-row label { margin: 0; font-weight: 700; }
.stepper { display: flex; border: 1px solid #d5d8e1; border-radius: 10px; overflow: hidden; }
.stepper button { width: 44px; border: 0; background: #f3f4f8; font: inherit; font-size: 18px; cursor: pointer; }
.stepper button:disabled { color: #b3b7c4; cursor: not-allowed; }
.shop-shell .stepper input { width: 64px; border: 0; border-radius: 0; text-align: center; font-weight: 700; -moz-appearance: textfield; }
.stepper input::-webkit-outer-spin-button, .stepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.actions > * { flex: 1 1 180px; font-size: 16px; padding: 14px; }
.purchase-note { font-size: 13px; margin: 0; border-top: 1px solid #e3e5ec; padding-top: 12px; }
.preorder-box { background: #fff7f1; border: 1px solid #fed7bd; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
.pre-head { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.pre-title { font-weight: 900; color: #9a3412; }
.pre-days { color: #9a3412; font-weight: 700; font-size: 14px; }
.shop-shell .pre-sku { margin: 0; color: #15161a; }
.pre-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; font-size: 13px; }
.pre-grid dt { color: #4b5060; font-weight: 400; }
.pre-grid dd { margin: 2px 0 0; font-weight: 700; }
.shop-shell .pre-note { font-size: 13px; margin: 0; }
.desc { margin-top: 24px; padding: 24px; }
.desc h2 { font-size: 20px; margin: 0 0 16px; }
.desc-body { display: flex; flex-wrap: wrap; gap: 32px; }
.product-description { flex: 2 1 420px; white-space: pre-wrap; margin: 0; color: #2b2e38; }
.desc table { flex: 1 1 260px; border-collapse: collapse; font-size: 14px; align-self: flex-start; }
.desc th { text-align: left; font-weight: 500; color: #4b5060; padding: 10px 16px 10px 0; width: 64px; }
.desc tr { border-bottom: 1px solid #eceef4; }
.related { margin-top: 24px; }
@media (max-width: 768px) {
  .gallery { position: static; padding: 10px; }
  .info { padding: 18px; }
  .price { font-size: 26px; }
  .pre-grid { grid-template-columns: 1fr 1fr; }
}
</style>
