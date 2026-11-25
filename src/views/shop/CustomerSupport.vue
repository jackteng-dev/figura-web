<script setup lang="ts">
// 客服中心（Commerce V2 Phase 6）：本人的客服單。未知回應以同一 requestId 重送，不會重複建立。
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CustomerApiError } from '@/api/customer'
import { getOrderCenter, type OrderCenterItem } from '@/api/orderCenter'
import { myTickets, myTicket, createTicket, replyTicket, CATEGORY_LABELS, TICKET_STATUS, type Ticket, type TicketDetail } from '@/api/support'
const route = useRoute(), router = useRouter()
const tickets = ref<Ticket[]>([]), detail = ref<TicketDetail>(), orders = ref<OrderCenterItem[]>([])
const loading = ref(false), busy = ref(false), error = ref(''), message = ref('')
const form = ref({ category: 'ORDER', subject: '', body: '', order: '' }), reply = ref('')
const pending = ref<{ kind: 'create' | 'reply'; id?: string; body: any }>()
const openId = computed(() => typeof route.query.id === 'string' ? route.query.id : '')
const fail = (e: unknown) => e instanceof Error ? e.message : '操作失敗，請稍後再試'
async function loadList() {
  loading.value = true; error.value = ''
  try { tickets.value = (await myTickets()).items } catch (e) { error.value = fail(e) } finally { loading.value = false }
}
async function loadDetail(id: string) {
  if (!id) { detail.value = undefined; return }
  loading.value = true; error.value = ''
  try { detail.value = await myTicket(id) } catch (e) { error.value = fail(e); detail.value = undefined } finally { loading.value = false }
}
watch(openId, id => { reply.value = ''; void loadDetail(id) }, { immediate: true })
onMounted(async () => {
  await loadList()
  try { orders.value = (await getOrderCenter({ kind: 'ALL', stage: 'ALL', sort: 'NEWEST', page: 1, pageSize: 50 })).items } catch { /* 沒有訂單資料仍可建立客服單 */ }
  if (typeof route.query.orderId === 'string') form.value.order = 'STOCK:' + route.query.orderId
})
async function send(kind: 'create' | 'reply') {
  if (!pending.value) {
    if (kind === 'create') {
      const f = form.value; if (!f.subject.trim() || !f.body.trim()) return
      const [k, oid] = f.order ? f.order.split(':') : ['', '']
      pending.value = { kind, body: { requestId: crypto.randomUUID(), category: f.category, subject: f.subject.trim(), body: f.body.trim(), ...(k === 'STOCK' ? { orderId: oid } : k === 'PREORDER' ? { preorderOrderId: oid } : {}) } }
    } else {
      if (!detail.value || !reply.value.trim()) return
      pending.value = { kind, id: detail.value.ticket.id, body: { requestId: crypto.randomUUID(), body: reply.value.trim() } }
    }
  }
  busy.value = true; error.value = ''; message.value = ''
  try {
    const p = pending.value!
    if (p.kind === 'create') {
      const r = await createTicket(p.body); pending.value = undefined
      form.value = { category: 'ORDER', subject: '', body: '', order: '' }; message.value = '客服單已送出，客服回覆後會顯示在這裡。'
      await loadList(); await router.replace({ query: { id: r.current.ticket.id } })
    } else {
      const r = await replyTicket(p.id!, p.body); pending.value = undefined; reply.value = ''; detail.value = r.current; await loadList()
    }
  } catch (e) {
    if (e instanceof CustomerApiError && e.status >= 400 && e.status < 500) { pending.value = undefined; error.value = e.message }
    else error.value = '結果尚未確認，請按「重試」以同一個內容再送一次（不會重複建立）。'
  } finally { busy.value = false }
}
const time = (v: string) => new Date(v).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>
<template>
  <section class="shop-panel">
    <h1>客服中心</h1>
    <p class="muted">訂單、預購、配送、退換貨或帳號問題都可以在這裡詢問。回覆會顯示在客服單裡。政策說明請看 <router-link to="/shop/pages">政策與說明</router-link>。</p>
    <p v-if="error" class="shop-error" role="alert">{{ error }} <button v-if="pending" type="button" class="shop-button" :disabled="busy" @click="send(pending.kind)">重試</button></p>
    <p v-if="message" class="shop-success" role="status">{{ message }}</p>

    <template v-if="detail">
      <p><router-link :to="{ query: {} }">← 回到客服單清單</router-link></p>
      <h2>{{ detail.ticket.subject }}</h2>
      <p class="meta">{{ CATEGORY_LABELS[detail.ticket.category] }}・{{ TICKET_STATUS[detail.ticket.status] }}<template v-if="detail.ticket.orderId || detail.ticket.preorderOrderId">・關聯訂單 {{ (detail.ticket.orderId || detail.ticket.preorderOrderId || '').slice(0, 8).toUpperCase() }}</template></p>
      <ol class="thread">
        <li v-for="m in detail.messages" :key="m.id" :class="m.authorType === 'STAFF' ? 'staff' : 'me'">
          <span class="who">{{ m.authorType === 'STAFF' ? '客服' + (m.staffUsername ? '（' + m.staffUsername + '）' : '') : '我' }}・<time :datetime="m.createdAt">{{ time(m.createdAt) }}</time></span>
          <p>{{ m.body }}</p>
        </li>
      </ol>
      <form v-if="detail.ticket.status !== 'CLOSED'" @submit.prevent="send('reply')">
        <label for="reply">補充說明</label><textarea id="reply" v-model="reply" rows="3" maxlength="4000" :disabled="!!pending" />
        <button class="shop-button" :disabled="busy || !reply.trim() || !!pending">送出</button>
      </form>
      <p v-else class="muted">這張客服單已結案；如有新問題請建立新的客服單。</p>
    </template>

    <template v-else>
      <h2>我的客服單</h2>
      <p v-if="loading && !tickets.length" role="status">載入中…</p>
      <p v-else-if="!tickets.length" class="muted">還沒有客服單。</p>
      <ul v-else class="tickets">
        <li v-for="t in tickets" :key="t.id"><router-link :to="{ query: { id: t.id } }">{{ t.subject }}</router-link><span>{{ CATEGORY_LABELS[t.category] }}・{{ TICKET_STATUS[t.status] }}・{{ time(t.updatedAt) }}</span></li>
      </ul>
      <h2>建立客服單</h2>
      <form class="new" @submit.prevent="send('create')">
        <label for="t-cat">問題類型</label>
        <select id="t-cat" v-model="form.category" :disabled="!!pending"><option v-for="(l, k) in CATEGORY_LABELS" :key="k" :value="k">{{ l }}</option></select>
        <label for="t-order">關聯訂單（選填）</label>
        <select id="t-order" v-model="form.order" :disabled="!!pending"><option value="">不指定</option><option v-for="o in orders" :key="o.kind + o.id" :value="o.kind + ':' + o.id">{{ o.kind === 'PREORDER' ? '預購' : '現貨' }}・{{ o.title || '訂單' }}・{{ o.id.slice(0, 8).toUpperCase() }}</option></select>
        <label for="t-subject">主旨</label><input id="t-subject" v-model="form.subject" maxlength="120" :disabled="!!pending" required>
        <label for="t-body">內容</label><textarea id="t-body" v-model="form.body" rows="5" maxlength="4000" :disabled="!!pending" required />
        <button class="shop-button" :disabled="busy || !!pending || !form.subject.trim() || !form.body.trim()">送出客服單</button>
      </form>
    </template>
  </section>
</template>
<style scoped>
.muted { color: #4b5060; font-size: 14px; } .meta { color: #4b5060; font-size: 14px; }
.tickets { list-style: none; padding: 0; display: grid; gap: 8px; }
.tickets li { display: flex; flex-direction: column; gap: 2px; background: #fff; border: 1px solid #e3e5ec; border-radius: 10px; padding: 10px 14px; }
.tickets span { font-size: 13px; color: #4b5060; }
.thread { list-style: none; padding: 0; display: grid; gap: 10px; margin: 12px 0; }
.thread li { border-radius: 12px; padding: 10px 14px; max-width: 85%; }
.thread .me { background: #eef2ff; justify-self: end; } .thread .staff { background: #fff; border: 1px solid #e3e5ec; }
.thread p { margin: 4px 0 0; white-space: pre-wrap; } .who { font-size: 12px; color: #4b5060; }
.new { display: grid; gap: 6px; max-width: 560px; }
</style>
