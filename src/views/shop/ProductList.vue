<script setup lang="ts">
// 商品列表：搜尋、篩選、排序與分頁都由後端處理（GET /catalog/products、/catalog/facets），
// 網址參數是唯一狀態來源，可分享、可上一頁。舊網址參數（type、category／brand／work 名稱、min、max、sort）照常可用。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import ProductCard from './ProductCard.vue'
import { searchProducts, productFacets, scaleLabel, MATERIAL_LABELS, TYPE_LABELS, EDITION_LABELS, AVAILABILITY_LABELS, type Facets, type PublicProduct, type ProductSearch, type Availability } from '@/api/catalog'
const route = useRoute(), router = useRouter()
const PAGE_SIZE = 24
const showFilters = ref(false)
const products = ref<PublicProduct[]>([]), total = ref(0), facets = ref<Facets>(), loading = ref(false), error = ref('')

const str = (k: string) => typeof route.query[k] === 'string' ? route.query[k] as string : ''
const list = (k: string) => str(k).split(',').map(x => x.trim()).filter(Boolean)
const q = computed(() => str('q').trim())
const type = computed(() => str('type'))            // '' | 'stock' | 'pre' | 'out'
const category = computed(() => str('category'))
const brand = computed(() => str('brand'))
const work = computed(() => str('work'))
const sort = computed(() => str('sort') || (q.value ? 'relevance' : 'new'))
const minP = computed(() => Number(str('min')) || 0)
const maxP = computed(() => Number(str('max')) || 0)
const page = computed(() => Math.max(1, Number(str('page')) || 1))
const SORTS: Record<string, string> = { new: 'NEWEST', 'price-asc': 'PRICE_ASC', 'price-desc': 'PRICE_DESC', 'release-asc': 'RELEASE_ASC', 'release-desc': 'RELEASE_DESC', relevance: 'RELEVANCE', stock: 'NEWEST' }
const TYPES: Record<string, Availability> = { stock: 'IN_STOCK', pre: 'PREORDER', out: 'SOLD_OUT' }

function setQuery(patch: Record<string, string | undefined>) {
  const next: LocationQueryRaw = { ...route.query, ...patch }
  for (const k of Object.keys(next)) if (next[k] === '' || next[k] === undefined) delete next[k]
  if (!('page' in patch)) delete next.page
  router.push({ path: '/shop/products', query: next })
}
const toggle = (k: string, v: string) => setQuery({ [k]: str(k) === v ? undefined : v })
/** 多選代碼（比例、材質、類型、版本）以逗號存在網址。 */
function toggleMulti(k: string, v: string) { const cur = list(k); setQuery({ [k]: (cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]).join(',') || undefined }) }

