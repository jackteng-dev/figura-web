<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import ProductCard from './ProductCard.vue'
import { useCatalog, inStock, minPrice } from './useCatalog'
const route = useRoute(), router = useRouter()
const { products, batchesByProduct, categories, brands, works, loading, error, truncated, load } = useCatalog()
const PAGE_SIZE = 20
const showFilters = ref(false)

const str = (k: string) => typeof route.query[k] === 'string' ? route.query[k] as string : ''
const q = computed(() => str('q').trim())
const type = computed(() => str('type'))            // '' | 'stock' | 'pre'
const category = computed(() => str('category'))
const brand = computed(() => str('brand'))
const work = computed(() => str('work'))
const sort = computed(() => str('sort') || 'new')
const minP = computed(() => Number(str('min')) || 0)
const maxP = computed(() => Number(str('max')) || 0)
const page = computed(() => Math.max(1, Number(str('page')) || 1))

function setQuery(patch: Record<string, string | undefined>) {
  const next: LocationQueryRaw = { ...route.query, ...patch }
  for (const k of Object.keys(next)) if (next[k] === '' || next[k] === undefined) delete next[k]
  if (!('page' in patch)) delete next.page
  router.push({ path: '/shop/products', query: next })
}
const toggle = (k: string, v: string) => setQuery({ [k]: str(k) === v ? undefined : v })

const filtered = computed(() => {
  const words = q.value.toLowerCase().split(/\s+/).filter(Boolean)
  let list = products.value.filter(p => {
    const pre = batchesByProduct.value.has(p.id), stock = inStock(p)
    if (type.value === 'stock' && !stock) return false
    if (type.value === 'pre' && !pre) return false
    if (category.value && p.category !== category.value) return false
    if (brand.value && p.brand !== brand.value) return false
    if (work.value && p.work !== work.value) return false
    const price = minPrice(p)
    if (minP.value && price < minP.value) return false
    if (maxP.value && price > maxP.value) return false
    if (words.length) {
      const hay = [p.title, p.brand, p.work, p.category, p.description, ...p.skus.map(s => s.label)].join(' ').toLowerCase()
      if (!words.every(w => hay.includes(w))) return false
    }
    return true
  })
  if (sort.value === 'price-asc') list = [...list].sort((a, b) => minPrice(a) - minPrice(b))
  if (sort.value === 'price-desc') list = [...list].sort((a, b) => minPrice(b) - minPrice(a))
  if (sort.value === 'stock') list = [...list].sort((a, b) => Number(inStock(b)) - Number(inStock(a)))
  return list
})
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const visible = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const heading = computed(() => q.value ? `「${q.value}」的搜尋結果` : category.value || work.value || brand.value || (type.value === 'stock' ? '現貨商品' : type.value === 'pre' ? '預購中商品' : '所有商品'))
const chips = computed(() => [
  q.value && { k: 'q', label: '關鍵字：' + q.value },
  type.value && { k: 'type', label: type.value === 'stock' ? '現貨' : '預購中' },
  category.value && { k: 'category', label: category.value },
  work.value && { k: 'work', label: work.value },
  brand.value && { k: 'brand', label: brand.value },
  (minP.value || maxP.value) && { k: 'price', label: `NT$ ${minP.value || 0}–${maxP.value || '∞'}` }
].filter(Boolean) as { k: string; label: string }[])
function clearChip(k: string) { k === 'price' ? setQuery({ min: undefined, max: undefined }) : setQuery({ [k]: undefined }) }
const counts = computed(() => ({
  stock: products.value.filter(inStock).length,
  pre: products.value.filter(p => batchesByProduct.value.has(p.id)).length
}))
const minInput = ref(str('min')), maxInput = ref(str('max'))
function applyPrice() { setQuery({ min: minInput.value || undefined, max: maxInput.value || undefined }) }
onMounted(() => load())
</script>

