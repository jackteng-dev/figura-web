<script setup lang="ts">
// 出貨單（Phase 5）：合併／分開寄的包裹，整張出貨單一起出貨與送達。測試物流，不會實際寄送。
import { onMounted, ref } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { money } from '@/api/catalog'
import { taipeiTime } from '@/api/preorders'
import { shipments, shipmentDetail, shipmentCommand, shipmentStatus, waitingText, type Shipment, type ShipmentDetail, type ShipmentCommand } from '@/api/shipping'

const user = useUserInfoStore()
const has = (code: string) => user.permissions.some(p => p.code === code)
const rows = ref<Shipment[]>([]), total = ref(0), page = ref(1), selected = ref<ShipmentDetail>(), note = ref('')
const loading = ref(false), sending = ref(false), error = ref(''), message = ref(''), stale = ref(false)
// 結果未確認時凍結並以同一 requestId／內容重試
const pending = ref<{ id: string; action: 'ship' | 'deliver'; body: ShipmentCommand }>()
function failure(e: any) { return e.response?.data?.message || e.message || '暫時無法連線。' }
async function load() {
  if (sending.value || pending.value) return
  loading.value = true; error.value = ''
  try {
    const list = await shipments(page.value); rows.value = list.items; total.value = list.total
    if (selected.value) selected.value = await shipmentDetail(selected.value.shipment.id)
    stale.value = false
  } catch (e) { error.value = failure(e) } finally { loading.value = false }
}
async function inspect(s: Shipment) {
  if (loading.value || sending.value || pending.value) return
  loading.value = true; error.value = ''; message.value = ''; note.value = ''
  try { selected.value = await shipmentDetail(s.id); stale.value = false } catch (e) { error.value = failure(e) } finally { loading.value = false }
}
async function act(action: 'ship' | 'deliver') {
  const d = selected.value
  if (!pending.value) {
    if (!d || stale.value || !note.value.trim() || !has(action === 'ship' ? 'shipments.ship.mock' : 'shipments.deliver.mock')) return
    pending.value = { id: d.shipment.id, action, body: { requestId: crypto.randomUUID(), expectedVersion: d.shipment.version, note: note.value.trim() } }
  }
  sending.value = true; error.value = ''
  let done = false
  try {
    const p = pending.value!
    const r = await shipmentCommand(p.id, p.action, p.body)
    pending.value = undefined; done = true; selected.value = r.current; note.value = ''
    message.value = r.replayed ? '操作已核對，沒有重複出貨。' : p.action === 'ship' ? `已整張出貨，測試貨件號 ${r.event.trackingNumber}（測試物流）。` : '已標記整張送達（測試物流）。'
  } catch (e: any) {
    const status = e.response?.status
    if (status && status >= 400 && status < 500) { pending.value = undefined; stale.value = status === 409; error.value = failure(e) + (stale.value ? '；請重讀後再操作。' : '') }
    else error.value = '結果尚未確認。畫面暫時凍結，請重試同一操作。'
  } finally { sending.value = false }
  if (done) await load()
}
onMounted(load)
</script>

