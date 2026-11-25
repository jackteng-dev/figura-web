<script setup lang="ts">
// 政策／說明頁（Commerce V2 Phase 6）：草稿 → 送審 → 由另一位有權限的員工發布。系統不提供預設條款內容。
import { computed, onMounted, ref } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { taipeiTime } from '@/api/preorders'
import { adminPages, adminPage, editPage, pageStep, PAGE_STATUS, type AdminPage, type PageEvent } from '@/api/support'
const user = useUserInfoStore()
const has = (code: string) => user.permissions.some(p => p.code === code)
const rows = ref<AdminPage[]>([]), selected = ref<AdminPage>(), events = ref<PageEvent[]>([])
const title = ref(''), body = ref(''), note = ref(''), loading = ref(false), sending = ref(false), error = ref(''), message = ref('')
const pending = ref<{ slug: string; kind: 'edit' | 'submit' | 'publish' | 'reject'; body: any }>()
const failure = (e: any) => e.response?.data?.message || e.message || '暫時無法連線。'
const dirty = computed(() => !!selected.value && (title.value !== selected.value.draftTitle || body.value !== selected.value.draftBody))
async function load() {
  loading.value = true; error.value = ''
  try { rows.value = await adminPages(); if (selected.value) await open(selected.value.slug) } catch (e) { error.value = failure(e) } finally { loading.value = false }
}
async function open(slug: string) {
  const d = await adminPage(slug); selected.value = d.page; events.value = d.events; title.value = d.page.draftTitle; body.value = d.page.draftBody; note.value = ''
}
async function act(kind: 'edit' | 'submit' | 'publish' | 'reject') {
  const s = selected.value
  if (!pending.value) {
    if (!s || !note.value.trim()) return
    pending.value = { slug: s.slug, kind, body: kind === 'edit' ? { requestId: crypto.randomUUID(), expectedVersion: s.version, title: title.value.trim(), body: body.value, note: note.value.trim() } : { requestId: crypto.randomUUID(), expectedVersion: s.version, note: note.value.trim() } }
  }
  sending.value = true; error.value = ''
  try {
    const p = pending.value!
    const r = p.kind === 'edit' ? await editPage(p.slug, p.body) : await pageStep(p.slug, p.kind, p.body)
    pending.value = undefined; selected.value = r.current.page; events.value = r.current.events; title.value = r.current.page.draftTitle; body.value = r.current.page.draftBody; note.value = ''
    message.value = r.replayed ? '已核對，沒有重複操作。' : { edit: '草稿已儲存。', submit: '已送審。', publish: '已發布，前台現在顯示這個版本。', reject: '已退回草稿。' }[p.kind]
    rows.value = await adminPages()
  } catch (e: any) {
    const st = e.response?.status
    if (st && st >= 400 && st < 500) { pending.value = undefined; error.value = failure(e) } else error.value = '結果尚未確認，請再按一次同一個按鈕重試。'
  } finally { sending.value = false }
}
onMounted(load)
</script>
<template>
 <section class="card"><div class="card-body">
  <h1>政策與說明頁</h1>
  <p>條款與政策必須由作者撰寫正式內容。流程：員工編輯草稿 → 送審 → 由<strong>最後編輯者以外</strong>、有發布權限的員工發布。未發布前，前台顯示「條款審核中」。</p>
  <p v-if="error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
  <div class="table-wrap"><table><thead><tr><th>頁面</th><th>狀態</th><th>已發布版本</th><th></th></tr></thead><tbody>
   <tr v-for="p in rows" :key="p.slug"><td>{{ p.draftTitle }}<br><small>{{ p.slug }}・{{ p.kind === 'POLICY' ? '政策' : '說明' }}</small></td><td>{{ PAGE_STATUS[p.status] }}</td>
    <td>{{ p.publishedRevision ? '第 ' + p.publishedRevision + ' 版・' + taipeiTime(p.publishedAt || '') : '尚未發布' }}</td>
    <td><button :disabled="!!pending" @click="open(p.slug)">開啟</button></td></tr>
  </tbody></table></div>
  <div v-if="selected" class="editor">
   <h2>{{ selected.slug }}（{{ PAGE_STATUS[selected.status] }}）</h2>
   <label for="pg-title">標題</label><input id="pg-title" v-model="title" maxlength="120" :disabled="!has('pages.edit') || !!pending">
   <label for="pg-body">內容（純文字，換行會保留）</label><textarea id="pg-body" v-model="body" rows="14" maxlength="60000" :disabled="!has('pages.edit') || !!pending" />
   <label for="pg-note">原因／審核意見（寫入紀錄）</label><input id="pg-note" v-model="note" maxlength="480">
   <div class="actions">
    <button v-if="has('pages.edit')" :disabled="sending || !note.trim() || !dirty" @click="act('edit')">儲存草稿</button>
    <button v-if="has('pages.submit')" :disabled="sending || !note.trim() || dirty || selected.status !== 'DRAFT'" @click="act('submit')">送審</button>
    <button v-if="has('pages.publish')" :disabled="sending || !note.trim() || selected.status !== 'IN_REVIEW' || selected.draftEditorId === user.info?.id" @click="act('publish')">發布</button>
    <button v-if="has('pages.reject')" :disabled="sending || !note.trim() || selected.status !== 'IN_REVIEW'" @click="act('reject')">退回</button>
   </div>
   <p v-if="selected.status === 'IN_REVIEW' && selected.draftEditorId === user.info?.id">你是最後編輯者，需由其他員工審核發布。</p>
   <details v-if="selected.publishedBody"><summary>目前已發布版本</summary><pre>{{ selected.publishedBody }}</pre></details>
   <h3>紀錄</h3>
   <ul><li v-for="e in events" :key="e.requestId">{{ taipeiTime(e.createdAt) }}・{{ e.actorUsername }}・{{ e.action }}・{{ e.note }}</li></ul>
  </div>
 </div></section>
</template>
<style scoped>
.table-wrap { overflow-x: auto; } table { width: 100%; } td, th { padding: 6px 8px; vertical-align: top; }
.editor { display: grid; gap: 6px; margin-top: 16px; max-width: 860px; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
pre { white-space: pre-wrap; background: #f6f7fb; padding: 10px; border-radius: 6px; }
</style>
