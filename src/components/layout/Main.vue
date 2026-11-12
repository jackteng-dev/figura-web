<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { staffOrders, type OrderSummary } from '@/api/fulfillment'
import { staffPreorders } from '@/api/preorderMoney'
import { batchList, type Batch } from '@/api/preorders'
import { notificationList } from '@/api/notifications'
import { money } from '@/api/catalog'

const user = useUserInfoStore()
const can = (code: string) => user.permissions.some(p => (p.code || p.name) === code)
const loading = ref(true)

// 數字全部來自既有列表 API 的 total；沒有權限的區塊不呼叫 API、也不顯示。
const counts = ref<Record<string, number | null>>({})
const toShip = ref<OrderSummary[]>([])
const batches = ref<Batch[]>([])
const notify = ref<{ pending: number; retry: number; dead: number } | null>(null)

async function total(p: Promise<{ total: number }>) { try { return (await p).total } catch { return null } }
async function load() {
  loading.value = true
  const jobs: Promise<unknown>[] = []
  if (can('orders.read.list')) {
    jobs.push(staffOrders(1, 'PAID', 'UNFULFILLED').then(r => { counts.value.ship = r.total; toShip.value = r.items.slice(0, 6) }).catch(() => { counts.value.ship = null }))
    jobs.push(total(staffOrders(1, 'PENDING_PAYMENT', '')).then(n => { counts.value.pending = n }))
    jobs.push(total(staffOrders(1, 'PAID', 'SHIPPED')).then(n => { counts.value.shipped = n }))
  }
  if (can('preorder-orders.read')) jobs.push(total(staffPreorders(1, 'PENDING')).then(n => { counts.value.preHeld = n }))
  if (can('preorders.read')) jobs.push(batchList(1).then(r => { batches.value = r.items.filter(b => b.status === 'OPEN').sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt)) }).catch(() => {}))
  if (can('notifications.read')) jobs.push(Promise.all([total(notificationList(1, 'PENDING')), total(notificationList(1, 'RETRY')), total(notificationList(1, 'DEAD'))])
    .then(([pending, retry, dead]) => { notify.value = { pending: pending ?? 0, retry: retry ?? 0, dead: dead ?? 0 } }))
  await Promise.all(jobs)
  loading.value = false
}
onMounted(load)

const kpis = computed(() => [
  can('orders.read.list') && { key: 'ship', label: '待出貨', hint: '已付款、尚未出貨', to: '/admin/orders', tone: 'yellow' },
  can('orders.read.list') && { key: 'pending', label: '待付款', hint: '保留中，逾時自動釋放', to: '/admin/orders', tone: 'outline' },
  can('orders.read.list') && { key: 'shipped', label: '待確認送達', hint: '已模擬出貨', to: '/admin/orders', tone: 'white' },
  can('preorder-orders.read') && { key: 'preHeld', label: '預購保留中', hint: '等待顧客付款', to: '/admin/preorder-orders', tone: 'navy' }
].filter(Boolean) as { key: string; label: string; hint: string; to: string; tone: string }[])

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
const shortTime = (iso: string) => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
const pct = (n: number, cap: number) => cap ? Math.min(100, Math.round(n / cap * 100)) : 0
const today = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())
const quick = computed(() => [
  can('catalog.read.list') && { to: '/admin/products', label: '商品管理', primary: true },
  can('preorders.read') && { to: '/admin/preorders', label: '預購批次' },
  can('preorders.arrivals.read') && { to: '/admin/preorder-arrivals', label: '登記預購到貨' },
  can('masters.read') && { to: '/admin/masters', label: '品牌作品分類' }
].filter(Boolean) as { to: string; label: string; primary?: boolean }[])
</script>

