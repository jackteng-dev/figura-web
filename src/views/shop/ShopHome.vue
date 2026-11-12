<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ProductCard from './ProductCard.vue'
import ProductCover from './ProductCover.vue'
import { money } from '@/api/catalog'
import { useCatalog, inStock, daysLeft, shortDate } from './useCatalog'
const { products, openBatches, batchesByProduct, works, loading, error, load } = useCatalog()
const tab = ref<'all' | 'pre' | 'stock'>('all')

const productById = computed(() => new Map(products.value.map(p => [p.id, p])))
const hero = computed(() => {
  const b = [...openBatches.value].sort((x, y) => y.availableQuota - x.availableQuota)[0] || openBatches.value[0]
  if (b) return { kind: 'pre' as const, batch: b, product: productById.value.get(b.productId) }
  const p = products.value.find(inStock) || products.value[0]
  return p ? { kind: 'stock' as const, product: p, batch: undefined } : null
})
const closingFirst = computed(() => openBatches.value[0])
const stockCount = computed(() => products.value.filter(inStock).length)
const latest = computed(() => {
  const list = products.value.filter(p => tab.value === 'all' || (tab.value === 'pre' ? batchesByProduct.value.has(p.id) : inStock(p)))
  return list.slice(0, 10)
})
onMounted(() => load())
</script>

<template>
  <div class="home">
    <div v-if="error" class="shop-error" role="alert">{{ error }} <button class="shop-button" @click="load(true)">重新載入</button></div>

    <div class="hero-row">
      <router-link v-if="hero" class="hero" :to="hero.kind === 'pre' ? '/shop/preorders/' + hero.batch!.id : '/shop/products/' + hero.product!.id">
        <div class="hero-copy">
          <span class="pill">{{ hero.kind === 'pre' ? '預購受付中・' + shortDate(hero.batch!.deadlineAt) + ' 截單' : '現貨供應中' }}</span>
          <span class="hero-title">{{ hero.kind === 'pre' ? hero.batch!.productTitle : hero.product!.title }}</span>
          <span class="hero-sub">
            <template v-if="hero.kind === 'pre'">{{ hero.batch!.skuLabel }}・剩餘配額 {{ hero.batch!.availableQuota }} 件</template>
            <template v-else>{{ hero.product!.brand }}<template v-if="hero.product!.work">・{{ hero.product!.work }}</template></template>
          </span>
          <span class="hero-price">{{ hero.kind === 'pre' ? money(hero.batch!.priceTwd) : money(Math.min(...hero.product!.skus.map(s => s.priceTwd))) }}</span>
          <span class="hero-cta">{{ hero.kind === 'pre' ? '立即預購' : '查看商品' }}</span>
        </div>
        <div class="hero-art"><ProductCover :image="hero.product?.image" :category="hero.product?.category" /></div>
      </router-link>
      <div v-else class="hero hero-empty">
        <div class="hero-copy">
          <span class="pill">Figura 公仔收藏</span>
          <span class="hero-title">{{ loading ? '正在載入商品…' : '新商品準備中' }}</span>
          <span class="hero-sub">PVC 完成品、GK 雕像、可動模型與景品，上架後會第一時間出現在這裡。</span>
        </div>
      </div>

      <div class="side-cards">
        <router-link v-if="closingFirst" class="side-card yellow" :to="'/shop/preorders/' + closingFirst.id">
          <span class="side-label">截單倒數</span>
          <span class="side-title">{{ closingFirst.productTitle }}<br>剩 {{ daysLeft(closingFirst.deadlineAt) }} 天</span>
          <span>配額剩 {{ closingFirst.availableQuota }} 件 →</span>
        </router-link>
        <router-link v-else class="side-card yellow" to="/shop/preorders">
          <span class="side-label">預購情報</span>
          <span class="side-title">目前沒有開放中的預購</span>
          <span>查看所有批次 →</span>
        </router-link>
        <router-link class="side-card outline" :to="{ path: '/shop/products', query: { type: 'stock' } }">
          <span class="side-label blue">現貨商品</span>
          <span class="side-title">目前有庫存<br>{{ stockCount }} 款</span>
          <span class="blue">下單保留 30 分鐘 →</span>
        </router-link>
      </div>
    </div>

    <section class="shop-card block" aria-labelledby="home-latest">
      <div class="shop-section-head">
        <h2 id="home-latest">最新上架</h2>
        <div class="tabs" role="tablist" aria-label="商品類型">
          <button type="button" role="tab" :aria-selected="tab === 'all'" :class="{ on: tab === 'all' }" @click="tab = 'all'">全部</button>
          <button type="button" role="tab" :aria-selected="tab === 'pre'" :class="{ on: tab === 'pre' }" @click="tab = 'pre'">預購</button>
          <button type="button" role="tab" :aria-selected="tab === 'stock'" :class="{ on: tab === 'stock' }" @click="tab = 'stock'">現貨</button>
        </div>
      </div>
      <p v-if="loading && !products.length" role="status">正在載入商品…</p>
      <div v-else-if="latest.length" class="shop-grid"><ProductCard v-for="p in latest" :key="p.id" :product="p" /></div>
      <p v-else class="shop-empty">這個分類目前沒有商品。</p>
      <div class="more"><router-link class="shop-button ghost" :to="{ path: '/shop/products', query: tab === 'all' ? {} : { type: tab } }">看更多商品</router-link></div>
    </section>

    <div class="two-col">
      <section class="shop-card block closing" aria-labelledby="home-closing">
        <div class="shop-section-head"><h2 id="home-closing">預購截單倒數</h2><router-link to="/shop/preorders">全部批次 →</router-link></div>
        <div v-if="openBatches.length" class="closing-list">
          <router-link v-for="b in openBatches.slice(0, 5)" :key="b.id" :to="'/shop/preorders/' + b.id" class="closing-item">
            <div class="thumb"><ProductCover :image="productById.get(b.productId)?.image" /></div>
            <div class="closing-copy">
              <span class="closing-title">{{ b.productTitle }}<span class="sku">・{{ b.skuLabel }}</span></span>
              <span class="closing-meta">{{ shortDate(b.deadlineAt) }} 截單・配額剩 {{ b.availableQuota }} 件・{{ money(b.priceTwd) }}</span>
            </div>
            <span class="days">剩 {{ daysLeft(b.deadlineAt) }} 天</span>
          </router-link>
        </div>
        <p v-else class="shop-empty">目前沒有開放中的預購批次。</p>
      </section>
      <section class="shop-card block" aria-labelledby="home-works">
        <div class="shop-section-head"><h2 id="home-works">依作品逛</h2><router-link to="/shop/products">所有商品 →</router-link></div>
        <ul v-if="works.length" class="work-list">
          <li v-for="w in works.slice(0, 8)" :key="w.name"><router-link :to="{ path: '/shop/products', query: { work: w.name } }"><span>{{ w.name }}</span><span class="count">{{ w.count }}</span></router-link></li>
        </ul>
        <p v-else class="shop-empty">尚未有作品分類。</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home { display: flex; flex-direction: column; gap: 24px; }
