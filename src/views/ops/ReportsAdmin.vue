<script setup lang="ts">
// 營運報表與低庫存（Commerce V2 Phase 7）。模擬與測試金流一律標示「非真實營收」，真實營收只計正式金流。
import { onMounted, ref } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { money } from '@/api/catalog'
import { salesReport, lowStock, type SalesReport, type LowStockRow } from '@/api/ops'
const user = useUserInfoStore()
const has = (code: string) => user.permissions.some(p => p.code === code)
const today = new Date(), iso = (d: Date) => d.toISOString().slice(0, 10)
const from = ref(iso(new Date(today.getTime() - 29 * 86400000))), to = ref(iso(today)), threshold = ref(3)
const sales = ref<SalesReport>(), stock = ref<LowStockRow[]>([]), error = ref(''), loading = ref(false)
const failure = (e: any) => e.response?.data?.message || e.message || '暫時無法連線。'
async function load() {
  loading.value = true; error.value = ''
  try {
    if (has('reports.sales')) sales.value = await salesReport(from.value, to.value)
    if (has('reports.low-stock')) stock.value = await lowStock(threshold.value)
  } catch (e) { error.value = failure(e) } finally { loading.value = false }
}
onMounted(load)
</script>
<template>
 <section class="card"><div class="card-body">
  <h1>營運報表</h1>
  <p v-if="error" role="alert">{{ error }}</p>
  <template v-if="has('reports.sales')">
   <div class="actions"><label>從 <input v-model="from" type="date"></label><label>到 <input v-model="to" type="date"></label><button :disabled="loading" @click="load">查詢</button></div>
   <template v-if="sales">
    <p class="real"><strong>真實營收：{{ money(sales.realRevenueTwd) }}</strong>　{{ sales.note }}</p>
    <table><thead><tr><th>付款來源</th><th>訂單數</th><th>金額</th></tr></thead><tbody>
     <tr v-for="r in sales.revenue" :key="r.source" :class="{ fake: !r.real }"><td>{{ r.label }}</td><td>{{ r.orders }}</td><td>{{ money(r.amountTwd) }}</td></tr>
    </tbody></table>
    <h2>銷售排行（件數，已付款未退款）</h2>
    <ol><li v-for="t in sales.topProducts" :key="t.productId">{{ t.title }}：{{ t.quantity }} 件・{{ money(t.amountTwd) }}</li></ol>
    <p v-if="!sales.topProducts.length">這段期間沒有已付款訂單。</p>
   </template>
  </template>
  <template v-if="has('reports.low-stock')">
   <h2>低庫存提醒</h2>
   <div class="actions"><label>可售量 ≤ <input v-model.number="threshold" type="number" min="0" max="1000" style="width:80px"></label><button :disabled="loading" @click="load">重新整理</button></div>
   <table><thead><tr><th>商品</th><th>款式</th><th>實體</th><th>保留</th><th>可售</th></tr></thead><tbody>
    <tr v-for="r in stock" :key="r.skuId"><td>{{ r.title }}<small v-if="r.status !== 'PUBLISHED'">（草稿）</small></td><td>{{ r.label }}</td><td>{{ r.quantity }}</td><td>{{ r.reserved }}</td><td :class="{ zero: r.available <= 0 }">{{ r.available }}</td></tr>
   </tbody></table>
   <p v-if="!stock.length">沒有低於門檻的款式。</p>
  </template>
 </div></section>
</template>
<style scoped>
.actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 10px 0; }
table { width: 100%; margin-bottom: 12px; } td, th { padding: 6px 8px; }
.real { background: #ecfdf5; padding: 8px 12px; border-radius: 6px; }
.fake td:first-child::after { content: ''; }
.zero { color: #b91c1c; font-weight: 700; }
</style>
