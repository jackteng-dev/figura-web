<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useUserInfoStore } from '@/stores/userInfo'
import { arrivalList, arrivalDetail, receivePreorder, fulfillmentActions, type Supply, type BatchDetail, type ReceiveBody } from '@/api/preorderFulfillment'
import { taipeiTime } from '@/api/preorders'
const user = useUserInfoStore(), has = (code: string) => user.permissions.some(p => p.code === code)
const rows = ref<Supply[]>([]), selected = ref<BatchDetail>(), page = ref(1), total = ref(0), quantity = ref(1), note = ref('')
const busy = ref(false), ready = ref(false), stale = ref(false), error = ref(''), notice = ref(''), pending = ref<{ id: string; body: ReceiveBody }>()
const frozen = computed(() => busy.value || !!pending.value)
async function read() { ready.value = false; const r = await arrivalList(page.value); rows.value = r.items; total.value = r.total; if (selected.value) selected.value = await arrivalDetail(selected.value.supply.batchId); ready.value = true }
async function load() { if (frozen.value) return; busy.value = true; error.value = ''; try { await read() } catch (e: any) { error.value = e.response?.data?.message || '讀取失敗，請重試。' } finally { busy.value = false } }
async function select(id: string) { if (frozen.value || !ready.value || !has('preorders.arrivals.detail')) return; busy.value = true; error.value = ''; try { selected.value = await arrivalDetail(id); stale.value = false } catch (e: any) { ready.value = false; error.value = e.response?.data?.message || '詳情讀取失敗。' } finally { busy.value = false } }
async function receive() {
  if (busy.value) return
  if (!pending.value) { if (!selected.value || !ready.value || stale.value || !has('preorders.arrivals.receive') || !Number.isInteger(quantity.value) || quantity.value < 1 || quantity.value > selected.value.supply.capacity - selected.value.supply.receivedQuantity || !note.value.trim() || !window.confirm('登記本批次實際到貨數量？請先核對收到的商品；不會加入現貨可售庫存。')) return; pending.value = { id: selected.value.supply.batchId, body: { requestId: crypto.randomUUID(), expectedBatchVersion: selected.value.supply.version, quantity: quantity.value, note: note.value.trim() } } }
  busy.value = true; error.value = ''; notice.value = ''
  try { const r = await receivePreorder(pending.value.id, pending.value.body); pending.value = undefined; selected.value = r.current; note.value = ''; notice.value = r.replayed ? '原到貨操作已核對，沒有重複入帳。' : '到貨數量與稽核已保存，可到預購訂單整筆分配。'; try { await read() } catch { ready.value = false; error.value = '到貨已確認，但讀取失敗。請重讀核對，勿重複登記。' } }
  catch (e: any) { const status = e.response?.status; if (status >= 400 && status < 500) { pending.value = undefined; ready.value = false; stale.value = true; error.value = `${e.response?.data?.message || '登記被拒絕'} 請重讀，再明確重新開啟批次。` } else error.value = '到貨結果尚未確認，請重試原操作。數量、原因與操作編號已鎖定。' }
  finally { busy.value = false }
}
onBeforeRouteLeave(() => !pending.value || window.confirm('到貨結果尚未確認。離開會失去原操作，確定離開？'))
onMounted(load)
</script>
<template>
  <section class="preorder-arrivals-admin"><h1>預購到貨</h1><p>登記實際到貨數量，再到預購訂單分配給已付款顧客。預購到貨獨立保存，不加入現貨可售庫存；出貨與送達仍為模擬。</p>
    <p v-if="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p><p v-if="busy" role="status">處理中…</p>
    <button :disabled="frozen" @click="load">重讀到貨資料</button><button v-if="pending" :disabled="busy" @click="receive">重試原到貨操作</button>
    <p v-if="!has('preorders.arrivals.receive')">目前為唯讀，不能登記到貨。</p>
    <div class="table-wrap"><table><thead><tr><th>批次</th><th>到貨／分配／出貨</th><th>操作</th></tr></thead><tbody><tr v-for="s in rows" :key="s.batchId"><td>{{ s.batchName }}<small>{{ s.batchId }}</small></td><td>{{ s.receivedQuantity }}／{{ s.allocatedQuantity }}／{{ s.shippedQuantity }}</td><td><button v-if="has('preorders.arrivals.detail')" :disabled="frozen || !ready" @click="select(s.batchId)">查看到貨 {{ s.batchId }}</button></td></tr></tbody></table></div>
    <div><button :disabled="frozen || !ready || page === 1" @click="page--; load()">上一頁</button>第 {{ page }} 頁<button :disabled="frozen || !ready || page * 20 >= total" @click="page++; load()">下一頁</button></div>
    <section v-if="selected" class="arrival-detail"><h2>到貨詳情</h2><p>{{ selected.supply.batchName }} · {{ selected.supply.batchId }} · 版本 {{ selected.supply.version }}</p><p>供應配額 {{ selected.supply.capacity }}；已到貨 {{ selected.supply.receivedQuantity }}；已分配 {{ selected.supply.allocatedQuantity }}；已出貨 {{ selected.supply.shippedQuantity }}</p><p>待分配 {{ selected.supply.unallocatedQuantity }}；尚在庫 {{ selected.supply.onHandQuantity }}（含已分配待出貨）</p>
      <button v-if="stale" :disabled="frozen || !ready" @click="select(selected.supply.batchId)">重新開啟此批次</button>
      <fieldset v-if="has('preorders.arrivals.receive')" :disabled="frozen || stale || !ready"><label>本次到貨數量<input v-model.number="quantity" aria-label="本次到貨數量" type="number" min="1" :max="selected.supply.capacity - selected.supply.receivedQuantity" step="1"></label><label>到貨登記原因<textarea v-model="note" aria-label="到貨登記原因" maxlength="500" /></label><button :disabled="selected.supply.status === 'DRAFT' || !Number.isInteger(quantity) || quantity < 1 || quantity > selected.supply.capacity - selected.supply.receivedQuantity || !note.trim()" @click="receive">登記預購到貨</button></fieldset>
      <h3>到貨與履約稽核</h3><details v-for="e in selected.events" :key="e.requestId"><summary>{{ fulfillmentActions[e.action] }} · {{ e.quantity }} 件 · {{ taipeiTime(e.createdAt) }}</summary><p>操作 {{ e.requestId }} · {{ e.actorUsername }} · {{ e.orderId || '批次到貨' }}</p><p>到貨 {{ e.receivedBefore }} → {{ e.receivedAfter }}；分配 {{ e.allocatedBefore }} → {{ e.allocatedAfter }}；出貨 {{ e.shippedBefore }} → {{ e.shippedAfter }}</p><p>{{ e.note }}</p></details>
    </section>
  </section>
</template>
<style scoped>
.preorder-arrivals-admin{min-width:0;background:white;padding:24px;border-radius:12px;overflow-wrap:anywhere}h1{font-size:26px}h2{font-size:22px}h3{font-size:18px}p{line-height:1.7}button{padding:10px;margin:6px;border:1px solid #d5d8e1;border-radius:5px;background:#e8eefc;max-width:100%;white-space:normal;overflow-wrap:anywhere}button:disabled{opacity:.5}label,small{display:block}label{margin:14px 0}input,textarea{width:100%;padding:10px;border:1px solid #d5d8e1}fieldset{min-width:0}.table-wrap{overflow:auto}table{width:100%;min-width:600px;table-layout:fixed}th:first-child{width:40%}th:nth-child(2),th:nth-child(3){width:30%}td,th{padding:12px;border-bottom:1px solid #e3e5ec}.arrival-detail{margin-top:24px;border-top:1px solid #e3e5ec;padding-top:24px}[role=alert]{color:#8a1c1c;background:#fdecec;padding:10px}
</style>
