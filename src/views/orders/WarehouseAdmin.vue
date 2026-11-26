<script setup lang="ts">
// 私人倉庫（Commerce V2 Phase 5）：顧客暫存中的出貨單。逾期只標示，不自動出貨或收費（正式政策待核定）。
import { onMounted, ref } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { money } from '@/api/catalog'
import { taipeiTime } from '@/api/preorders'
import { warehouseList, warehouseCommand, shipmentStatus, type Shipment } from '@/api/shipping'
const user = useUserInfoStore()
const has = (code: string) => user.permissions.some(p => p.code === code)
const rows = ref<{ shipment: Shipment; customerId: string; overdue: boolean }[]>([]), total = ref(0), overdueOnly = ref(false)
const loading = ref(false), sending = ref(false), error = ref(''), message = ref(''), note = ref(''), days = ref(14), target = ref<Shipment>()
const pending = ref<{ id: string; action: 'release' | 'extend'; body: { requestId: string; expectedVersion: number; note: string; days?: number } }>()
const failure = (e: any) => e.response?.data?.message || e.message || '暫時無法連線。'
async function load() {
  if (pending.value) return
  loading.value = true; error.value = ''
  try { const r = await warehouseList(1, overdueOnly.value); rows.value = r.items; total.value = r.total } catch (e) { error.value = failure(e) } finally { loading.value = false }
}
async function act(action: 'release' | 'extend') {
  if (!pending.value) {
    const s = target.value; if (!s || !note.value.trim()) return
    pending.value = { id: s.id, action, body: { requestId: crypto.randomUUID(), expectedVersion: s.version, note: note.value.trim(), ...(action === 'extend' ? { days: days.value } : {}) } }
  }
  sending.value = true; error.value = ''
  try {
    const p = pending.value!; const r = await warehouseCommand(p.id, p.action, p.body)
    pending.value = undefined; target.value = undefined; note.value = ''
    message.value = r.replayed ? '操作已核對，沒有重複執行。' : p.action === 'extend' ? '已延長暫存期限。' : '已解除暫存，出貨單可依原流程出貨。'
    await load()
  } catch (e: any) {
    const st = e.response?.status
    if (st && st >= 400 && st < 500) { pending.value = undefined; error.value = failure(e) + (st === 409 ? '；請重讀後再操作。' : '') }
    else error.value = '結果尚未確認，請重試同一操作。'
  } finally { sending.value = false }
}
function pick(s: Shipment) { target.value = s; note.value = '' }
function cancel() { target.value = undefined; pending.value = undefined }
onMounted(load)
</script>
<template>
 <section class="card"><div class="card-body">
  <h1>私人倉庫</h1>
  <p>顧客選擇暫存的出貨單：暫存期間不可出貨。逾期只標示，不會自動出貨、收費或取消；逾期處理請依正式政策（待核定）。</p>
  <p v-if="error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
  <div class="actions"><label><input v-model="overdueOnly" type="checkbox" @change="load"> 只看逾期</label> <button :disabled="loading || !!pending" @click="load">重讀資料</button> <span>共 {{ total }} 張</span></div>
  <div class="table-wrap"><table><thead><tr><th>出貨單</th><th>內容</th><th>暫存期限</th><th>操作</th></tr></thead><tbody>
   <tr v-for="r in rows" :key="r.shipment.id" :class="{ overdue: r.overdue }">
    <td>{{ shipmentStatus[r.shipment.status] }}<br><small>{{ r.shipment.id }}</small><br><small>顧客 {{ r.customerId.slice(0, 8) }}</small></td>
    <td>{{ r.shipment.orders.length }} 張訂單・{{ money(r.shipment.goodsTwd) }}<br><small>{{ r.shipment.orders.map(o => o.title).join('、') }}</small></td>
    <td>{{ taipeiTime(r.shipment.storageUntil || '') }}<strong v-if="r.overdue">（已逾期）</strong></td>
    <td><button :disabled="!!pending" @click="pick(r.shipment)">處理</button></td>
   </tr>
  </tbody></table></div>
  <div v-if="target" class="panel">
   <h2>處理暫存：{{ target.id.slice(0, 8) }}</h2>
   <label for="wh-note">原因（寫入稽核）</label><textarea id="wh-note" v-model="note" maxlength="480" rows="2" />
   <label for="wh-days">延長天數</label><input id="wh-days" v-model.number="days" type="number" min="1" max="180">
   <div class="actions">
    <button :disabled="sending || !note.trim() || !has('warehouse.extend')" @click="act('extend')">延長 {{ days }} 天</button>
    <button :disabled="sending || !note.trim() || !has('warehouse.release')" @click="act('release')">解除暫存</button>
    <button :disabled="sending" @click="cancel">取消</button>
   </div>
   <p v-if="!has('warehouse.extend')">你的帳號只有檢視權限。</p>
  </div>
 </div></section>
</template>
<style scoped>
.actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 10px 0; }
.table-wrap { overflow-x: auto; } table { width: 100%; } td, th { padding: 6px 8px; vertical-align: top; }
.overdue { background: #fff7ed; }
.panel { border: 1px solid #e3e5ec; border-radius: 8px; padding: 12px; margin-top: 12px; display: grid; gap: 6px; max-width: 520px; }
</style>
