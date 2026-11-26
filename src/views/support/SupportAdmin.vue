<script setup lang="ts">
// 客服單（Commerce V2 Phase 6）：回覆顧客、內部備註（顧客看不到）、指派與狀態。
import { onMounted, ref } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { taipeiTime } from '@/api/preorders'
import { ticketQueue, staffTicket, staffReply, ticketChange, CATEGORY_LABELS, TICKET_STATUS, type Ticket, type TicketDetail, type TicketStatus } from '@/api/support'
const user = useUserInfoStore()
const has = (code: string) => user.permissions.some(p => p.code === code)
const rows = ref<Ticket[]>([]), filter = ref<'' | TicketStatus>('WAITING_STAFF'), detail = ref<TicketDetail>()
const text = ref(''), internal = ref(false), status = ref<TicketStatus>('RESOLVED'), note = ref('')
const loading = ref(false), sending = ref(false), error = ref(''), message = ref('')
const pending = ref<{ id: string; kind: 'reply' | 'status' | 'assign'; body: any }>()
const failure = (e: any) => e.response?.data?.message || e.message || '暫時無法連線。'
async function load() {
  loading.value = true; error.value = ''
  try { rows.value = (await ticketQueue(filter.value || undefined)).items } catch (e) { error.value = failure(e) } finally { loading.value = false }
}
async function open(t: Ticket) { if (pending.value) return; detail.value = await staffTicket(t.id); text.value = ''; note.value = '' }
async function act(kind: 'reply' | 'status' | 'assign') {
  const d = detail.value
  if (!pending.value) {
    if (!d) return
    if (kind === 'reply') { if (!text.value.trim()) return; pending.value = { id: d.ticket.id, kind, body: { requestId: crypto.randomUUID(), body: text.value.trim(), internal: internal.value } } }
    else { if (!note.value.trim()) return; pending.value = { id: d.ticket.id, kind, body: { requestId: crypto.randomUUID(), expectedVersion: d.ticket.version, note: note.value.trim(), ...(kind === 'status' ? { status: status.value } : { assigneeId: user.info?.id ?? null }) } } }
  }
  sending.value = true; error.value = ''
  try {
    const p = pending.value!
    const r = p.kind === 'reply' ? await staffReply(p.id, p.body) : await ticketChange(p.id, p.kind, p.body)
    pending.value = undefined; detail.value = r.current; text.value = ''; note.value = ''; internal.value = false
    message.value = r.replayed ? '已核對，沒有重複送出。' : '已更新。'
    await load()
  } catch (e: any) {
    const st = e.response?.status
    if (st && st >= 400 && st < 500) { pending.value = undefined; error.value = failure(e) + (st === 409 ? '；請重新開啟這張客服單。' : '') } else error.value = '結果尚未確認，請再按一次同一個按鈕重試。'
  } finally { sending.value = false }
}
onMounted(load)
</script>
<template>
 <section class="card"><div class="card-body">
  <h1>客服單</h1>
  <p v-if="error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
  <div class="actions"><select v-model="filter" aria-label="狀態篩選" @change="load"><option value="WAITING_STAFF">等待客服回覆</option><option value="WAITING_CUSTOMER">客服已回覆</option><option value="RESOLVED">已解決</option><option value="CLOSED">已結案</option><option value="">全部</option></select><button :disabled="loading" @click="load">重讀資料</button></div>
  <div class="layout">
   <div class="table-wrap"><table><thead><tr><th>主旨</th><th>類型</th><th>狀態</th><th>更新</th></tr></thead><tbody>
    <tr v-for="t in rows" :key="t.id" :class="{ on: detail?.ticket.id === t.id }"><td><button class="link" @click="open(t)">{{ t.subject }}</button><br><small>顧客 {{ t.customerId.slice(0, 8) }}<template v-if="t.assigneeId">・指派 #{{ t.assigneeId }}</template></small></td>
     <td>{{ CATEGORY_LABELS[t.category] }}</td><td>{{ TICKET_STATUS[t.status] }}</td><td>{{ taipeiTime(t.updatedAt) }}</td></tr>
   </tbody></table></div>
   <div v-if="detail" class="thread-panel">
    <h2>{{ detail.ticket.subject }}</h2>
    <p><small>{{ CATEGORY_LABELS[detail.ticket.category] }}・{{ TICKET_STATUS[detail.ticket.status] }}<template v-if="detail.ticket.orderId">・現貨訂單 {{ detail.ticket.orderId }}</template><template v-if="detail.ticket.preorderOrderId">・預購訂單 {{ detail.ticket.preorderOrderId }}</template></small></p>
    <ol class="thread"><li v-for="m in detail.messages" :key="m.id" :class="{ internal: m.internal, staff: m.authorType === 'STAFF' }">
     <small>{{ m.authorType === 'STAFF' ? (m.staffUsername || '員工') : '顧客' }}{{ m.internal ? '・內部備註（顧客看不到）' : '' }}・{{ taipeiTime(m.createdAt) }}</small><p>{{ m.body }}</p></li></ol>
    <template v-if="has('support.reply')">
     <label for="sp-text">回覆內容</label><textarea id="sp-text" v-model="text" rows="4" maxlength="4000" />
     <label><input v-model="internal" type="checkbox"> 內部備註（不給顧客看）</label>
     <button :disabled="sending || !text.trim() || (detail.ticket.status === 'CLOSED' && !internal)" @click="act('reply')">{{ internal ? '新增備註' : '回覆顧客' }}</button>
    </template>
    <label for="sp-note">狀態／指派原因</label><input id="sp-note" v-model="note" maxlength="480">
    <div class="actions">
     <template v-if="has('support.status')"><select v-model="status" aria-label="新狀態"><option v-for="(l, k) in TICKET_STATUS" :key="k" :value="k">{{ l }}</option></select><button :disabled="sending || !note.trim()" @click="act('status')">變更狀態</button></template>
     <button v-if="has('support.assign')" :disabled="sending || !note.trim()" @click="act('assign')">指派給我</button>
    </div>
   </div>
  </div>
 </div></section>
</template>
<style scoped>
.actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
@media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
.table-wrap { overflow-x: auto; } table { width: 100%; } td, th { padding: 6px 8px; vertical-align: top; } tr.on { background: #f1f5ff; }
.link { background: none; border: 0; color: #1d4ed8; text-decoration: underline; padding: 0; cursor: pointer; text-align: left; }
.thread-panel { display: grid; gap: 6px; }
.thread { list-style: none; padding: 0; display: grid; gap: 8px; }
.thread li { border: 1px solid #e3e5ec; border-radius: 8px; padding: 8px 10px; } .thread .staff { background: #f8fafc; } .thread .internal { background: #fef3c7; }
.thread p { margin: 4px 0 0; white-space: pre-wrap; }
</style>
