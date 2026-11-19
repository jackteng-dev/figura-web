<script setup lang="ts">
// 配送方式與運費規則（Phase 5）：每種方式的基本運費、免運門檻與是否開放；每次修改都需原因並留下稽核。
import { onMounted, reactive, ref } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { shippingMethods, updateShippingMethod, feeRule, type ShippingMethod, type MethodWrite } from '@/api/shipping'

const user = useUserInfoStore()
const canEdit = () => user.permissions.some(p => p.code === 'shipping.methods.update')
const rows = ref<ShippingMethod[]>([]), editing = ref<ShippingMethod>(), loading = ref(false), sending = ref(false), error = ref(''), message = ref('')
const form = reactive({ feeTwd: 0, freeThresholdTwd: null as number | null, enabled: true, note: '' })
const pending = ref<{ code: ShippingMethod['code']; body: MethodWrite }>()
function failure(e: any) { return e.response?.data?.message || e.message || '暫時無法連線。' }
async function load() {
  if (sending.value || pending.value) return
  loading.value = true; error.value = ''
  try { rows.value = await shippingMethods() } catch (e) { error.value = failure(e) } finally { loading.value = false }
}
function begin(m: ShippingMethod) { if (pending.value || !canEdit()) return; editing.value = m; message.value = ''; Object.assign(form, { feeTwd: m.feeTwd, freeThresholdTwd: m.freeThresholdTwd, enabled: m.enabled, note: '' }) }
async function save() {
  if (!pending.value) {
    const m = editing.value; if (!m || !form.note.trim()) return
    pending.value = { code: m.code, body: { requestId: crypto.randomUUID(), expectedVersion: m.version, feeTwd: form.feeTwd, freeThresholdTwd: form.freeThresholdTwd || null, enabled: form.enabled, note: form.note.trim() } }
  }
  sending.value = true; error.value = ''
  let done = false
  try {
    const r = await updateShippingMethod(pending.value.code, pending.value.body)
    pending.value = undefined; done = true; editing.value = undefined
    message.value = r.replayed ? '操作已核對，沒有重複保存。' : `已更新 ${r.current.name}：${feeRule(r.current)}。新的結帳報價立即使用新規則，既有訂單不變。`
  } catch (e: any) {
    const status = e.response?.status
    if (status && status >= 400 && status < 500) { pending.value = undefined; error.value = failure(e) + (status === 409 ? '；請重讀後再修改。' : '') }
    else error.value = '結果尚未確認。表單暫時凍結，請重試同一操作。'
  } finally { sending.value = false }
  if (done) await load()
}
onMounted(load)
</script>

<template>
 <section class="methods card"><div class="card-body">
  <h1>配送方式與運費</h1>
  <p>運費以「每個包裹」計算：包裹商品金額達免運門檻即免運。結帳時伺服器依目前規則重新計算；既有訂單的運費不會因修改而改變。目前預設值為測試用，正式費率請上線前確認。</p>
  <p v-if="error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p><p v-if="loading" role="status">載入中…</p>
  <article v-for="m in rows" :key="m.code"><h2>{{ m.name }}</h2><p>{{ feeRule(m) }} · {{ m.enabled ? '開放中' : '暫停使用' }} · 版本 {{ m.version }}</p>
   <button v-if="canEdit()" :disabled="loading || sending || !!pending" @click="begin(m)">修改 {{ m.name }}</button></article>
  <form v-if="editing" @submit.prevent="save" data-testid="method-form">
   <h2>修改 {{ editing.name }}</h2>
   <fieldset :disabled="sending || !!pending">
    <label>基本運費（TWD）<input v-model.number="form.feeTwd" type="number" min="0" max="100000" step="1" required></label>
    <label>免運門檻（TWD，留空＝不免運）<input v-model.number="form.freeThresholdTwd" type="number" min="1" max="99999999" step="1"></label>
    <label class="inline"><input v-model="form.enabled" type="checkbox"> 開放顧客選擇</label>
    <label>異動原因<textarea v-model="form.note" required maxlength="500" /></label>
   </fieldset>
   <button type="submit" :disabled="sending || (!pending && !form.note.trim())">{{ pending ? '重試同一操作' : '保存運費規則' }}</button>
   <button type="button" :disabled="sending || !!pending" @click="editing = undefined">關閉</button>
  </form>
 </div></section>
</template>

<style scoped>
.methods{overflow-wrap:anywhere;min-width:0;max-width:900px}.methods h1{font-size:1.6rem}.methods h2{font-size:1.15rem}article,form{border:1px solid #d5d8e1;border-radius:6px;padding:1rem;margin:1rem 0}.methods button{max-width:100%;white-space:normal;padding:.5rem .75rem;margin-right:.5rem;border:1px solid #1b1f3b;border-radius:5px;background:white;color:#1b1f3b}.methods button:disabled{opacity:.5}label{display:block;margin:.8rem 0}label.inline{display:flex;gap:.5rem;align-items:center}input:not([type=checkbox]),textarea{display:block;width:100%;max-width:24rem;padding:.6rem;border:1px solid #d5d8e1;border-radius:4px}fieldset{border:0;padding:0;min-width:0}[role=alert]{color:#8a1c1c}
</style>