/** 名稱型網址參數（舊連結）用 facets 的名稱對應到主檔 ID；對不到時顯示空結果而不是忽略條件。 */
const idOf = (values: { value: string; label: string }[] | undefined, name: string) => name ? values?.find(x => x.label === name)?.value || 'unknown' : undefined
const criteria = computed<ProductSearch>(() => ({
  q: q.value || undefined,
  availability: TYPES[type.value] ? [TYPES[type.value]] : undefined,
  priceMin: minP.value || undefined, priceMax: maxP.value || undefined,
  scale: list('scale'), material: list('material'), productType: list('ptype'), edition: list('edition'),
  limited: str('limited') === '1' || undefined,
  sort: SORTS[sort.value] || 'NEWEST'
}))
// 全站選項（不受目前條件影響）用來把名稱對應成 ID；條件內選項與筆數另外查
const allFacets = ref<Facets>()
let controller: AbortController | undefined
async function run() {
  controller?.abort(); controller = new AbortController(); const signal = controller.signal
  loading.value = true; error.value = ''
  try {
    if (!allFacets.value && (category.value || brand.value || work.value)) allFacets.value = await productFacets({}, signal)
    const ids = { categoryId: [idOf(allFacets.value?.categories, category.value)].filter(Boolean) as string[], brandId: [idOf(allFacets.value?.brands, brand.value)].filter(Boolean) as string[], workId: [idOf(allFacets.value?.works, work.value)].filter(Boolean) as string[] }
    if ([...ids.categoryId, ...ids.brandId, ...ids.workId].includes('unknown')) { products.value = []; total.value = 0; facets.value = await productFacets({ ...criteria.value }, signal); return }
    const s = { ...criteria.value, ...ids, page: page.value, pageSize: PAGE_SIZE }
    const [result, f] = await Promise.all([searchProducts(s, signal), productFacets(s, signal)])
    products.value = result.items; total.value = result.total; facets.value = f
    if (!allFacets.value && !q.value && !Object.values(ids).some(x => x.length)) allFacets.value = f
  } catch (e: any) {
    if (e?.name !== 'AbortError') error.value = e?.message || '商品暫時無法載入，請稍後重試。'
  } finally { if (!signal.aborted) loading.value = false }
}
watch(() => route.fullPath, () => { if (route.path === '/shop/products') run() }, { immediate: true })
onBeforeUnmount(() => controller?.abort())

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pages = computed(() => { const n = pageCount.value, c = page.value; const set = new Set([1, n, c - 1, c, c + 1].filter(x => x >= 1 && x <= n)); return [...set].sort((a, b) => a - b) })
const heading = computed(() => q.value ? `「${q.value}」的搜尋結果` : category.value || work.value || brand.value || (type.value === 'stock' ? '現貨商品' : type.value === 'pre' ? '預購中商品' : type.value === 'out' ? '已售完商品' : '所有商品'))
const chips = computed(() => [
  q.value && { k: 'q', label: '關鍵字：' + q.value },
  type.value && { k: 'type', label: AVAILABILITY_LABELS[TYPES[type.value]] || type.value },
  category.value && { k: 'category', label: category.value },
  work.value && { k: 'work', label: work.value },
  brand.value && { k: 'brand', label: brand.value },
  list('scale').length && { k: 'scale', label: '比例：' + list('scale').map(scaleLabel).join('、') },
  list('material').length && { k: 'material', label: '材質：' + list('material').map(x => MATERIAL_LABELS[x] || x).join('、') },
  list('ptype').length && { k: 'ptype', label: '類型：' + list('ptype').map(x => TYPE_LABELS[x] || x).join('、') },
  list('edition').length && { k: 'edition', label: '版本：' + list('edition').map(x => EDITION_LABELS[x] || x).join('、') },
  str('limited') === '1' && { k: 'limited', label: '只看限定' },
  (minP.value || maxP.value) && { k: 'price', label: `NT$ ${minP.value || 0}–${maxP.value || '∞'}` }
].filter(Boolean) as { k: string; label: string }[])
function clearChip(k: string) { k === 'price' ? setQuery({ min: undefined, max: undefined }) : setQuery({ [k]: undefined }) }
const countOf = (values: { value: string; count: number }[] | undefined, v: string) => values?.find(x => x.value === v)?.count ?? 0
const minInput = ref(str('min')), maxInput = ref(str('max'))
watch(() => [str('min'), str('max')], ([a, b]) => { minInput.value = a; maxInput.value = b })
function applyPrice() { setQuery({ min: minInput.value || undefined, max: maxInput.value || undefined }) }
const searchInput = ref(q.value)
watch(q, v => { searchInput.value = v })
function submitSearch() { setQuery({ q: searchInput.value.trim() || undefined, sort: undefined }) }
</script>

