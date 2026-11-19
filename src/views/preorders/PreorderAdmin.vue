<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { adminProducts, type AdminProduct } from '@/api/catalog'
import { batchList, batchDetail, batchSave, batchCommand, batchSchedule, batchBalanceCall, taipeiTime, termsText, type Batch, type BatchEvent, type BatchWrite, type BatchCommand, type ScheduleEvent, type ScheduleWrite, type BalanceCallWrite, type PaymentMode } from '@/api/preorders'

const user = useUserInfoStore()
const has = (code: string) => user.permissions.some(p => p.code === code)
const rows = ref<Batch[]>([]), products = ref<AdminProduct[]>([]), events = ref<BatchEvent[]>([]), schedules = ref<ScheduleEvent[]>([]), selected = ref<Batch>()
const scheduleForm = reactive({ arrivalFrom: '', arrivalTo: '', publicReason: '', note: '' }), balanceForm = reactive({ publicReason: '商品已到貨，請於期限內支付尾款', note: '' })
const scheduleActions = { DELAY: '延期', ADJUST: '調整到貨', BALANCE_CALL: '通知尾款' }
const page = ref(1), total = ref(0), loading = ref(false), sending = ref(false), ready = ref(false), stale = ref(false)
const editing = ref(false), editId = ref<string>(), error = ref(''), message = ref(''), commandNote = ref('')
const form = reactive({ productId: '', skuId: '', name: '', description: '', priceTwd: 1280, capacity: 100, deadlineAt: '', arrivalFrom: '', arrivalTo: '', expectedVersion: 0, note: '', paymentMode: 'FULL' as PaymentMode, depositTwd: 0, balanceDays: 7 })
const pending = ref<{ action: 'SAVE'; id?: string; body: BatchWrite } | { action: 'OPEN' | 'CLOSE'; id: string; body: BatchCommand } | { action: 'SCHEDULE'; id: string; body: ScheduleWrite } | { action: 'BALANCE'; id: string; body: BalanceCallWrite }>()
const locked = computed(() => sending.value || !!pending.value)
const selectedProduct = computed(() => products.value.find(p => p.id === form.productId))
const states = { DRAFT: '草稿', OPEN: '已開放', CLOSED: '已截單' }
function failure(e: any) { return e.response?.data?.message || e.message || '暫時無法連線。' }
async function loadProducts() {
  const all: AdminProduct[] = []
  for (let p = 1; p <= 100; p++) {
    const result = await adminProducts(p); all.push(...result.items)
    if (all.length >= result.total) { products.value = all.filter(x => x.status !== 'ARCHIVED'); return }
  }
  throw Error('商品數量超出選單範圍，請先縮小商品目錄。')
}
async function load() {
  if (sending.value) return
  loading.value = true; ready.value = false; error.value = ''
  try {
    const list = await batchList(page.value); rows.value = list.items; total.value = list.total
    if (has('catalog.read.list') && (has('preorders.create') || has('preorders.update'))) await loadProducts()
    else products.value = []
    if (selected.value) { const detail = await batchDetail(selected.value.id); selected.value = detail.batch; events.value = detail.events; schedules.value = detail.schedules || [] }
    ready.value = true
  } catch (e) { error.value = failure(e) }
  finally { loading.value = false }
}
async function inspect(row: Batch) {
  if (!ready.value || locked.value) return
  loading.value = true; error.value = ''; editing.value = false; stale.value = false; commandNote.value = ''
  try { const detail = await batchDetail(row.id); selected.value = detail.batch; events.value = detail.events; schedules.value = detail.schedules || []; Object.assign(scheduleForm, { arrivalFrom: detail.batch.arrivalFrom, arrivalTo: detail.batch.arrivalTo, publicReason: '', note: '' }) }
  catch (e) { error.value = failure(e); ready.value = false }
  finally { loading.value = false }
}
function begin(row?: Batch) {
  if (!ready.value || locked.value || !(row ? has('preorders.update') : has('preorders.create'))) return
  editId.value = row?.id; stale.value = false; error.value = ''; message.value = ''; editing.value = true
  Object.assign(form, row ? {
    productId: row.productId, skuId: row.skuId, name: row.name, description: row.description,
    priceTwd: row.priceTwd, capacity: row.capacity, deadlineAt: row.deadlineAt.slice(0, 19),
    arrivalFrom: row.arrivalFrom, arrivalTo: row.arrivalTo, expectedVersion: row.version, note: '',
    paymentMode: row.paymentMode || 'FULL', depositTwd: row.depositTwd || 0, balanceDays: row.balanceDays || 7
  } : { productId: '', skuId: '', name: '', description: '', priceTwd: 1280, capacity: 100, deadlineAt: '', arrivalFrom: '', arrivalTo: '', expectedVersion: 0, note: '', paymentMode: 'FULL' as PaymentMode, depositTwd: 0, balanceDays: 7 })
}
async function save() {
  if (!pending.value) {
    if (!ready.value || stale.value || !(editId.value ? has('preorders.update') : has('preorders.create'))) return
    // 全額批次不送訂金欄位（伺服器拒絕全額＋訂金的組合）
    const { paymentMode, depositTwd, balanceDays, ...base } = form
    const terms = paymentMode === 'DEPOSIT' ? { paymentMode, depositTwd, balanceDays } : { paymentMode }
    pending.value = { action: 'SAVE', id: editId.value, body: { ...base, ...terms, name: form.name.trim(), description: form.description.trim(), note: form.note.trim(), deadlineAt: form.deadlineAt + (form.deadlineAt.length === 16 ? ':00' : '') + '+08:00', requestId: crypto.randomUUID() } }
  }
  await send()
}
async function command(action: 'OPEN' | 'CLOSE') {
  if (!selected.value || !ready.value || stale.value || locked.value || !has('preorders.' + action.toLowerCase())) return
  pending.value = { action, id: selected.value.id, body: { expectedVersion: selected.value.version, requestId: crypto.randomUUID(), note: commandNote.value.trim() } }
  await send()
}
async function schedule() {
  const b = selected.value
  if (!b || !ready.value || stale.value || locked.value || !has('preorders.schedule')) return
  pending.value = { action: 'SCHEDULE', id: b.id, body: { expectedVersion: b.version, requestId: crypto.randomUUID(), arrivalFrom: scheduleForm.arrivalFrom, arrivalTo: scheduleForm.arrivalTo, publicReason: scheduleForm.publicReason.trim(), note: scheduleForm.note.trim() } }
  await send()
}
async function balanceCall() {
  const b = selected.value
  if (!b || !ready.value || stale.value || locked.value || !has('preorders.balance.call')) return
  pending.value = { action: 'BALANCE', id: b.id, body: { expectedVersion: b.version, requestId: crypto.randomUUID(), publicReason: balanceForm.publicReason.trim(), note: balanceForm.note.trim() } }
  await send()
}
async function send() {
  if (!pending.value || sending.value) return
  sending.value = true; error.value = ''
  let acknowledged = false
  try {
    const p = pending.value
    const result = p.action === 'SAVE' ? await batchSave(p.id, p.body) : p.action === 'SCHEDULE' ? await batchSchedule(p.id, p.body) : p.action === 'BALANCE' ? await batchBalanceCall(p.id, p.body) : await batchCommand(p.id, p.action, p.body)
    pending.value = undefined; acknowledged = true; editing.value = false; selected.value = result.current
    const affected = 'affectedOrders' in result.event ? `，影響 ${result.event.affectedOrders} 張訂單並已排入通知` : ''
    message.value = result.replayed ? '操作已核對，沒有重複保存。' : `預購批次已保存並記錄稽核${affected}。`
    if (p.action === 'SCHEDULE') Object.assign(scheduleForm, { publicReason: '', note: '' })
    if (p.action === 'BALANCE') balanceForm.note = ''
    commandNote.value = ''
  } catch (e: any) {
    const status = e.response?.status
    if (status && status >= 400 && status < 500) {
      pending.value = undefined; stale.value = status === 409; if (stale.value) ready.value = false
      error.value = failure(e) + (stale.value ? '；保留未送內容，請重讀後重新開啟詳情或編輯。' : '')
    } else error.value = '結果尚未確認。表單暫時凍結，請重試同一操作；重整後先核對稽核。'
  } finally { sending.value = false }
  if (acknowledged) await load()
}
function pretty(value: string | null) { if (!value) return '—'; try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value } }
onMounted(load)
</script>

