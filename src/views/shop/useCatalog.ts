import { computed, ref } from 'vue'
import { publicProducts, type ProductImage, type PublicProduct } from '@/api/catalog'
import { publicBatches, type PublicBatch } from '@/api/preorders'

// 公開 API 目前只支援分頁，搜尋／篩選／排序在瀏覽器端進行；
// 單店商品數量有限，最多讀取 MAX_PAGES 頁（每頁 12 件）。
const MAX_PAGES = 20

const products = ref<PublicProduct[]>([])
const batches = ref<PublicBatch[]>([])
const loading = ref(false)
const error = ref('')
const truncated = ref(false)
let pending: Promise<void> | null = null
let loadedAt = 0

async function readAll<T>(read: (page: number) => Promise<{ items: T[]; pageSize: number; total: number }>) {
  const items: T[] = []
  let page = 1, total = 0
  do {
    const result = await read(page)
    items.push(...result.items)
    total = result.total
    if (!result.items.length) break
    page++
  } while (items.length < total && page <= MAX_PAGES)
  return { items, complete: items.length >= total }
}

async function fetchAll() {
  loading.value = true; error.value = ''
  try {
    const [p, b] = await Promise.all([
      readAll(publicProducts),
      readAll(publicBatches).catch(() => ({ items: [] as PublicBatch[], complete: true }))
    ])
    products.value = p.items
    batches.value = b.items
    truncated.value = !p.complete
    loadedAt = Date.now()
  } catch (e: any) {
    error.value = e?.message || '商品暫時無法載入，請稍後重試。'
  } finally {
    loading.value = false
    pending = null
  }
}

/** 讀取共用商品資料；60 秒內重複呼叫沿用快取，force 時重新讀取。 */
export function loadCatalog(force = false) {
  if (pending) return pending
  if (!force && loadedAt && Date.now() - loadedAt < 60_000) return Promise.resolve()
  pending = fetchAll()
  return pending
}

export const openBatches = computed(() =>
  batches.value.filter(b => b.orderingEnabled).sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt)))

export const batchesByProduct = computed(() => {
  const map = new Map<string, PublicBatch[]>()
  for (const b of openBatches.value) map.set(b.productId, [...(map.get(b.productId) || []), b])
  return map
})

export const minPrice = (p: PublicProduct) => p.skus.length ? Math.min(...p.skus.map(s => s.priceTwd)) : 0
export const inStock = (p: PublicProduct) => p.skus.some(s => s.available)
export const onPreorder = (p: PublicProduct) => batchesByProduct.value.has(p.id)

/** 開放中但配額已滿（不可下單）的批次，依商品分組；用來顯示「預購額滿」。 */
const fullBatchesByProduct = computed(() => {
  const map = new Map<string, PublicBatch[]>()
  for (const b of batches.value) {
    if (b.status === 'OPEN' && !b.orderingEnabled && b.availableQuota <= 0) map.set(b.productId, [...(map.get(b.productId) || []), b])
  }
  return map
})

/**
 * 商品的購買狀態。預購看配額與截單日，不看現貨庫存：
 *  stock＝有現貨；stock-pre＝有現貨另有預購；pre＝僅預購（可下單）；pre-full＝預購額滿；out＝暫無庫存。
 */
export type BuyState =
  | { kind: 'stock' } | { kind: 'out' }
  | { kind: 'stock-pre' | 'pre'; batch: PublicBatch }
  | { kind: 'pre-full'; batch: PublicBatch }
export function buyState(p: PublicProduct): BuyState {
  const open = batchesByProduct.value.get(p.id)?.[0]
  const stock = inStock(p)
  if (open) return { kind: stock ? 'stock-pre' : 'pre', batch: open }
  if (stock) return { kind: 'stock' }
  const full = fullBatchesByProduct.value.get(p.id)?.[0]
  return full ? { kind: 'pre-full', batch: full } : { kind: 'out' }
}

function countBy(key: (p: PublicProduct) => string | null) {
  const m = new Map<string, number>()
  for (const p of products.value) { const k = key(p); if (k) m.set(k, (m.get(k) || 0) + 1) }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant')).map(([name, count]) => ({ name, count }))
}
export const categories = computed(() => countBy(p => p.category))
export const brands = computed(() => countBy(p => p.brand))
export const works = computed(() => countBy(p => p.work))

/** 距截單天數（無條件進位）；已過期回傳 0。 */
export function daysLeft(deadlineAt: string) {
  const ms = new Date(deadlineAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}
export function shortDate(value: string) {
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' }).format(new Date(value))
}

/** 預購入口連到商品頁並捲到該批次（商品頁就能選批次下單，不必多經過批次頁）。 */
export const batchLink = (b: Pick<PublicBatch, 'id' | 'productId'>) => `/shop/products/${b.productId}#batch-${b.id}`

/** 首頁主視覺輪播的一張。 */
export interface HeroSlide {
  key: string; to: string; pill: string; title: string; sub: string; price: string; cta: string
  image: ProductImage | null | undefined; category?: string
}

export function useCatalog() {
  return { products, batches, loading, error, truncated, openBatches, batchesByProduct, categories, brands, works, load: loadCatalog }
}
