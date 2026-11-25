<script setup lang="ts">
// 物流追蹤時間軸（Commerce V2 Phase 6）。目前只有測試物流：事件由店長手動新增，用來演練顯示與通知，不是真實物流資訊。
import { ref, watch } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { myTracking, staffTracking, addTracking, TRACKING_LABELS, type Timeline } from '@/api/support'
const props = defineProps<{ shipmentId: string; staff?: boolean; method?: string }>()
const user = useUserInfoStore()
const timeline = ref<Timeline>(), error = ref(''), code = ref('IN_TRANSIT'), sending = ref(false)
const pending = ref<{ requestId: string; code: string }>()
async function load() {
  error.value = ''
  try { timeline.value = props.staff ? await staffTracking(props.shipmentId) : await myTracking(props.shipmentId) }
  catch (e: any) { error.value = e.response?.data?.message || e.message || '物流資訊暫時無法載入' }
}
watch(() => props.shipmentId, load, { immediate: true })
const canAdd = () => props.staff && user.permissions.some(p => p.code === 'shipments.tracking.mock')
const codes = () => Object.keys(TRACKING_LABELS).filter(c => !(c === 'ARRIVED_STORE' && props.method === 'HOME') && !(c === 'OUT_FOR_DELIVERY' && props.method === 'CVS'))
async function add() {
  pending.value ??= { requestId: crypto.randomUUID(), code: code.value }
  sending.value = true; error.value = ''
  try { timeline.value = await addTracking(props.shipmentId, pending.value); pending.value = undefined }
  catch (e: any) { const st = e.response?.status; if (st && st >= 400 && st < 500) { pending.value = undefined; error.value = e.response?.data?.message || '無法新增' } else error.value = '結果尚未確認，請再按一次重試。' }
  finally { sending.value = false }
}
const time = (v: string) => new Date(v).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>
<template>
  <div class="tracking">
    <h3>物流追蹤</h3>
    <p v-if="error" role="alert" class="err">{{ error }}</p>
    <template v-if="timeline">
      <p class="note"><template v-if="timeline.trackingNumber">貨件號 {{ timeline.trackingNumber }}・</template><strong v-if="timeline.testCarrier">測試物流，非真實物流資訊</strong></p>
      <p v-if="!timeline.events.length" class="note">尚無物流事件。</p>
      <ol v-else class="steps"><li v-for="e in timeline.events" :key="e.id" :class="{ bad: e.code === 'EXCEPTION' }"><strong>{{ TRACKING_LABELS[e.code] || e.code }}</strong>・<time :datetime="e.occurredAt">{{ time(e.occurredAt) }}</time><br><span>{{ e.description }}</span></li></ol>
    </template>
    <div v-if="canAdd()" class="add">
      <select v-model="code" aria-label="測試物流事件" :disabled="!!pending"><option v-for="c in codes()" :key="c" :value="c">{{ TRACKING_LABELS[c] }}</option></select>
      <button type="button" :disabled="sending" @click="add">{{ pending ? '重試' : '新增測試事件' }}</button>
    </div>
  </div>
</template>
<style scoped>
.tracking { margin-top: 12px; }
.tracking h3 { font-size: 15px; margin: 0 0 6px; }
.note { font-size: 13px; color: #4b5060; }
.steps { padding-left: 20px; display: grid; gap: 6px; font-size: 14px; }
.steps .bad strong { color: #b91c1c; }
.steps span { color: #4b5060; font-size: 13px; }
.add { display: flex; gap: 8px; margin-top: 8px; }
.err { color: #b91c1c; font-size: 13px; }
</style>