.hero-row { display: flex; flex-wrap: wrap; gap: 16px; }
.hero { flex: 2 1 520px; min-height: 340px; background: #1b1f3b; border-radius: 16px; color: #fff !important; display: flex; flex-wrap: wrap; overflow: hidden; }
.hero-copy { flex: 1 1 280px; padding: 32px; display: flex; flex-direction: column; gap: 12px; justify-content: center; min-width: 0; }
.pill { align-self: flex-start; background: #ffd23f; color: #15161a; font-weight: 900; font-size: 13px; padding: 5px 12px; border-radius: 999px; }
.hero-title { font-size: clamp(24px, 3vw, 34px); font-weight: 900; line-height: 1.3; overflow-wrap: anywhere; }
.hero-sub { font-size: 15px; color: #c9cce0; }
.hero-price { font-size: 28px; font-weight: 900; color: #ffd23f; }
.hero-cta { align-self: flex-start; background: #fff; color: #1b1f3b; font-weight: 700; padding: 12px 22px; border-radius: 10px; margin-top: 4px; }
.hero-art { flex: 1 1 240px; min-height: 240px; background: #2a2f57; padding: 20px; display: flex; align-items: center; }
.hero-art :deep(.cover) { background: #353b6b; }
.hero-empty .hero-copy { max-width: 640px; }
.side-cards { flex: 1 1 240px; display: flex; flex-direction: column; gap: 16px; }
.side-card { flex: 1; min-height: 150px; border-radius: 16px; padding: 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; color: #15161a !important; font-size: 14px; }
.side-card.yellow { background: #ffd23f; }
.side-card.outline { background: #fff; border: 2px solid #1d4ed8; }
.side-label { font-size: 13px; font-weight: 700; }
.side-title { font-size: 21px; font-weight: 900; line-height: 1.35; overflow-wrap: anywhere; }
.blue { color: #1d4ed8; }
.block { padding: 24px; }
.tabs { display: flex; gap: 4px; background: #f3f4f8; padding: 4px; border-radius: 10px; }
.tabs button { border: 0; border-radius: 8px; padding: 9px 18px; font: inherit; font-size: 14px; background: transparent; color: #4b5060; cursor: pointer; min-height: 40px; }
.tabs button.on { background: #1b1f3b; color: #fff; font-weight: 700; }
.more { text-align: center; margin-top: 20px; }
.more .shop-button { padding: 12px 40px; }
.two-col { display: flex; flex-wrap: wrap; gap: 24px; }
.two-col > .closing { flex: 3 1 440px; min-width: 0; }
.two-col > :not(.closing) { flex: 2 1 300px; min-width: 0; }
.closing-list { display: flex; flex-direction: column; gap: 10px; }
.closing-item { display: flex; gap: 14px; align-items: center; color: #15161a !important; padding: 10px; border: 1px solid #e3e5ec; border-radius: 12px; }
.closing-item:hover { border-color: #c2410c; }
.thumb { width: 64px; flex: none; }
.thumb :deep(.cover) { border-radius: 8px; }
.thumb :deep(.cover-empty small), .thumb :deep(.mark) { display: none; }
.closing-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.closing-title { font-size: 14px; font-weight: 500; overflow-wrap: anywhere; }
.sku { color: #6b7080; font-weight: 400; }
.closing-meta { font-size: 12px; color: #4b5060; }
.days { flex: none; background: #fff1e8; color: #9a3412; font-weight: 900; font-size: 14px; padding: 8px 12px; border-radius: 10px; }
.work-list { list-style: none; margin: 0; padding: 0; }
.work-list a { display: flex; justify-content: space-between; padding: 11px 4px; border-bottom: 1px solid #f0f1f5; color: #15161a; font-size: 15px; }
.work-list a:hover { color: #1d4ed8; }
.count { color: #6b7080; }
@media (max-width: 768px) {
  .hero { min-height: 0; }
  .hero-copy { padding: 22px; }
  .hero-art { min-height: 0; padding: 0 22px 22px; background: transparent; }
  .hero-art :deep(.cover) { aspect-ratio: 16 / 9; }
  .side-cards { flex-direction: row; }
  .side-card { min-height: 130px; padding: 16px; }
  .side-title { font-size: 17px; }
  .block { padding: 16px; }
  .days { font-size: 12px; padding: 6px 8px; }
}
</style>