<template>
  <section class="list-page">
    <nav class="shop-crumbs" aria-label="麵包屑"><router-link to="/shop">首頁</router-link> ／ <span>{{ heading }}</span></nav>
    <div class="list-head">
      <h1>{{ heading }}</h1>
      <span class="total" role="status">共 {{ filtered.length }} 件商品</span>
      <button type="button" class="shop-button ghost filter-toggle" :aria-expanded="showFilters" aria-controls="list-filters" @click="showFilters = !showFilters">篩選條件</button>
    </div>

    <div class="layout">
      <aside id="list-filters" class="filters" :class="{ open: showFilters }" aria-label="篩選條件">
        <fieldset>
          <legend>購買方式</legend>
          <label class="check"><input type="radio" name="type" :checked="!type" @change="setQuery({ type: undefined })"> 全部 <span>{{ products.length }}</span></label>
          <label class="check"><input type="radio" name="type" :checked="type === 'stock'" @change="setQuery({ type: 'stock' })"> 現貨 <span>{{ counts.stock }}</span></label>
          <label class="check"><input type="radio" name="type" :checked="type === 'pre'" @change="setQuery({ type: 'pre' })"> 預購中 <span>{{ counts.pre }}</span></label>
        </fieldset>
        <fieldset v-if="categories.length">
          <legend>類型</legend>
          <div class="pills"><button v-for="c in categories" :key="c.name" type="button" :aria-pressed="category === c.name" :class="{ on: category === c.name }" @click="toggle('category', c.name)">{{ c.name }}</button></div>
        </fieldset>
        <fieldset v-if="works.length">
          <legend>作品</legend>
          <div class="pills"><button v-for="w in works" :key="w.name" type="button" :aria-pressed="work === w.name" :class="{ on: work === w.name }" @click="toggle('work', w.name)">{{ w.name }}</button></div>
        </fieldset>
        <fieldset v-if="brands.length">
          <legend>品牌</legend>
          <div class="pills"><button v-for="b in brands" :key="b.name" type="button" :aria-pressed="brand === b.name" :class="{ on: brand === b.name }" @click="toggle('brand', b.name)">{{ b.name }}</button></div>
        </fieldset>
        <fieldset>
          <legend>價格（NT$）</legend>
          <form class="price-range" @submit.prevent="applyPrice">
            <label for="price-min" class="visually-hidden">最低價</label>
            <input id="price-min" v-model="minInput" type="number" min="0" inputmode="numeric" placeholder="最低">
            <span aria-hidden="true">–</span>
            <label for="price-max" class="visually-hidden">最高價</label>
            <input id="price-max" v-model="maxInput" type="number" min="0" inputmode="numeric" placeholder="最高">
            <button class="shop-button" type="submit">套用</button>
          </form>
        </fieldset>
      </aside>

      <div class="results">
        <div class="toolbar">
          <template v-if="chips.length">
            <span class="muted">已選：</span>
            <button v-for="c in chips" :key="c.k" type="button" class="chip" :aria-label="'移除條件 ' + c.label" @click="clearChip(c.k)">{{ c.label }} ✕</button>
            <router-link to="/shop/products" class="clear">清除全部</router-link>
          </template>
          <span v-else class="muted">瀏覽全部商品</span>
          <label for="list-sort" class="sort-label">排序</label>
          <select id="list-sort" :value="sort" @change="setQuery({ sort: ($event.target as HTMLSelectElement).value === 'new' ? undefined : ($event.target as HTMLSelectElement).value })">
            <option value="new">最新上架</option>
            <option value="stock">有庫存優先</option>
            <option value="price-asc">價格低→高</option>
            <option value="price-desc">價格高→低</option>
          </select>
        </div>

        <p v-if="loading && !products.length" role="status">正在載入商品…</p>
        <div v-else-if="error" role="alert" class="shop-error">{{ error }} <button class="shop-button" @click="load(true)">重新載入</button></div>
        <div v-else-if="!products.length" class="shop-empty" role="status">目前沒有上架商品，歡迎稍後再來看看。</div>
        <div v-else-if="!filtered.length" class="shop-empty" role="status">沒有符合條件的商品。<router-link to="/shop/products">清除條件 →</router-link></div>
        <div v-else class="shop-grid"><ProductCard v-for="p in visible" :key="p.id" :product="p" /></div>
        <p v-if="truncated" class="muted note">商品數量較多，目前只顯示前 240 件。</p>

        <nav v-if="pageCount > 1" class="pager" aria-label="商品分頁">
          <button type="button" :disabled="page === 1" aria-label="上一頁" @click="setQuery({ page: String(page - 1) })">‹</button>
          <button v-for="n in pageCount" :key="n" type="button" :aria-current="n === page ? 'page' : undefined" :class="{ on: n === page }" @click="setQuery({ page: n === 1 ? undefined : String(n) })">{{ n }}</button>
          <button type="button" :disabled="page === pageCount" aria-label="下一頁" @click="setQuery({ page: String(page + 1) })">›</button>
        </nav>
      </div>
    </div>
  </section>
</template>

<style scoped>
.list-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 12px; margin-bottom: 16px; }
.list-head h1 { margin: 0; overflow-wrap: anywhere; }
.total { color: #4b5060; font-size: 14px; }
.filter-toggle { display: none; margin-left: auto; }
.layout { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
.filters { flex: 1 1 240px; max-width: 100%; background: #fff; border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
legend { font-weight: 900; font-size: 15px; margin-bottom: 8px; float: none; width: auto; }
.shop-shell .check { display: flex; gap: 10px; align-items: center; margin: 0; padding: 6px 0; font-size: 14px; cursor: pointer; }
.check span { margin-left: auto; color: #6b7080; }
.pills { display: flex; flex-wrap: wrap; gap: 6px; }
.pills button { border: 1px solid #d5d8e1; background: #fff; color: #15161a; border-radius: 8px; padding: 7px 10px; font: inherit; font-size: 13px; cursor: pointer; min-height: 36px; }
.pills button.on { background: #1b1f3b; border-color: #1b1f3b; color: #fff; }
.price-range { display: flex; gap: 6px; align-items: center; }
.shop-shell .price-range input { min-width: 0; padding: 8px; }
.price-range .shop-button { padding: 8px 12px; flex: none; }
.results { flex: 999 1 600px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.toolbar { background: #fff; border-radius: 14px; padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.muted { color: #4b5060; font-size: 14px; }
.chip { background: #fff1e8; color: #9a3412; border: 0; font: inherit; font-size: 13px; padding: 6px 10px; border-radius: 8px; cursor: pointer; }
.clear { font-size: 13px; }
.shop-shell .sort-label { margin: 0 0 0 auto; color: #4b5060; font-weight: 400; }
.shop-shell .toolbar select { width: auto; min-height: 40px; padding: 8px 12px; }
.note { margin: 0; }
.pager { display: flex; justify-content: center; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.pager button { min-width: 44px; height: 44px; border-radius: 10px; border: 0; background: #fff; color: #15161a; font: inherit; cursor: pointer; }
.pager button.on { background: #1b1f3b; color: #fff; font-weight: 700; }
.pager button:disabled { color: #b3b7c4; cursor: not-allowed; }
@media (max-width: 768px) {
  .filter-toggle { display: inline-flex; }
  .filters { display: none; flex-basis: 100%; }
  .filters.open { display: flex; }
}
</style>
