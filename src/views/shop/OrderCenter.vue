<script setup lang="ts">
// 統一訂單中心：現貨與預購在同一個列表。篩選、排序與分頁由伺服器在兩種訂單合併後計算（全域正確）。
// 詳情、付款、取消、退款、退貨等操作沿用原本的現貨／預購頁（以 ?focus= 帶到該筆）。
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CustomerApiError } from '@/api/customer'
import { getOrderCenter, stageLabel, detailLink, type OrderCenterPage, type OrderKind, type OrderSort, type OrderStage } from '@/api/orderCenter'
import { money } from '@/api/catalog'
import ProductCover from './ProductCover.vue'
import { useCatalog } from './useCatalog'

const route = useRoute(), router = useRouter(), catalog = useCatalog()
const STAGES: OrderStage[] = ['ALL', 'PENDING_PAYMENT', 'WAITING_ARRIVAL', 'TO_SHIP', 'SHIPPED', 'COMPLETED', 'RETURNING', 'CANCELLED', 'REFUNDED', 'REVIEW']
const KINDS: OrderKind[] = ['ALL', 'STOCK', 'PREORDER'], SORTS: OrderSort[] = ['NEWEST', 'OLDEST', 'AMOUNT_DESC', 'AMOUNT_ASC']
const pick = <T extends string>(v: unknown, list: T[], d: T): T => (typeof v === 'string' && (list as string[]).includes(v) ? (v as T) : d)
// 網址是唯一的篩選來源：重新整理、上一頁／下一頁、同頁連結都會得到同一個畫面
const kind = computed<OrderKind>(() => pick(route.query.kind, KINDS, 'ALL'))
const stage = computed<OrderStage>(() => pick(route.query.stage, STAGES, 'ALL'))
const sort = computed<OrderSort>(() => pick(route.query.sort, SORTS, 'NEWEST'))
const page = computed(() => { const n = Number(route.query.page); return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : 1 })
function go(next: { kind?: OrderKind; stage?: OrderStage; sort?: OrderSort; page?: number }) {
  const k = next.kind ?? kind.value, st = next.stage ?? stage.value, so = next.sort ?? sort.value, pg = next.page ?? page.value
  void router.push({ query: { ...(k !== 'ALL' ? { kind: k } : {}), ...(st !== 'ALL' ? { stage: st } : {}), ...(so !== 'NEWEST' ? { sort: so } : {}), ...(pg > 1 ? { page: String(pg) } : {}) } })
}
const data = ref<OrderCenterPage>(), busy = ref(false), error = ref('')
const pages = computed(() => (data.value ? Math.max(1, Math.ceil(data.value.total / data.value.pageSize)) : 1))
const visibleStages = computed(() => STAGES.filter(s => s === 'ALL' || s === stage.value || (data.value?.counts[s] ?? 0) > 0))
const imageOf = (productId: string | null) => catalog.products.value.find(p => p.id === productId)?.image
const time = (v: string) => new Intl.DateTimeFormat('zh-TW', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Taipei' }).format(new Date(v))
const kindLabel = { ALL: '全部', STOCK: '現貨', PREORDER: '預購' }
const sortLabel = { NEWEST: '最新優先', OLDEST: '最舊優先', AMOUNT_DESC: '金額高到低', AMOUNT_ASC: '金額低到高' }

let seq = 0
async function load() {
  const mine = ++seq
  busy.value = true; error.value = ''
  try {
    const result = await getOrderCenter({ kind: kind.value, stage: stage.value, sort: sort.value, page: page.value })
    if (mine !== seq) return // 較晚的請求已經送出，捨棄過期結果
    // 篩選後頁數變少（例如訂單狀態剛改變）：回到最後一頁
    if (!result.items.length && result.total > 0 && page.value > 1) { void router.replace({ query: { ...route.query, page: String(Math.ceil(result.total / result.pageSize)) } }); return }
    data.value = result
  } catch (e) {
    if (mine !== seq) return
    if (e instanceof CustomerApiError && e.status === 401) { await router.replace('/shop/login'); return }
    error.value = e instanceof Error ? e.message : '讀取訂單失敗，請重試。'
  } finally { if (mine === seq) busy.value = false }
}
watch(() => [kind.value, stage.value, sort.value, page.value].join('|'), () => { void load() })
function setStage(s: OrderStage) { go({ stage: s, page: 1 }) }
function setKind(k: OrderKind) { go({ kind: k, page: 1 }) }
function setSort(e: Event) { go({ sort: (e.target as HTMLSelectElement).value as OrderSort, page: 1 }) }
onMounted(() => { void catalog.load(); void load() })
</script>

<template>
 <section class="order-center">
  <div class="head"><h1>我的訂單</h1><button class="shop-button ghost" :disabled="busy" @click="load">重新整理</button></div>
  <p class="intro">現貨與預購訂單都在這裡。付款、取消、退貨與出貨進度請點「查看詳情」。</p>

  <div class="controls">
   <div class="kinds" role="group" aria-label="訂單類型">
    <button v-for="k in KINDS" :key="k" type="button" :aria-pressed="kind === k" :class="{ on: kind === k }" @click="setKind(k)">{{ kindLabel[k] }}</button>
   </div>
   <label class="sort">排序<select :value="sort" @change="setSort"><option v-for="s in SORTS" :key="s" :value="s">{{ sortLabel[s] }}</option></select></label>
  </div>
  <nav class="stages" aria-label="訂單狀態">
   <button v-for="s in visibleStages" :key="s" type="button" :aria-pressed="stage === s" :class="{ on: stage === s }" :data-testid="'stage-' + s" @click="setStage(s)">
    {{ stageLabel[s] }}<span class="count">{{ data?.counts[s] ?? 0 }}</span>
   </button>
  </nav>

  <p v-if="error" role="alert" class="shop-error">{{ error }} <button class="link" @click="load">重試</button></p>
  <p v-if="busy && !data" role="status">正在讀取訂單…</p>
  <div v-if="data && !data.items.length" class="empty" data-testid="order-center-empty">
   <p>{{ stage === 'ALL' && kind === 'ALL' ? '目前沒有訂單。' : '這個篩選條件沒有訂單。' }}</p>
   <router-link class="shop-button primary" to="/shop/products">去逛逛</router-link>
  </div>

  <ul v-if="data?.items.length" class="list" :aria-busy="busy">
   <li v-for="o in data.items" :key="o.kind + o.id" class="card" :data-testid="'center-' + o.id">
    <router-link class="thumb" :to="detailLink(o)" :aria-label="'查看訂單 ' + (o.title || '')"><ProductCover :image="imageOf(o.productId)" /></router-link>
    <div class="info">
     <p class="tags"><span class="tag" :class="o.kind === 'PREORDER' ? 'pre' : 'stock'">{{ o.kind === 'PREORDER' ? '預購' : '現貨' }}</span><span class="stage" :class="'st-' + o.stage">{{ stageLabel[o.stage] }}</span></p>
     <h2>{{ o.title || '訂單' }}<span v-if="o.lineCount > 1" class="more">等 {{ o.lineCount }} 款</span></h2>
     <p class="meta">共 {{ o.quantity }} 件 · {{ time(o.createdAt) }} 下單 · 編號 {{ o.id.slice(0, 8) }}</p>
     <p v-if="o.stage === 'PENDING_PAYMENT' && o.expiresAt" class="due">請在 {{ time(o.expiresAt) }} 前完成付款</p>
     <p v-if="o.kind === 'PREORDER' && o.arrivalFrom" class="meta">預計到貨 {{ o.arrivalFrom }} ～ {{ o.arrivalTo }}</p>
     <p v-if="o.paymentReviewRequired" class="warn">付款通知待人工核對</p>
    </div>
    <div class="end">
     <strong class="total">{{ money(o.totalTwd) }}</strong>
     <router-link class="shop-button" :class="o.stage === 'PENDING_PAYMENT' ? 'primary' : 'ghost'" :to="detailLink(o)">{{ o.stage === 'PENDING_PAYMENT' ? '前往付款' : '查看詳情' }}</router-link>
    </div>
   </li>
  </ul>

  <nav v-if="data && data.total > data.pageSize" class="pager" aria-label="分頁">
   <button class="shop-button ghost" :disabled="busy || page <= 1" @click="go({ page: page - 1 })">上一頁</button>
   <span>第 {{ page }} / {{ pages }} 頁，共 {{ data.total }} 筆</span>
   <button class="shop-button ghost" :disabled="busy || page >= pages" @click="go({ page: page + 1 })">下一頁</button>
  </nav>
 </section>
</template>

<style scoped>
.order-center{min-width:0}.head{display:flex;justify-content:space-between;align-items:center;gap:12px}.head h1{margin:0}.intro{color:#4b5060;font-size:14px}
.controls{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin:12px 0}
.kinds{display:inline-flex;background:#fff;border-radius:999px;padding:4px;gap:4px}.kinds button{border:0;background:transparent;padding:8px 16px;border-radius:999px;font:inherit;cursor:pointer;color:#4b5060}.kinds button.on{background:#1b1f3b;color:#fff;font-weight:700}
.sort{display:flex;align-items:center;gap:8px;font-size:14px;white-space:nowrap}.sort select{padding:8px;border:1px solid #d5d8e0;border-radius:8px;font:inherit}
.stages{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:12px}.stages button{flex:none;border:1px solid #e3e5ec;background:#fff;border-radius:999px;padding:8px 14px;font:inherit;font-size:14px;cursor:pointer;color:#15161a}
.stages button.on{border-color:#c2410c;color:#c2410c;font-weight:700}.count{margin-left:6px;font-size:12px;background:#f3f4f8;border-radius:999px;padding:1px 8px;color:#4b5060}
.list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.card{background:#fff;border-radius:14px;padding:16px;display:grid;grid-template-columns:88px minmax(0,1fr) auto;gap:16px;align-items:center;overflow-wrap:anywhere}
.thumb{display:block;width:88px}.thumb :deep(.cover-empty small){display:none}
.info h2{font-size:16px;margin:4px 0}.more{font-size:13px;color:#4b5060;font-weight:400;margin-left:6px}.shop-shell .info p{margin:2px 0;font-size:13px}.meta{color:#4b5060}
.tags{display:flex;gap:6px}.tag{font-size:12px;border-radius:6px;padding:2px 8px}.tag.stock{background:#eef2ff;color:#3730a3}.tag.pre{background:#fff7ed;color:#9a3412}
.stage{font-size:12px;font-weight:700;color:#1b1f3b}.st-PENDING_PAYMENT,.st-REVIEW{color:#c2410c}.st-CANCELLED,.st-REFUNDED{color:#6b7280}
.due{color:#c2410c;font-weight:700}.warn{color:#b42318}
.end{display:flex;flex-direction:column;align-items:flex-end;gap:8px}.total{font-size:18px;font-weight:900}
.empty{background:#fff;border-radius:14px;padding:24px;display:flex;flex-direction:column;align-items:flex-start;gap:12px}
.pager{display:flex;justify-content:center;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap}
.link{border:0;background:transparent;color:#1d4ed8;text-decoration:underline;cursor:pointer;font:inherit;padding:0}
@media(max-width:640px){.card{grid-template-columns:64px minmax(0,1fr)}.thumb{width:64px}.end{grid-column:1/-1;flex-direction:row;justify-content:space-between;align-items:center}}
</style>