<template>
  <section class="list-page">
    <nav class="shop-crumbs" aria-label="麵包屑"><router-link to="/shop">首頁</router-link> ／ <span>{{ heading }}</span></nav>
    <div class="list-head">
      <h1>{{ heading }}</h1>
      <span class="total" role="status">共 {{ total }} 件商品</span>
      <button type="button" class="shop-button ghost filter-toggle" :aria-expanded="showFilters" aria-controls="list-filters" @click="showFilters = !showFilters">篩選條件</button>
    </div>

    <div class="layout">
      <aside id="list-filters" class="filters" :class="{ open: showFilters }" aria-label="篩選條件">
        <form class="search-box" role="search" @submit.prevent="submitSearch">
          <label for="list-q" class="visually-hidden">搜尋商品</label>
          <input id="list-q" v-model="searchInput" type="search" maxlength="80" placeholder="名稱、作品、角色、品牌">
          <button class="shop-button" type="submit">搜尋</button>
        </form>
        <fieldset>
          <legend>購買方式</legend>
          <label class="check"><input type="radio" name="type" :checked="!type" @change="setQuery({ type: undefined })"> 全部</label>
          <label class="check"><input type="radio" name="type" :checked="type === 'stock'" @change="setQuery({ type: 'stock' })"> 現貨 <span>{{ countOf(facets?.availability, 'IN_STOCK') }}</span></label>
          <label class="check"><input type="radio" name="type" :checked="type === 'pre'" @change="setQuery({ type: 'pre' })"> 預購中 <span>{{ countOf(facets?.availability, 'PREORDER') }}</span></label>
          <label class="check"><input type="radio" name="type" :checked="type === 'out'" @change="setQuery({ type: 'out' })"> 已售完 <span>{{ countOf(facets?.availability, 'SOLD_OUT') }}</span></label>
        </fieldset>
        <fieldset v-if="facets?.categories.length">
          <legend>分類</legend>
          <div class="pills"><button v-for="c in facets.categories" :key="c.value" type="button" :aria-pressed="category === c.label" :class="{ on: category === c.label }" @click="toggle('category', c.label)">{{ c.label }} <small>{{ c.count }}</small></button></div>
        </fieldset>
        <fieldset v-if="facets?.works.length">
          <legend>作品／系列</legend>
          <div class="pills"><button v-for="w in facets.works" :key="w.value" type="button" :aria-pressed="work === w.label" :class="{ on: work === w.label }" @click="toggle('work', w.label)">{{ w.label }} <small>{{ w.count }}</small></button></div>
        </fieldset>
        <fieldset v-if="facets?.brands.length">
          <legend>品牌</legend>
          <div class="pills"><button v-for="b in facets.brands" :key="b.value" type="button" :aria-pressed="brand === b.label" :class="{ on: brand === b.label }" @click="toggle('brand', b.label)">{{ b.label }} <small>{{ b.count }}</small></button></div>
        </fieldset>
        <fieldset v-if="facets?.scales.length">
          <legend>比例</legend>
          <div class="pills"><button v-for="x in facets.scales" :key="x.value" type="button" :aria-pressed="list('scale').includes(x.value)" :class="{ on: list('scale').includes(x.value) }" @click="toggleMulti('scale', x.value)">{{ scaleLabel(x.value) }} <small>{{ x.count }}</small></button></div>
        </fieldset>
        <fieldset v-if="facets?.materials.length">
          <legend>材質</legend>
          <div class="pills"><button v-for="x in facets.materials" :key="x.value" type="button" :aria-pressed="list('material').includes(x.value)" :class="{ on: list('material').includes(x.value) }" @click="toggleMulti('material', x.value)">{{ MATERIAL_LABELS[x.value] || x.value }} <small>{{ x.count }}</small></button></div>
        </fieldset>
        <fieldset v-if="facets?.productTypes.length">
          <legend>商品類型</legend>
          <div class="pills"><button v-for="x in facets.productTypes" :key="x.value" type="button" :aria-pressed="list('ptype').includes(x.value)" :class="{ on: list('ptype').includes(x.value) }" @click="toggleMulti('ptype', x.value)">{{ TYPE_LABELS[x.value] || x.value }} <small>{{ x.count }}</small></button></div>
        </fieldset>
        <fieldset v-if="facets?.editions.length">
          <legend>版本</legend>
          <div class="pills"><button v-for="x in facets.editions" :key="x.value" type="button" :aria-pressed="list('edition').includes(x.value)" :class="{ on: list('edition').includes(x.value) }" @click="toggleMulti('edition', x.value)">{{ EDITION_LABELS[x.value] || x.value }} <small>{{ x.count }}</small></button></div>
          <label class="check"><input type="checkbox" :checked="str('limited') === '1'" @change="setQuery({ limited: str('limited') === '1' ? undefined : '1' })"> 只看限定商品</label>
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
          <select id="list-sort" :value="sort === 'stock' ? 'new' : sort" @change="setQuery({ sort: ($event.target as HTMLSelectElement).value === (q ? 'relevance' : 'new') ? undefined : ($event.target as HTMLSelectElement).value })">
            <option v-if="q" value="relevance">相關度</option>
            <option value="new">最新上架</option>
            <option value="price-asc">價格低→高</option>
            <option value="price-desc">價格高→低</option>
            <option value="release-asc">發售日：近→遠</option>
            <option value="release-desc">發售日：遠→近</option>
          </select>
        </div>

        <p v-if="loading && !products.length" role="status">正在載入商品…</p>
        <div v-else-if="error" role="alert" class="shop-error">{{ error }} <button class="shop-button" @click="run">重新載入</button></div>
        <div v-else-if="!products.length && !chips.length" class="shop-empty" role="status">目前沒有上架商品，歡迎稍後再來看看。</div>
        <div v-else-if="!products.length" class="shop-empty" role="status">沒有符合條件的商品。<router-link to="/shop/products">清除條件 →</router-link></div>
        <div v-else class="shop-grid" :aria-busy="loading"><ProductCard v-for="p in products" :key="p.id" :product="p" /></div>

        <nav v-if="pageCount > 1" class="pager" aria-label="商品分頁">
          <router-link v-if="page > 1" :to="{ query: { ...route.query, page: page - 1 === 1 ? undefined : String(page - 1) } }" aria-label="上一頁" rel="prev">‹</router-link>
          <template v-for="(n, i) in pages" :key="n">
            <span v-if="i > 0 && n - pages[i - 1] > 1" class="gap" aria-hidden="true">…</span>
            <router-link :to="{ query: { ...route.query, page: n === 1 ? undefined : String(n) } }" :aria-current="n === page ? 'page' : undefined" :class="{ on: n === page }">{{ n }}</router-link>
          </template>
          <router-link v-if="page < pageCount" :to="{ query: { ...route.query, page: String(page + 1) } }" aria-label="下一頁" rel="next">›</router-link>
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
.pager a { min-width: 44px; height: 44px; border-radius: 10px; background: #fff; color: #15161a; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
.pager a.on { background: #1b1f3b; color: #fff; font-weight: 700; }
.pager .gap { align-self: center; color: #6b7080; }
.pills small { color: inherit; opacity: .7; margin-left: 2px; }
.search-box { display: flex; gap: 6px; }
.shop-shell .search-box input { min-width: 0; flex: 1; padding: 8px; }
.search-box .shop-button { padding: 8px 12px; flex: none; }
@media (max-width: 768px) {
  .filter-toggle { display: inline-flex; }
  .filters { display: none; flex-basis: 100%; }
  .filters.open { display: flex; }
}
</style>
