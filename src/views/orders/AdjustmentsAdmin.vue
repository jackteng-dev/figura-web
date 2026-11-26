<script setup lang="ts">
// 運費調整（Commerce V2 Phase 5）：顧客合併出貨後運費變少的差額。只有審核狀態，「模擬退回」不會移動任何金錢。
import { onMounted, ref } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { money } from '@/api/catalog'
import { taipeiTime } from '@/api/preorders'
import { adjustments, decideAdjustment, type ShippingAdjustment } from '@/api/shipping'
const user = useUserInfoStore()
const canDecide = () => user.permissions.some(p => p.code === 'shipping.adjustments.decide')
const LABEL = { PENDING_REVIEW: '待審核', CREDITED_MOCK: '已模擬退回', DISMISSED: '不處理' } as const
const rows = ref<ShippingAdjustment[]>([]), status = ref('PENDING_REVIEW'), loading = ref(false), sending = ref(false), error = ref(''), message = ref(''), note = ref<Record<string, string>>({})
const pending = ref<{ id: string; body: { requestId: string; expectedVersion: number; decision: 'CREDIT_MOCK' | 'DISMISS'; note: string } }>()
const failure = (e: any) => e.response?.data?.message || e.message || '暫時無法連線。'
async function load() {
  if (pending.value) return
  loading.value = true; error.value = ''
  try { rows.value = (await adjustments(1, status.value || undefined)).items } catch (e) { error.value = failure(e) } finally { loading.value = false }
}
async function decide(a: ShippingAdjustment, decision: 'CREDIT_MOCK' | 'DISMISS') {
  if (!pending.value) { const n = (note.value[a.id] || '').trim(); if (!n) return; pending.value = { id: a.id, body: { requestId: crypto.randomUUID(), expectedVersion: a.version, decision, note: n } } }
  sending.value = true; error.value = ''
  try { const r = await decideAdjustment(pending.value!.id, pending.value!.body); pending.value = undefined; message.value = r.replayed ? '已核對，沒有重複處理。' : '已更新狀態（未移動任何金錢）。'; await load() }
  catch (e: any) { const st = e.response?.status; if (st && st >= 400 && st < 500) { pending.value = undefined; error.value = failure(e) } else error.value = '結果尚未確認，請再按一次同一個按鈕重試。' }
  finally { sending.value = false }
}
onMounted(load)
</script>
<template>
 <section class="card"><div class="card-body">
  <h1>運費調整</h1>
  <p>顧客合併出貨後，新運費低於原本已計入訂單的運費時產生差額。目前沒有真實金流：「模擬退回」只改狀態，不會退款或轉帳；接上金流後才會實際處理。</p>
  <p v-if="error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
  <div class="actions"><select v-model="status" aria-label="狀態" @change="load"><option value="PENDING_REVIEW">待審核</option><option value="CREDITED_MOCK">已模擬退回</option><option value="DISMISSED">不處理</option><option value="">全部</option></select> <button :disabled="loading" @click="load">重讀資料</button></div>
  <div class="table-wrap"><table><thead><tr><th>出貨單</th><th>運費</th><th>差額</th><th>狀態</th><th>處理</th></tr></thead><tbody>
   <tr v-for="a in rows" :key="a.id">
    <td><small>{{ a.shipmentId }}</small><br><small>{{ taipeiTime(a.createdAt) }}</small></td>
    <td>{{ money(a.beforeFeeTwd) }} → {{ money(a.afterFeeTwd) }}</td><td>{{ money(a.creditTwd) }}</td><td>{{ LABEL[a.status] }}</td>
    <td><template v-if="a.status === 'PENDING_REVIEW' && canDecide()">
      <input v-model="note[a.id]" maxlength="480" placeholder="原因" :aria-label="'處理原因 ' + a.id.slice(0, 8)">
      <button :disabled="sending || !(note[a.id] || '').trim()" @click="decide(a, 'CREDIT_MOCK')">模擬退回</button>
      <button :disabled="sending || !(note[a.id] || '').trim()" @click="decide(a, 'DISMISS')">不處理</button>
    </template></td>
   </tr>
  </tbody></table></div>
 </div></section>
</template>
<style scoped>
.actions { display: flex; gap: 10px; align-items: center; margin: 10px 0; }
.table-wrap { overflow-x: auto; } table { width: 100%; } td, th { padding: 6px 8px; vertical-align: top; }
</style>
