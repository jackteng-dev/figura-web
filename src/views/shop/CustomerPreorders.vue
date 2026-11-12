<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { preorderOrders, cancelPreorder, preorderStatus, type PreorderOrder, type PreorderCancel } from '@/api/preorderOrders'
import { CustomerApiError } from '@/api/customer'
import { taipeiTime } from '@/api/preorders'
import { money } from '@/api/catalog'
import PreorderPaymentPanel from './PreorderPaymentPanel.vue'
const rows = ref<PreorderOrder[]>([]), page = ref(1), total = ref(0), busy = ref(false), ready = ref(false), error = ref(''), success = ref('')
const paymentFrozen = ref(new Set<string>())
function freeze(id: string, value: boolean) { if (value) paymentFrozen.value.add(id); else paymentFrozen.value.delete(id) }
function blockPayment(id: string) { return busy.value || !!pending.value || [...paymentFrozen.value].some(v => v !== id) }
function changed(order: PreorderOrder) { const index = rows.value.findIndex(o => o.id === order.id); if (index >= 0) rows.value[index] = order }
const pending = ref<{ id: string; body: PreorderCancel }>()
async function read() { ready.value = false; const result = await preorderOrders(page.value); rows.value = result.items; total.value = result.total; ready.value = true }
async function load() { if (busy.value || pending.value || paymentFrozen.value.size) return; busy.value = true; error.value = ''; try { await read() } catch (e: any) { error.value = e.message || '讀取失敗，請重新載入。' } finally { busy.value = false } }
async function cancel(order?: PreorderOrder) {
  if (busy.value || paymentFrozen.value.size) return
  if (!pending.value) { if (!ready.value || !order || order.status !== 'PENDING' || !window.confirm('取消此筆預購並釋放批次配額？')) return; pending.value = { id: order.id, body: { requestId: crypto.randomUUID(), expectedVersion: order.version } } }
  busy.value = true; error.value = ''; success.value = ''
  try {
    const result = await cancelPreorder(pending.value.id, pending.value.body); pending.value = undefined
    success.value = result.order.status === 'EXPIRED' ? '保留已逾時，配額已釋放。' : '預購已取消，配額已釋放。'
    try { await read() } catch { ready.value = false; error.value = '取消已確認，但列表讀取失敗。請重新載入核對。' }
  } catch (e: any) {
    if (e instanceof CustomerApiError && e.status >= 400 && e.status < 500) { pending.value = undefined; ready.value = false; error.value = `${e.message} 請重新載入核對。` }
    else error.value = '尚未確認取消結果，請重試原操作。其他寫入已暫時鎖定。'
  } finally { busy.value = false }
}
onBeforeRouteLeave(() => !pending.value || window.confirm('取消結果尚未確認。離開會失去原操作，確定離開？'))
onMounted(load)
</script>
<template>
  <section class="my-preorders"><h1>我的預購</h1><p>預購付款與退款為模擬，不會實際收款或轉帳。未付款的保留逾時會釋放配額；批次截單不會直接取消既有訂單。</p>
    <p v-if="error" role="alert" class="shop-error">{{ error }}</p><p v-if="success" role="status" class="shop-success">{{ success }}</p><p v-if="busy" role="status">處理中…</p>
    <button class="shop-button" :disabled="busy || !!pending || paymentFrozen.size > 0" @click="load">重新載入</button><button v-if="pending" class="shop-button" :disabled="busy" @click="cancel()">重試原取消操作</button>
    <article v-for="o in rows" :key="o.id" :data-order-id="o.id"><h2>{{ o.batchName }}</h2><p>{{ preorderStatus[o.status] }} · 訂單 {{ o.id }}</p><p>{{ o.productTitle }} · {{ o.skuLabel }} × {{ o.quantity }}</p><p>單價 {{ money(o.unitPriceTwd) }} · 展示運費 {{ money(o.shippingTwd) }} · 總額 {{ money(o.totalTwd) }}</p><p>保留期限（台北）：{{ taipeiTime(o.expiresAt) }}</p><p>預計到貨：{{ o.arrivalFrom }} ～ {{ o.arrivalTo }}（預估）</p><p>收件人：{{ o.shipping.recipientName }} · {{ o.shipping.phone }}</p><p>{{ o.shipping.postalCode }} {{ o.shipping.city }}{{ o.shipping.district }}{{ o.shipping.street }}</p><button v-if="o.status === 'PENDING'" class="shop-button" :disabled="busy || !!pending || paymentFrozen.size > 0 || !ready" @click="cancel(o)">取消預購</button><p v-if="o.fulfillment.allocatedQuantity">已分配到貨：{{ o.fulfillment.allocatedQuantity }} 件 · {{ { UNFULFILLED: '等待出貨', SHIPPED: '已模擬出貨', DELIVERED: '已模擬送達' }[o.fulfillmentStatus] || o.fulfillmentStatus }}</p><p v-if="o.fulfillment.trackingNumber">模擬貨件：{{ o.fulfillment.trackingNumber }}；沒有實際物流寄送。</p><p v-if="o.fulfillment.shippedAt">模擬出貨：{{ taipeiTime(o.fulfillment.shippedAt) }}</p><p v-if="o.fulfillment.deliveredAt">模擬送達：{{ taipeiTime(o.fulfillment.deliveredAt) }}</p>
        <PreorderPaymentPanel :order="o" :disabled="blockPayment(o.id)" @changed="changed" @frozen="freeze(o.id, $event)" /></article>
    <p v-if="ready && !rows.length">目前沒有預購訂單。<router-link to="/shop/preorders">查看預購批次</router-link></p>
    <div class="pagination"><button class="shop-button" :disabled="busy || !!pending || paymentFrozen.size > 0 || !ready || page === 1" @click="page--; load()">上一頁</button><span>第 {{ page }} 頁</span><button class="shop-button" :disabled="busy || !!pending || paymentFrozen.size > 0 || !ready || page * 10 >= total" @click="page++; load()">下一頁</button></div>
  </section>
</template>
<style scoped>
.my-preorders{min-width:0;overflow-wrap:anywhere}article{padding:24px;margin:24px 0;background:#ffffff;border:1px solid #e3e5ec;border-radius:12px}h2{font-size:22px}button{max-width:100%;white-space:normal}.pagination{display:flex;align-items:center;gap:12px}
</style>