<template>
  <div class="dash">
    <div class="dash-head">
      <div>
        <h1>Figura 工作首頁</h1>
        <p>{{ user.info?.username }}，{{ today }}。選單依目前授權顯示；付款、配送與退款皆為模擬演練。</p>
      </div>
      <router-link to="/shop" class="btn btn-outline-primary">前往顧客入口 →</router-link>
    </div>

    <section v-if="kpis.length" class="kpis" aria-label="今日待辦">
      <router-link v-for="k in kpis" :key="k.key" :to="k.to" class="kpi" :class="k.tone">
        <span class="kpi-label">{{ k.label }}</span>
        <span class="kpi-value">{{ loading && counts[k.key] === undefined ? '…' : (counts[k.key] ?? '—') }}</span>
        <span class="kpi-hint">{{ k.hint }} →</span>
      </router-link>
    </section>

    <div class="row2">
      <section v-if="can('orders.read.list')" class="panel wide" aria-labelledby="dash-ship">
        <div class="panel-head"><h2 id="dash-ship">待出貨訂單</h2><router-link to="/admin/orders">訂單管理 →</router-link></div>
        <p v-if="loading && !toShip.length" class="muted">載入中…</p>
        <p v-else-if="!toShip.length" class="muted">目前沒有待出貨的訂單。</p>
        <div v-else class="table-box">
          <table>
            <thead><tr><th>訂單</th><th>建立時間</th><th>付款時間</th><th>金額</th></tr></thead>
            <tbody>
              <tr v-for="o in toShip" :key="o.id">
                <td class="mono">{{ o.id.slice(0, 8) }}</td>
                <td>{{ shortTime(o.createdAt) }}</td>
                <td>{{ o.paidAt ? shortTime(o.paidAt) : '—' }}</td>
                <td class="strong">{{ money(o.totalTwd) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="can('preorders.read')" class="panel" aria-labelledby="dash-batches">
        <div class="panel-head"><h2 id="dash-batches">開放中預購批次</h2><router-link to="/admin/preorders">預購批次 →</router-link></div>
        <p v-if="!loading && !batches.length" class="muted">目前沒有開放中的批次。</p>
        <ul class="batches">
          <li v-for="b in batches.slice(0, 5)" :key="b.id">
            <div class="b-top"><span class="b-name">{{ b.productTitle }}・{{ b.skuLabel }}</span><span class="b-days" :class="{ soon: daysLeft(b.deadlineAt) <= 3 }">剩 {{ daysLeft(b.deadlineAt) }} 天</span></div>
            <div class="bar" role="img" :aria-label="`已付款 ${b.paidQuantity}、保留中 ${b.heldQuantity}、配額 ${b.capacity}`">
              <span class="paid" :style="{ width: pct(b.paidQuantity, b.capacity) + '%' }"></span><span class="held" :style="{ width: pct(b.heldQuantity, b.capacity) + '%' }"></span>
            </div>
            <span class="b-meta">已付款 {{ b.paidQuantity }}・保留中 {{ b.heldQuantity }}・配額 {{ b.capacity }}</span>
          </li>
        </ul>
      </section>
    </div>

    <div class="row2">
      <section v-if="quick.length" class="panel" aria-labelledby="dash-quick">
        <h2 id="dash-quick">快速前往</h2>
        <div class="quick">
          <router-link v-for="q in quick" :key="q.to" :to="q.to" :class="{ primary: q.primary }">{{ q.label }}</router-link>
        </div>
      </section>
      <section v-if="notify" class="panel wide" aria-labelledby="dash-notify">
        <div class="panel-head"><h2 id="dash-notify">通知佇列</h2><router-link to="/admin/notifications">訂單通知 →</router-link></div>
        <div class="nstats">
          <div><b>{{ notify.pending }}</b><span>等待派送</span></div>
          <div><b>{{ notify.retry }}</b><span>等待重試</span></div>
          <div :class="{ bad: notify.dead > 0 }"><b>{{ notify.dead }}</b><span>重試已用盡</span></div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dash { display: flex; flex-direction: column; gap: 20px; max-width: 1400px; }
.dash-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.dash-head h1 { margin: 0 0 4px; }
.dash-head p { margin: 0; color: #4b5060; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.kpi { display: flex; flex-direction: column; gap: 8px; border-radius: 14px; padding: 18px 20px; text-decoration: none; color: #15161a !important; transition: transform .15s; }
.kpi:hover { transform: translateY(-2px); }
.kpi.yellow { background: #ffd23f; }
.kpi.outline { background: #fff; border: 2px solid #1d4ed8; }
.kpi.white { background: #fff; }
.kpi.navy { background: #1b1f3b; color: #fff !important; }
.kpi-label { font-size: 14px; font-weight: 700; }
.kpi-value { font-size: 40px; font-weight: 900; line-height: 1; }
.kpi-hint { font-size: 13px; opacity: .85; }
.row2 { display: flex; flex-wrap: wrap; gap: 20px; }
.row2:empty { display: none; }
.panel { flex: 2 1 340px; min-width: 0; background: #fff; border-radius: 14px; padding: 22px; }
.panel.wide { flex: 3 1 520px; }
.panel h2 { font-size: 18px; margin: 0 0 14px; }
.panel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.panel-head h2 { margin: 0; }
.panel-head a { font-size: 14px; }
.muted { color: #4b5060; margin: 0; }
.table-box { overflow-x: auto; }
table { width: 100%; font-size: 14px; min-width: 440px; }
th { text-align: left; padding: 8px 10px; }
td { padding: 11px 10px; border-top: 1px solid #eceef4; }
.mono { font-family: ui-monospace, monospace; font-size: 13px; }
.strong { font-weight: 700; }
.batches { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.batches li { display: flex; flex-direction: column; gap: 6px; }
.b-top { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
.b-name { font-weight: 700; min-width: 0; overflow-wrap: anywhere; }
.b-days { font-size: 12px; font-weight: 700; color: #4b5060; white-space: nowrap; }
.b-days.soon { color: #9a3412; }
.bar { height: 8px; background: #eceef4; border-radius: 4px; overflow: hidden; display: flex; }
.bar .paid { background: #1b1f3b; }
.bar .held { background: #ffd23f; }
.b-meta { font-size: 12px; color: #4b5060; }
.quick { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.quick a { background: #f3f4f8; color: #15161a !important; text-decoration: none; border-radius: 12px; padding: 16px; font-weight: 700; }
.quick a.primary { background: #1b1f3b; color: #fff !important; }
.quick a:hover { outline: 2px solid #1b1f3b; }
.nstats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; text-align: center; }
.nstats div { background: #f3f4f8; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; }
.nstats b { font-size: 26px; font-weight: 900; }
.nstats span { font-size: 13px; color: #4b5060; }
.nstats .bad { background: #fdecec; }
.nstats .bad b, .nstats .bad span { color: #8a1c1c; }
</style>
