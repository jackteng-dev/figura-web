<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { publicBatches, publicBatch, taipeiTime, type PublicBatch } from '@/api/preorders'
import { publicProduct, money, type PublicProduct } from '@/api/catalog'
import ProductCover from './ProductCover.vue'
import { daysLeft } from './useCatalog'
const route = useRoute(), rows = ref<PublicBatch[]>([]), page = ref(1), total = ref(0), loading = ref(false), error = ref('')
const product = ref<PublicProduct>()
const detail = computed(() => typeof route.params.id === 'string')
const batch = computed(() => detail.value ? rows.value[0] : undefined)
const status = { OPEN: '批次已開放', CLOSED: '已截單', EXPIRED: '已到截止時間' }
let request = 0
async function load() {
  const generation = ++request
  loading.value = true; error.value = ''; rows.value = []
  try {
    if (detail.value) {
      const b = await publicBatch(String(route.params.id))
      if (generation !== request) return
      rows.value = [b]
      // 商品圖與名稱只是輔助資訊，讀不到也不影響批次內容與下單。
      if (product.value?.id !== b.productId) {
        product.value = undefined
        publicProduct(b.productId).then(p => { if (generation === request) product.value = p }).catch(() => {})
      }
    } else {
      const result = await publicBatches(page.value)
      if (generation !== request) return
      rows.value = result.items; total.value = result.total
    }
  } catch (e: any) { if (generation === request) error.value = e.message || '預購資料暫時無法載入。' }
  finally { if (generation === request) loading.value = false }
}
watch(() => route.params.id, () => { page.value = 1; load() })
onMounted(load)
</script>

<template>
  <!-- 單一批次：左商品圖、右批次條件與下單 -->
  <section v-if="detail" class="batch-page">
    <nav class="shop-crumbs" aria-label="麵包屑">
      <router-link to="/shop">首頁</router-link> ／ <router-link to="/shop/preorders">預購情報</router-link>
      <template v-if="batch"> ／ <router-link :to="'/shop/products/' + batch.productId">{{ batch.productTitle }}</router-link></template>
    </nav>
    <p v-if="loading" role="status">載入中…</p>
    <div v-if="error" class="shop-error" role="alert">{{ error }} <button type="button" class="shop-button" :disabled="loading" @click="load">重新載入</button></div>

    <article v-if="batch" class="batch-layout">
      <router-link :to="'/shop/products/' + batch.productId" class="gallery" :aria-label="'查看商品：' + batch.productTitle">
        <ProductCover :image="product?.image" :category="product?.category" eager />
      </router-link>

      <div class="preorder-cards">
        <div class="card">
          <div class="head">
            <span class="badge" :class="batch.status">{{ status[batch.status] }}</span>
            <span v-if="batch.status === 'OPEN'" class="days">剩 {{ daysLeft(batch.deadlineAt) }} 天截單</span>
            <button type="button" class="reload" :disabled="loading" @click="load"><span aria-hidden="true">↻ </span>重新載入</button>
          </div>
          <h1>{{ batch.name }}</h1>
          <p class="sub">
            <router-link :to="'/shop/products/' + batch.productId">{{ batch.productTitle }}</router-link>・{{ batch.skuLabel }}
            <template v-if="product"><br><span class="meta">{{ product.brand }}<template v-if="product.work">・{{ product.work }}</template>・{{ product.category }}</span></template>
          </p>
          <p class="price">{{ money(batch.priceTwd) }}</p>

          <dl class="facts">
            <div><dt>截止時間（台北）</dt><dd>{{ taipeiTime(batch.deadlineAt) }}</dd></div>
            <div><dt>預計到貨</dt><dd>{{ batch.arrivalFrom }} ～ {{ batch.arrivalTo }}</dd></div>
            <div><dt>批次剩餘配額</dt><dd>{{ batch.availableQuota }} 件</dd></div>
          </dl>

          <div class="actions">
            <router-link v-if="batch.orderingEnabled" class="shop-button primary" :to="'/shop/preorders/' + batch.id + '/checkout'">預購下單</router-link>
            <p v-else class="closed">此批次目前無法下單</p>
            <router-link class="shop-button ghost" :to="'/shop/products/' + batch.productId">查看商品 →</router-link>
          </div>

          <ul class="notes">
            <li>預購不放入購物車，直接建立預購訂單；下單後保留配額，請於時限內付款，未付款配額會在保留期限到時釋放。</li>
            <li>到貨區間為預估，可能調整；到貨前可整筆退款。付款僅提供模擬，不會實際收款。</li>
          </ul>

          <section v-if="batch.description" class="desc" aria-label="批次說明">
            <h2>批次說明</h2>
            <p>{{ batch.description }}</p>
          </section>
        </div>
      </div>
    </article>
  </section>

  <!-- 批次列表（預購情報） -->
  <section v-else class="preorders"><h1>預購情報</h1>
    <p>查看批次價格、截止時間與預計到貨區間。到貨區間為預估，可能調整；預購付款僅提供模擬，未付款配額會在保留期限到時釋放。</p>
    <p v-if="loading" role="status">載入中…</p><p v-if="error" role="alert" class="shop-error">{{ error }}</p><button :disabled="loading" class="shop-button" @click="load">重新載入</button>
    <div class="preorder-cards list"><article v-for="b in rows" :key="b.id"><span class="badge">{{ status[b.status] }}</span><h2>{{ b.name }}</h2><p>{{ b.productTitle }} · {{ b.skuLabel }}</p><p class="price">NT$ {{ b.priceTwd.toLocaleString() }}</p><p>{{ b.description }}</p><dl><dt>截止時間（台北）</dt><dd>{{ taipeiTime(b.deadlineAt) }}</dd><dt>預計到貨</dt><dd>{{ b.arrivalFrom }} ～ {{ b.arrivalTo }}</dd><dt>批次剩餘配額</dt><dd>{{ b.availableQuota }} 件</dd></dl><router-link v-if="b.orderingEnabled" class="shop-button" :to="'/shop/preorders/' + b.id + '/checkout'">預購下單</router-link><p v-else>此批次目前無法下單</p><router-link :to="'/shop/preorders/' + b.id">查看批次詳情 →</router-link></article></div>
    <p v-if="!loading && !error && !rows.length">目前沒有公開的預購批次。</p>
    <div class="pagination"><button class="shop-button" :disabled="loading || page === 1" @click="page--; load()">上一頁</button><span>第 {{ page }} 頁</span><button class="shop-button" :disabled="loading || page * 12 >= total" @click="page++; load()">下一頁</button></div>
  </section>
