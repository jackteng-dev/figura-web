<script setup lang="ts">
// 我的出貨（Commerce V2 Phase 5）：合併寄送與私人倉庫暫存。只搬移包裹，不改訂單金額與付款。
import { computed, onMounted, ref } from 'vue'
import { CustomerApiError } from '@/api/customer'
import { money } from '@/api/catalog'
import { myShipments, mergeShipments, holdShipment, shipmentStatus, waitingText, type CustomerShipment } from '@/api/shipping'
const items = ref<CustomerShipment[]>([]), total = ref(0), storageDays = ref(0), loading = ref(false), busy = ref(false)
const error = ref(''), message = ref(''), picked = ref<string[]>([])
// 結果未確認時保留同一 requestId／內容重送
const pending = ref<{ kind: 'merge' | 'hold' | 'release'; id?: string; body: any }>()
async function load() {
  loading.value = true; error.value = ''
  try { const r = await myShipments(); items.value = r.items; total.value = r.total; storageDays.value = r.storageDays; picked.value = picked.value.filter(id => items.value.some(i => i.shipment.id === id && i.mergeable)) }
  catch (e) { error.value = e instanceof Error ? e.message : '出貨資料暫時無法載入' }
  finally { loading.value = false }
}
const date = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString('zh-TW') : ''
const canMerge = computed(() => picked.value.length >= 2 && !busy.value)
async function run(kind: 'merge' | 'hold' | 'release', id?: string) {
  if (!pending.value) {
    if (kind === 'merge') {
      if (!canMerge.value || !confirm('合併後這些訂單會一起寄出。\n只合併寄送，不會改訂單金額與付款；運費差額由店家審核，目前不會自動退款。確定合併？')) return
      pending.value = { kind, body: { requestId: crypto.randomUUID(), shipments: picked.value.map(pid => { const s = items.value.find(i => i.shipment.id === pid)!.shipment; return { id: s.id, expectedVersion: s.version } }) } }
    } else {
      const s = items.value.find(i => i.shipment.id === id)!.shipment
      pending.value = { kind, id, body: { requestId: crypto.randomUUID(), expectedVersion: s.version } }
    }
  }
  busy.value = true; error.value = ''; message.value = ''
  try {
    const p = pending.value!
    if (p.kind === 'merge') {
      const r = await mergeShipments(p.body); picked.value = []
      message.value = r.replayed ? '合併已核對，沒有重複合併。' : '已合併成一張出貨單。' + (r.adjustment ? `原運費 NT$ ${r.adjustment.beforeFeeTwd}、合併後 NT$ ${r.adjustment.afterFeeTwd}，差額 NT$ ${r.adjustment.creditTwd} 待店家審核（目前不會自動退款）。` : '')
    } else {
      await holdShipment(p.id!, p.kind === 'hold', p.body)
      message.value = p.kind === 'hold' ? '已暫存到私人倉庫，暫存期間不會出貨。' : '已取消暫存，會在可出貨時安排寄送。'
    }
    pending.value = undefined
    await load()
  } catch (e) {
    if (e instanceof CustomerApiError && e.status >= 400 && e.status < 500) { pending.value = undefined; error.value = e.message + (e.status === 409 ? '（已重新讀取）' : ''); if (e.status === 409) await load() }
    else error.value = '結果尚未確認，請按「重試」以同一個操作再送一次（不會重複執行）。'
  } finally { busy.value = false }
}
function retry() { if (pending.value) void run(pending.value.kind, pending.value.id) }
onMounted(load)
</script>
<template>
  <section class="shop-panel">
    <h1>我的出貨</h1>
    <p class="muted">可以把尚未寄出的包裹暫存在私人倉庫（{{ storageDays }} 天，測試設定），或把同地址、同配送方式的包裹合併一起寄。合併只改變寄送方式，不會改訂單金額或付款。配送為模擬演練。</p>
    <p v-if="error" class="shop-error" role="alert">{{ error }} <button v-if="pending" type="button" class="shop-button" :disabled="busy" @click="retry">重試</button></p>
    <p v-if="message" class="shop-success" role="status">{{ message }}</p>
    <p v-if="loading && !items.length" role="status">載入中…</p>
    <div v-else-if="!items.length" class="shop-empty">目前沒有出貨單。結帳後的包裹會出現在這裡。</div>
    <template v-else>
      <div class="merge-bar"><span>已選 {{ picked.length }} 張</span><button type="button" class="shop-button" :disabled="!canMerge || !!pending" @click="run('merge')">合併寄送</button></div>
      <ul class="ship-list">
        <li v-for="i in items" :key="i.shipment.id">
          <label class="pick"><input v-model="picked" type="checkbox" :value="i.shipment.id" :disabled="!i.mergeable || !!pending" :aria-label="'選擇出貨單 ' + i.shipment.id.slice(0, 8)"></label>
          <div class="body">
            <strong>{{ shipmentStatus[i.shipment.status] }}<template v-if="i.shipment.status === 'WAITING' && i.shipment.waitingFor">・{{ waitingText[i.shipment.waitingFor] }}</template></strong>
            <span class="meta">{{ i.shipment.methodName }}・{{ i.shipment.orders.length }} 張訂單・商品 {{ money(i.shipment.goodsTwd) }}・運費 {{ money(i.shipment.feeTwd) }}</span>
            <span class="orders">{{ i.shipment.orders.map(o => o.title).join('、') }}</span>
            <span v-if="i.shipment.heldAt" class="held">暫存在私人倉庫，期限 {{ date(i.shipment.storageUntil) }}</span>
            <span v-if="i.blockedReason" class="muted small">{{ i.blockedReason }}</span>
          </div>
          <div class="acts">
            <button v-if="i.canHold" type="button" :disabled="busy || !!pending" @click="run('hold', i.shipment.id)">暫存到倉庫</button>
            <button v-if="i.canRelease" type="button" :disabled="busy || !!pending" @click="run('release', i.shipment.id)">取消暫存</button>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>
<style scoped>
.muted { color: #4b5060; font-size: 14px; } .small { font-size: 12px; }
.merge-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 12px 0; flex-wrap: wrap; }
.ship-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.ship-list li { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; background: #fff; border: 1px solid #e3e5ec; border-radius: 12px; padding: 12px; }
.pick input { width: 20px; height: 20px; }
.body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.meta, .orders { font-size: 13px; color: #4b5060; overflow-wrap: anywhere; }
.held { font-size: 13px; color: #92400e; background: #fef3c7; border-radius: 6px; padding: 2px 8px; align-self: flex-start; }
.acts { display: flex; flex-direction: column; gap: 6px; }
.acts button { min-height: 40px; border: 1px solid #d4d7e2; background: #fff; border-radius: 8px; padding: 0 12px; cursor: pointer; }
@media (max-width: 520px) { .ship-list li { grid-template-columns: auto 1fr; } .acts { grid-column: 1 / -1; flex-direction: row; } }
</style>