<template>
  <section class="preorder-admin card"><div class="card-body">
    <h1>預購批次管理</h1>
    <p>一批次對應一款 SKU，配額與現貨庫存分開。開放後固定價格、配額與到貨區間；截單後不可重新開放。顧客可下單保留獨立配額，預購付款僅提供模擬，不會實際收款。</p>
    <p v-if="!has('preorders.create') && !has('preorders.update')">目前為唯讀，不能新增或編輯批次。</p>
    <p v-if="error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p><p v-if="loading" role="status">載入中…</p>
    <div class="actions"><button :disabled="loading || sending" @click="load">重讀資料</button><button v-if="has('preorders.create')" :disabled="!ready || locked" @click="begin()">新增預購批次</button></div>
    <p v-if="pending">待核對操作：{{ pending.body.requestId }}</p><button v-if="pending" :disabled="sending" @click="send">重試同一操作</button>
    <form v-if="editing" @submit.prevent="save">
      <h2>{{ editId ? '編輯草稿' : '新增預購批次' }}</h2>
      <fieldset :disabled="locked || stale">
        <label>批次商品<select aria-label="批次商品" v-model="form.productId" required :disabled="!!editId" @change="form.skuId = ''"><option value="">請選擇商品</option><option v-for="p in products" :key="p.id" :value="p.id">{{ p.title }} · {{ p.status === 'PUBLISHED' ? '已上架' : '草稿' }}</option></select></label>
        <label>批次款式<select aria-label="批次款式" v-model="form.skuId" required :disabled="!!editId"><option value="">請選擇 SKU</option><option v-for="s in selectedProduct?.skus" :key="s.id" :value="s.id" :disabled="!s.enabled">{{ s.label }} · {{ s.code }}{{ s.enabled ? '' : '（停用）' }}</option></select></label>
        <label>批次名稱<input v-model="form.name" required maxlength="120"></label>
        <label>批次說明<textarea v-model="form.description" maxlength="2000" /></label>
        <div class="columns"><label>預購單價（TWD）<input v-model.number="form.priceTwd" type="number" min="1" max="99999999" step="1" required></label><label>供應配額<input v-model.number="form.capacity" type="number" min="1" max="100000" step="1" required></label></div>
        <label>付款條件<select aria-label="付款條件" v-model="form.paymentMode"><option value="FULL">下單付清全額</option><option value="DEPOSIT">先付訂金，到貨後付尾款</option></select></label>
        <div v-if="form.paymentMode === 'DEPOSIT'" class="columns"><label>每件訂金（TWD，需小於單價）<input v-model.number="form.depositTwd" type="number" min="1" :max="form.priceTwd - 1" step="1" required></label><label>到貨通知後尾款期限（天）<input v-model.number="form.balanceDays" type="number" min="1" max="60" step="1" required></label></div>
        <label>截止時間（台北時間）<input v-model="form.deadlineAt" type="datetime-local" step="1" required></label>
        <div class="columns"><label>預計到貨起日<input v-model="form.arrivalFrom" type="date" required></label><label>預計到貨迄日<input v-model="form.arrivalTo" type="date" required></label></div>
        <label>異動原因<textarea v-model="form.note" required maxlength="500" /></label>
      </fieldset>
      <button type="submit" :disabled="locked || stale || !ready">保存批次草稿</button><button type="button" :disabled="locked" @click="editing = false">關閉編輯</button>
    </form>
    <div class="batch-list"><article v-for="b in rows" :key="b.id"><h2>{{ b.name }}</h2><p>{{ b.productTitle }} · {{ b.skuLabel }}</p><p>{{ states[b.status] }} · NT$ {{ b.priceTwd.toLocaleString() }} · 配額 {{ b.capacity }} · 版本 {{ b.version }}</p><p>{{ termsText(b) }}</p><p>截止：{{ taipeiTime(b.deadlineAt) }}（台北）</p><button v-if="has('preorders.detail')" :disabled="!ready || locked || loading" @click="inspect(b)">查看 {{ b.name }}</button></article><p v-if="ready && !rows.length">尚無預購批次。</p></div>
    <div class="actions"><button :disabled="page === 1 || loading || locked" @click="page--; load()">上一頁</button><span>第 {{ page }} 頁 · 共 {{ total }} 筆</span><button :disabled="page * 20 >= total || loading || locked" @click="page++; load()">下一頁</button></div>
    <section v-if="selected" class="batch-detail"><h2>批次詳情：{{ selected.name }}</h2><p>{{ selected.description }}</p><p>配額 {{ selected.capacity }} · 保留 {{ selected.heldQuantity }} · 已付款 {{ selected.paidQuantity }}（獨立預購配額）</p><p>預計到貨：{{ selected.arrivalFrom }} ～ {{ selected.arrivalTo }}</p><p>付款條件：{{ termsText(selected) }}<template v-if="selected.balanceCalledAt"> · 已於 {{ taipeiTime(selected.balanceCalledAt) }} 通知尾款</template> · 已登記到貨 {{ selected.receivedQuantity }}</p>
      <div class="actions"><button v-if="selected.status === 'DRAFT' && has('preorders.update')" :disabled="!ready || locked || stale" @click="begin(selected)">編輯批次草稿</button><router-link v-if="selected.openedAt" :to="'/shop/preorders/' + selected.id">查看顧客頁</router-link></div>
      <form v-if="!editing && selected.status !== 'CLOSED' && (has('preorders.open') || has('preorders.close'))" @submit.prevent>
        <label>操作原因<textarea v-model="commandNote" required maxlength="500" :disabled="locked || stale" /></label>
        <button v-if="selected.status === 'DRAFT' && has('preorders.open')" :disabled="!ready || locked || stale || !commandNote.trim()" @click="command('OPEN')">開放批次</button>
        <button v-if="has('preorders.close')" :disabled="!ready || locked || stale || !commandNote.trim()" @click="command('CLOSE')">{{ selected.status === 'DRAFT' ? '取消草稿批次' : '批次截單' }}</button>
      </form>
      <form v-if="!editing && selected.status !== 'DRAFT' && has('preorders.schedule')" data-testid="schedule-form" @submit.prevent="schedule">
        <h3>延期／調整預估到貨</h3>
        <p>會更新尚未到貨、未結束的訂單並通知顧客；「顧客說明」會顯示給顧客，「內部原因」只留在稽核。</p>
        <fieldset :disabled="locked || stale"><div class="columns"><label>新預計到貨起日<input v-model="scheduleForm.arrivalFrom" type="date" required></label><label>新預計到貨迄日<input v-model="scheduleForm.arrivalTo" type="date" required></label></div>
        <label>顧客說明<input v-model="scheduleForm.publicReason" required maxlength="200"></label><label>內部原因<textarea v-model="scheduleForm.note" required maxlength="500" /></label></fieldset>
        <button type="submit" :disabled="!ready || locked || stale || !scheduleForm.publicReason.trim() || !scheduleForm.note.trim()">更新到貨時程並通知</button>
      </form>
      <form v-if="!editing && selected.paymentMode === 'DEPOSIT' && has('preorders.balance.call')" data-testid="balance-form" @submit.prevent="balanceCall">
        <h3>通知尾款</h3>
        <p>登記到貨後才可通知；已付訂金、尚未通知的訂單會改為待付尾款（{{ selected.balanceDays }} 天內），之後才付訂金的訂單會自動跟進。模擬環境不會實際寄送或收款。</p>
        <fieldset :disabled="locked || stale"><label>顧客說明<input v-model="balanceForm.publicReason" required maxlength="200"></label><label>內部原因<textarea v-model="balanceForm.note" required maxlength="500" /></label></fieldset>
        <button type="submit" :disabled="!ready || locked || stale || selected.receivedQuantity < 1 || !balanceForm.publicReason.trim() || !balanceForm.note.trim()">通知已付訂金的訂單付尾款</button>
      </form>
      <h2 v-if="schedules.length">時程與尾款紀錄</h2><details v-for="e in schedules" :key="e.requestId"><summary>{{ taipeiTime(e.createdAt) }} · {{ scheduleActions[e.action] }} · {{ e.actorUsername }} · 影響 {{ e.affectedOrders }} 張</summary><p>操作 ID：{{ e.requestId }}</p><p>顧客說明：{{ e.publicReason }}</p><p>內部原因：{{ e.note }}</p><p v-if="e.action !== 'BALANCE_CALL'">到貨：{{ e.arrivalFromBefore }} ～ {{ e.arrivalToBefore }} → {{ e.arrivalFromAfter }} ～ {{ e.arrivalToAfter }}</p><p v-else>尾款期限：{{ e.balanceDueAt ? taipeiTime(e.balanceDueAt) : '—' }}</p></details>
      <h2>批次稽核</h2><details v-for="e in events" :key="e.requestId"><summary>{{ taipeiTime(e.createdAt) }} · {{ e.action }} · {{ e.actorUsername }}</summary><p>操作 ID：{{ e.requestId }}</p><p>原因：{{ e.note }}</p><h3>修改前</h3><pre>{{ pretty(e.beforeState) }}</pre><h3>修改後</h3><pre>{{ pretty(e.afterState) }}</pre></details>
    </section>
  </div></section>
