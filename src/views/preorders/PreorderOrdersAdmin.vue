<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useUserInfoStore } from '@/stores/userInfo'
import { staffPreorders, staffPreorder, refundPreorder, type Summary, type Detail, type RefundBody } from '@/api/preorderMoney'
import { fulfillPreorder, fulfillmentActions } from '@/api/preorderFulfillment'
import { preorderStatus } from '@/api/preorderOrders'
import { money } from '@/api/catalog'
import { taipeiTime } from '@/api/preorders'
const user = useUserInfoStore(), has = (code: string) => user.permissions.some(p => (p.code || p.name) === code)
const rows = ref<Summary[]>([]), selected = ref<Detail>(), page = ref(1), total = ref(0), status = ref(''), note = ref('')
const busy = ref(false), ready = ref(false), stale = ref(false), error = ref(''), success = ref('')
const fulfillmentNote = ref('')
const pending = ref<{ id: string; payment?: string; action?: 'allocate' | 'mock-ship' | 'mock-deliver'; body: RefundBody & { expectedBatchVersion?: number } }>(), frozen = computed(() => busy.value || !!pending.value)
async function read() { ready.value = false; const result = await staffPreorders(page.value, status.value); rows.value = result.items; total.value = result.total; if (selected.value) selected.value = await staffPreorder(selected.value.order.id); ready.value = true }
async function load() { if (frozen.value) return; busy.value = true; error.value = ''; try { await read() } catch (e: any) { error.value = e.response?.data?.message || e.message || '讀取失敗，請重試。' } finally { busy.value = false } }
async function select(id: string) { if (frozen.value || !has('preorder-orders.detail')) return; busy.value = true; error.value = ''; try { selected.value = await staffPreorder(id); stale.value = false } catch (e: any) { ready.value = false; error.value = e.response?.data?.message || '詳情讀取失敗。' } finally { busy.value = false } }
async function refund(payment?: string) {
  if (busy.value || pending.value?.action) return
  if (!pending.value) {
    if (!selected.value || !ready.value || stale.value || !note.value.trim() || !has(payment ? 'preorder-orders.review.mock' : 'preorder-orders.refund.mock') || !window.confirm('執行整筆預購模擬退款？只作演練，不會轉帳。')) return
    pending.value = { id: selected.value.order.id, payment, body: { requestId: crypto.randomUUID(), expectedOrderVersion: selected.value.order.version, note: note.value.trim() } }
  }
  busy.value = true; error.value = ''; success.value = ''
  try { const r = await refundPreorder(pending.value.id, pending.value.payment, pending.value.body); pending.value = undefined; selected.value = r.current; note.value = ''; success.value = r.replayed ? '原退款操作已核對，沒有重複退款或釋放。' : '模擬退款已保存；不會實際轉帳。'; try { await read() } catch { ready.value = false; error.value = '退款已確認，但資料讀取失敗。請重讀核對。' } }
  catch (e: any) { const code = e.response?.status; if (code >= 400 && code < 500) { pending.value = undefined; ready.value = false; stale.value = true; error.value = `${e.response?.data?.message || '操作被拒絕'} 請重讀，再明確重新開啟此訂單。` } else error.value = '退款回應尚未確認，請重試原操作。原因与操作編號已鎖定。' }
  finally { busy.value = false }
}
async function fulfill(action?: 'allocate' | 'mock-ship' | 'mock-deliver') {
  if (busy.value || (pending.value && !pending.value.action)) return
  if (!pending.value) {
    if (!selected.value || !action || !ready.value || stale.value || !fulfillmentNote.value.trim()) return
    const permission = action === 'allocate' ? 'preorder-orders.allocate' : action === 'mock-ship' ? 'preorder-orders.ship.mock' : 'preorder-orders.deliver.mock'
    const allowed = action === 'allocate' ? selected.value.fulfillment.canAllocate : action === 'mock-ship' ? selected.value.fulfillment.canShip : selected.value.fulfillment.canDeliver
    if (!has(permission) || !allowed || !window.confirm(action === 'allocate' ? '將實際到貨整筆分配給此已付款訂單？分配後不可使用未到貨退款。' : '送出預購模擬履約？不會建立真物流託運。')) return
    pending.value = { id: selected.value.order.id, action, body: { requestId: crypto.randomUUID(), expectedOrderVersion: selected.value.order.version, note: fulfillmentNote.value.trim(), ...(action === 'allocate' ? { expectedBatchVersion: selected.value.fulfillment.supply.version } : {}) } }
  }
  busy.value = true; error.value = ''; success.value = ''
  try { const p = pending.value; const r = await fulfillPreorder(p.id, p.action!, p.body); pending.value = undefined; if (selected.value) { selected.value.order = r.order; selected.value.fulfillment = r.current; selected.value.canRefund = false }; fulfillmentNote.value = ''; success.value = r.replayed ? '原到貨履約操作已核對，沒有重複分配或出貨。' : '預購到貨履約操作已保存。'; try { await read() } catch { ready.value = false; error.value = '履約已確認，但資料讀取失敗。請重讀核對，勿重送。' } }
  catch (e: any) { const code = e.response?.status; if (code >= 400 && code < 500) { pending.value = undefined; ready.value = false; stale.value = true; error.value = `${e.response?.data?.message || '履約被拒絕'} 請重讀，再明確重新開啟此訂單。` } else error.value = '履約結果尚未確認，請重試原操作。原因與操作編號已鎖定。' }
  finally { busy.value = false }
}
onBeforeRouteLeave(() => !pending.value || window.confirm('操作結果尚未確認。離開會失去原操作，確定離開？'))
onMounted(load)
</script>
<template>
  <section class="preorder-orders-admin"><h1>預購訂單</h1><p>付款與退款皆為本地模擬，不會收款或轉帳。未到貨、未出貨且無待核對付款，才可整筆退款釋放已付配額。</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="success" role="status">{{ success }}</p><p v-if="busy" role="status">處理中…</p>
    <label>訂單狀態<select v-model="status" aria-label="訂單狀態" :disabled="frozen" @change="page = 1; load()"><option value="">全部</option><option v-for="(label, key) in preorderStatus" :key="key" :value="key">{{ label }}</option></select></label>
    <button :disabled="frozen" @click="load">重讀資料</button><button v-if="pending && !pending.action" :disabled="busy" @click="refund()">重試原退款操作</button><button v-if="pending?.action" :disabled="busy" @click="fulfill()">重試原到貨履約操作</button>
    <p v-if="!has('preorder-orders.refund.mock') && !has('preorder-orders.review.mock')">目前為唯讀，不能執行預購退款或核對。</p>
    <div class="table-wrap"><table><thead><tr><th>訂單／批次</th><th>狀態／金額</th><th>操作</th></tr></thead><tbody><tr v-for="o in rows" :key="o.id"><td>{{ o.batchName }}<br><small>{{ o.id }}</small></td><td>{{ preorderStatus[o.status] }} · {{ money(o.totalTwd) }}<br><span v-if="o.paymentReviewRequired">有付款待核對</span></td><td><button v-if="has('preorder-orders.detail')" :disabled="frozen || !ready" @click="select(o.id)">查看 {{ o.id }}</button></td></tr></tbody></table></div>
    <div class="pagination"><button :disabled="frozen || !ready || page === 1" @click="page--; load()">上一頁</button><span>第 {{ page }} 頁</span><button :disabled="frozen || !ready || page * 20 >= total" @click="page++; load()">下一頁</button></div>
    <section v-if="selected" class="preorder-order-detail"><h2>預購訂單詳情</h2><p>{{ selected.order.id }} · {{ preorderStatus[selected.order.status] }} · 版本 {{ selected.order.version }}</p><p>{{ selected.order.productTitle }} · {{ selected.order.skuLabel }} × {{ selected.order.quantity }} · {{ money(selected.order.totalTwd) }}</p><p>到貨：{{ selected.order.arrivalStatus }} · 配送：{{ selected.order.fulfillmentStatus }}（出貨與送達為模擬）</p><p>預估到貨 {{ selected.order.arrivalFrom }} ～ {{ selected.order.arrivalTo }}；保留至 {{ taipeiTime(selected.order.expiresAt) }}</p>
      <p>{{ selected.order.shipping.recipientName }} · {{ selected.order.shipping.phone }} · {{ selected.order.shipping.city }}{{ selected.order.shipping.district }}{{ selected.order.shipping.street }}</p>
      <button v-if="stale" :disabled="frozen || !ready" @click="select(selected.order.id)">重新開啟此訂單</button>
      <label v-if="has('preorder-orders.refund.mock') || has('preorder-orders.review.mock')">退款核對原因<textarea v-model="note" aria-label="退款核對原因" maxlength="500" :disabled="frozen || stale" /></label>
      <button v-if="has('preorder-orders.refund.mock') && selected.refundsEnabled" :disabled="frozen || !ready || stale || !selected.canRefund || !note.trim()" @click="refund()">模擬預購整筆退款</button>
      <p v-if="!selected.refundsEnabled">此環境未啟用退款模擬。</p>
      <section class="fulfillment-detail"><h3>到貨分配與履約</h3><p>批次已到貨 {{ selected.fulfillment.supply.receivedQuantity }}；待分配 {{ selected.fulfillment.supply.unallocatedQuantity }}；已出貨 {{ selected.fulfillment.supply.shippedQuantity }}</p><p>本單已分配 {{ selected.order.fulfillment.allocatedQuantity }}／{{ selected.order.quantity }} 件</p><p v-if="selected.order.fulfillment.trackingNumber">模擬貨件 {{ selected.order.fulfillment.trackingNumber }}</p><p v-if="selected.order.fulfillment.shippedAt">模擬出貨 {{ taipeiTime(selected.order.fulfillment.shippedAt) }}</p><p v-if="selected.order.fulfillment.deliveredAt">模擬送達 {{ taipeiTime(selected.order.fulfillment.deliveredAt) }}</p>
      <label v-if="has('preorder-orders.allocate') || has('preorder-orders.ship.mock') || has('preorder-orders.deliver.mock')">到貨與履約原因<textarea v-model="fulfillmentNote" aria-label="到貨與履約原因" maxlength="500" :disabled="frozen || stale" /></label>
      <button v-if="has('preorder-orders.allocate')" :disabled="frozen || !ready || stale || !selected.fulfillment.canAllocate || !fulfillmentNote.trim()" @click="fulfill('allocate')">整筆分配預購到貨</button><button v-if="has('preorder-orders.ship.mock') && selected.fulfillment.mockEnabled" :disabled="frozen || !ready || stale || !selected.fulfillment.canShip || !fulfillmentNote.trim()" @click="fulfill('mock-ship')">模擬預購出貨</button><button v-if="has('preorder-orders.deliver.mock') && selected.fulfillment.mockEnabled" :disabled="frozen || !ready || stale || !selected.fulfillment.canDeliver || !fulfillmentNote.trim()" @click="fulfill('mock-deliver')">模擬預購送達</button><p v-if="!selected.fulfillment.mockEnabled">此環境未啟用預購履約模擬。</p>
      <p>分配需已付款、到貨足夠且無待核對付款。出貨需整筆已分配；分配後不適用未到貨退款。</p></section>
      <h3>付款紀錄</h3><p v-for="p in selected.payments.items" :key="p.id">{{ p.id }} · {{ p.status }} · {{ money(p.amountTwd) }} {{ p.refund ? '（已模擬退款）' : '' }}</p>
      <h3>待核對原通知</h3><article v-for="r in selected.reviews" :key="r.paymentId"><p>{{ r.paymentId }} · {{ money(r.amountTwd) }} · {{ r.refunded ? '已核對退款' : '待核對' }}</p><p v-for="e in r.evidence" :key="e.eventId">通知 {{ e.eventId }} · {{ e.outcome }} · {{ e.disposition }} · {{ taipeiTime(e.createdAt) }}</p><button v-if="has('preorder-orders.review.mock') && selected.refundsEnabled && !r.refunded" :disabled="frozen || !ready || stale || !note.trim()" @click="refund(r.paymentId)">模擬預購核對退款 {{ r.paymentId }}</button></article>
      <h3>不可變退款稽核</h3><details v-for="e in selected.refunds" :key="e.requestId"><summary>{{ e.action }} · {{ money(e.amountTwd) }}</summary><p>操作 ID：{{ e.requestId }} · {{ e.actorUsername }} · {{ e.beforeVersion }} → {{ e.afterVersion }}</p><p>{{ e.note }}</p></details>
      <h3>到貨與履約稽核</h3><details v-for="e in selected.fulfillment.events" :key="e.requestId"><summary>{{ fulfillmentActions[e.action] }} · {{ e.quantity }} 件</summary><p>{{ e.requestId }} · {{ e.actorUsername }} · 訂單版本 {{ e.orderVersionBefore }} → {{ e.orderVersionAfter }} · {{ taipeiTime(e.createdAt) }}</p><p>{{ e.note }}</p></details>
    </section>
  </section>
</template>
<style scoped>
.preorder-orders-admin{min-width:0;overflow-wrap:anywhere;background:#fff;padding:24px;border-radius:12px}h1{font-size:26px}h2{font-size:22px}h3{font-size:18px;margin-top:24px}p{line-height:1.7}label{display:block;margin:14px 0}select,textarea{width:100%;padding:10px;border:1px solid #ccd2cc;border-radius:5px}button{margin:6px 10px 6px 0;padding:9px 13px;border:1px solid #bac6bc;background:#e8eee2;border-radius:5px;max-width:100%;white-space:normal;overflow-wrap:anywhere}button:disabled{opacity:.5}table{width:100%;min-width:600px;table-layout:fixed}th:first-child{width:40%}th:nth-child(2),th:nth-child(3){width:30%}td,th{padding:12px;border-bottom:1px solid #ddd;max-width:300px;overflow-wrap:anywhere}.table-wrap{overflow:auto}.error{background:#fff0ea;color:#8a342d;padding:10px}.preorder-order-detail{margin-top:24px;padding-top:24px;border-top:1px solid #ddd}.pagination{display:flex;align-items:center;gap:10px}
</style>