<template>
 <section class="shipments card"><div class="card-body">
  <h1>出貨單</h1>
  <p>一張出貨單＝一個包裹。結帳選「一起寄」的訂單在同一張出貨單，必須全部可出貨（已付款、預購已到貨並付清尾款、無待核對）才整張出貨；「分開寄」每張訂單各一張。物流為測試 adapter，不會實際寄送。</p>
  <p v-if="error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p><p v-if="loading" role="status">載入中…</p>
  <div class="actions"><button :disabled="loading || sending || !!pending" @click="load">重讀資料</button></div>
  <div class="table-wrap"><table><thead><tr><th>出貨單</th><th>配送</th><th>狀態</th><th>操作</th></tr></thead><tbody>
   <tr v-for="s in rows" :key="s.id"><td>{{ s.orders.length }} 張訂單 · {{ s.strategy === 'COMBINED' ? '一起寄' : '分開寄' }}<br><small>{{ s.id }}</small></td>
    <td>{{ s.methodName }} · {{ money(s.feeTwd) }}<br><small>{{ s.destination.type === 'CVS' ? s.destination.storeName + '（測試門市）' : (s.destination.city || '') + (s.destination.district || '') }}</small></td>
    <td>{{ shipmentStatus[s.status] }}<template v-if="s.waitingFor"><br><small>{{ waitingText[s.waitingFor] }}</small></template></td>
    <td><button v-if="has('shipments.detail')" :disabled="loading || sending || !!pending" @click="inspect(s)">查看 {{ s.id.slice(0, 8) }}</button></td></tr>
  </tbody></table></div>
  <p v-if="!loading && !rows.length">目前沒有出貨單（新的結帳才會建立）。</p>
  <div class="actions"><button :disabled="page === 1 || loading || !!pending" @click="page--; load()">上一頁</button><span>第 {{ page }} 頁 · 共 {{ total }} 張</span><button :disabled="page * 20 >= total || loading || !!pending" @click="page++; load()">下一頁</button></div>

  <section v-if="selected" class="detail" data-testid="shipment-detail">
   <h2>出貨單 {{ selected.shipment.id.slice(0, 8) }}</h2>
   <p>{{ selected.shipment.methodName }} · {{ selected.shipment.strategy === 'COMBINED' ? '一起寄' : '分開寄' }} · 運費 {{ money(selected.shipment.feeTwd) }} · 商品 {{ money(selected.shipment.goodsTwd) }}</p>
   <p>狀態：{{ shipmentStatus[selected.shipment.status] }}<template v-if="selected.shipment.waitingFor">（{{ waitingText[selected.shipment.waitingFor] }}）</template> · 版本 {{ selected.shipment.version }}</p>
   <p v-if="selected.shipment.destination.type === 'CVS'">取貨：{{ selected.shipment.destination.storeBrand }} {{ selected.shipment.destination.storeName }}（{{ selected.shipment.destination.storeId }}，測試門市）</p>
   <p v-else>寄送：{{ selected.shipment.destination.postalCode }} {{ selected.shipment.destination.city }}{{ selected.shipment.destination.district }}{{ selected.shipment.destination.street }}</p>
   <p>收件人：{{ selected.shipment.destination.recipientName }} · {{ selected.shipment.destination.phone }}</p>
   <ul><li v-for="o in selected.shipment.orders" :key="o.id">{{ o.kind === 'PREORDER' ? '預購' : '現貨' }} · {{ o.title }} · {{ o.status }} / {{ o.fulfillmentStatus }} <small>{{ o.id }}</small></li></ul>
   <p v-if="selected.shipment.trackingNumber">測試貨件號：{{ selected.shipment.trackingNumber }}</p>
   <p v-if="!selected.mockEnabled">此環境未啟用模擬配送。</p>
   <form v-if="(selected.canShip && has('shipments.ship.mock')) || (selected.canDeliver && has('shipments.deliver.mock')) || pending" @submit.prevent>
    <label>操作原因<textarea v-model="note" required maxlength="500" :disabled="sending || !!pending || stale" /></label>
    <button v-if="selected.canShip && has('shipments.ship.mock') && !pending" type="button" :disabled="sending || stale || !note.trim()" data-testid="shipment-ship" @click="act('ship')">整張出貨（測試物流）</button>
    <button v-if="selected.canDeliver && has('shipments.deliver.mock') && !pending" type="button" :disabled="sending || stale || !note.trim()" @click="act('deliver')">整張標記送達</button>
    <button v-if="pending" type="button" :disabled="sending" @click="act(pending.action)">重試同一操作</button>
   </form>
   <h3>出貨紀錄</h3>
   <p v-if="!selected.events.length">尚無整張出貨紀錄。</p>
   <details v-for="e in selected.events" :key="e.requestId"><summary>{{ taipeiTime(e.createdAt) }} · {{ e.action === 'SHIP' ? '出貨' : '送達' }} · {{ e.actorUsername }}</summary><p>操作 ID：{{ e.requestId }}</p><p>原因：{{ e.note }}</p><p>貨件號：{{ e.trackingNumber }}</p></details>
  </section>
 </div></section>
</template>

<style scoped>
.shipments{overflow-wrap:anywhere;min-width:0;max-width:1200px}.shipments h1{font-size:1.6rem}.shipments h2{font-size:1.15rem}.actions{display:flex;gap:.7rem;flex-wrap:wrap;align-items:center;margin:1rem 0}.shipments button{max-width:100%;white-space:normal;padding:.5rem .75rem;margin-right:.5rem;border:1px solid #1b1f3b;border-radius:5px;background:white;color:#1b1f3b}.shipments button:disabled{opacity:.5}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e3e5ec;padding:.6rem;text-align:left;vertical-align:top}.detail,form{border:1px solid #d5d8e1;padding:1rem;margin:1rem 0}label{display:block;margin:.8rem 0}textarea{display:block;width:100%;max-width:38rem;padding:.6rem;border:1px solid #d5d8e1;border-radius:4px}[role=alert]{color:#8a1c1c}details{border-bottom:1px solid #e3e5ec;padding:.6rem 0}
</style>