</template>

<style scoped>
.preorder-admin{overflow-wrap:anywhere;min-width:0;max-width:1200px}.preorder-admin h1{font-size:1.6rem}.preorder-admin h2{font-size:1.15rem}.preorder-admin h3{font-size:1rem}.preorder-admin p,.preorder-admin summary{overflow-wrap:anywhere}.actions{display:flex;gap:.7rem;flex-wrap:wrap;align-items:center;margin:1rem 0}.preorder-admin button{max-width:100%;overflow-wrap:anywhere;white-space:normal;padding:.5rem .75rem;margin-right:.5rem;border:1px solid #1b1f3b;border-radius:5px;background:white;color:#1b1f3b}.preorder-admin button:disabled{opacity:.5}.preorder-admin form,.batch-detail{border:1px solid #d5d8e1;padding:1rem;margin:1rem 0}.preorder-admin label{display:block;margin:.8rem 0}.preorder-admin input,.preorder-admin select,.preorder-admin textarea{display:block;width:100%;max-width:38rem;padding:.6rem;border:1px solid #d5d8e1;border-radius:4px;background:white}.columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.batch-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.batch-list article{min-width:0;border:1px solid #d5d8e1;padding:1rem;border-radius:6px}fieldset{min-width:0}details{border-bottom:1px solid #e3e5ec;padding:.8rem 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}[role=alert]{color:#8a1c1c}@media(max-width:650px){.columns,.batch-list{grid-template-columns:1fr}}
</style>