</template>

<style scoped>
/* 批次詳情 */
.batch-page { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.batch-layout { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 24px; align-items: start; }
.gallery { background: #fff; border-radius: 16px; padding: 20px; display: block; position: sticky; top: 130px; }
.gallery:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 3px; }
.card { background: #fff; border-radius: 16px; padding: 28px; display: flex; flex-direction: column; gap: 14px; overflow-wrap: anywhere; }
.head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.badge { background: #fff1e8; color: #9a3412; font-weight: 700; padding: 5px 10px; border-radius: 6px; font-size: 13px; }
.badge.CLOSED, .badge.EXPIRED { background: #eceef4; color: #4b5060; }
.days { background: #c2410c; color: #fff; font-weight: 900; font-size: 13px; padding: 5px 10px; border-radius: 6px; }
.reload { margin-left: auto; border: 0; background: transparent; color: #4b5060; font: inherit; font-size: 13px; cursor: pointer; padding: 6px 8px; border-radius: 8px; min-height: 32px; }
.reload:hover { background: #f3f4f8; color: #15161a; }
.reload:focus-visible { outline: 3px solid #1d4ed8; }
.card h1 { margin: 0; font-size: clamp(22px, 2.4vw, 28px); font-weight: 900; line-height: 1.35; }
.sub { margin: 0; font-size: 15px; color: #4b5060; line-height: 1.7; }
.sub a { color: #1d4ed8; }
.meta { font-size: 13px; color: #6b7080; }
.price { margin: 0; font-size: 30px; font-weight: 900; color: #c2410c; }
.facts { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.facts > div { background: #f6f7fb; border-radius: 12px; padding: 12px 14px; min-width: 0; }
.facts dt { font-size: 12px; color: #4b5060; }
.facts dd { margin: 4px 0 0; font-size: 15px; font-weight: 700; color: #15161a; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.actions .shop-button { padding: 14px 28px; font-size: 16px; }
.closed { margin: 0; font-weight: 700; color: #4b5060; }
.notes { margin: 0; padding: 14px 14px 14px 32px; background: #fff7f1; border-radius: 12px; font-size: 13px; line-height: 1.8; color: #4b5060; }
.desc { border-top: 1px solid #eceef4; padding-top: 14px; }
.desc h2 { font-size: 15px; margin: 0 0 6px; }
.desc p { margin: 0; font-size: 14px; color: #4b5060; line-height: 1.8; white-space: pre-line; }
@media (max-width: 991.98px) {
  .batch-layout { grid-template-columns: minmax(0, 1fr); }
  .gallery { position: static; max-width: 520px; width: 100%; margin: 0 auto; box-sizing: border-box; }
}
@media (max-width: 575.98px) {
  .card { padding: 20px; }
  .facts { grid-template-columns: minmax(0, 1fr); }
  .actions .shop-button { flex: 1 1 auto; text-align: center; }
}

/* 批次列表 */
.preorders{min-width:0}.preorder-cards.list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin:28px 0}.preorder-cards.list article{padding:24px;background:#ffffff;border:1px solid #e3e5ec;border-radius:12px;overflow-wrap:anywhere}.preorder-cards.list h2{font-size:22px;margin:18px 0 10px}.preorders .badge{background:#fff1e8;color:#9a3412;font-weight:700;padding:6px 10px;border-radius:5px;font-size:13px}.preorders .price{font-size:24px;color:#c2410c;font-weight:900}.preorders dt{font-size:13px;color:#4b5060;margin-top:14px}.preorders dd{margin:5px 0;font-size:15px}.pagination{display:flex;align-items:center;gap:20px}@media(max-width:650px){.preorder-cards.list{grid-template-columns:1fr}.preorder-cards.list article{padding:20px}.pagination{gap:12px}}
</style>
