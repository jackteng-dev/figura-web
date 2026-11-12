<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { catalogError, type Sku, type Page } from '@/api/catalog'
import { getInventory, getInventoryHistory, adjustInventory, reasonLabel, type InventoryBalance, type InventoryAdjustment, type AdjustmentInput } from '@/api/inventory'
const props = defineProps<{ productId: string; skus: Sku[]; archived: boolean }>()
const user = useUserInfoStore(), skuId = ref(''), balance = ref<InventoryBalance>(), history = ref<Page<InventoryAdjustment>>(), page = ref(1), busy = ref(false), error = ref(''), notice = ref('')
const delta = ref(1), reason = ref<InventoryAdjustment['reason']>('RESTOCK'), note = ref(''), pending = ref<AdjustmentInput>()
const has = (code: string) => user.permissions.some(p => p.code === code)
const canAdjust = computed(() => has('inventory.adjust') && !props.archived)
async function load(nextPage = 1) {
  balance.value = await getInventory(props.productId, skuId.value)
  history.value = has('inventory.audit') ? await getInventoryHistory(props.productId, skuId.value, nextPage) : undefined
  page.value = nextPage
}
async function reload(nextPage = 1) { busy.value = true; error.value = ''; try { await load(nextPage) } catch (e) { error.value = catalogError(e) } finally { busy.value = false } }
async function submit() {
  if (!balance.value || !canAdjust.value) return
  if (!pending.value && (!Number.isInteger(delta.value) || delta.value === 0 || !note.value.trim())) { error.value = '請填入非零整數數量與調整說明。'; return }
  pending.value ??= { requestId: crypto.randomUUID(), expectedVersion: balance.value.version, delta: delta.value, reason: reason.value, note: note.value.trim() }
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const result = await adjustInventory(props.productId, skuId.value, pending.value)
    // The committed response acknowledges this operation; reload reads current stock.
    pending.value = undefined; note.value = ''
    notice.value = result.replayed ? '已確認前次調整，沒有重複增減庫存。' : '庫存已調整，異動紀錄已保存。'
    await load()
  } catch (e: any) {
    if (e.response?.status >= 400 && e.response.status < 500) pending.value = undefined
    error.value = catalogError(e)
  } finally { busy.value = false }
}
watch(() => props.productId, () => { skuId.value = props.skus[0]?.id || ''; pending.value = undefined }, { immediate: true })
watch(skuId, () => { balance.value = undefined; history.value = undefined; error.value = ''; notice.value = ''; pending.value = undefined; if (skuId.value) reload() }, { immediate: true })
</script>
<template>
  <section class="inventory-panel" aria-labelledby="inventory-title"><h3 id="inventory-title">SKU 庫存與異動</h3>
    <p>調整數量會保存操作者與原因；庫存與商品內容使用各自版本。</p>
    <label for="inventory-sku">庫存款式</label><select id="inventory-sku" v-model="skuId" class="form-select" :disabled="busy || !!pending"><option v-for="sku in skus" :key="sku.id" :value="sku.id">{{ sku.label }} · {{ sku.code }}</option></select>
    <div v-if="error" class="alert alert-danger mt-3" role="alert">{{ error }} <button class="btn btn-outline-dark btn-sm" :disabled="busy" @click="reload()">重新核對庫存</button></div>
    <p v-if="notice" class="alert alert-success mt-3" role="status">{{ notice }}</p>
    <p v-if="balance" class="inventory-balance">目前庫存 <strong data-testid="inventory-quantity">{{ balance.quantity }}</strong> 件 · 訂單保留 {{ balance.reserved }} 件 · 可售 {{ balance.available }} 件 <small>庫存版本 {{ balance.version }}</small></p><p v-else role="status">正在載入庫存…</p>
    <p v-if="pending" class="text-warning">前次結果尚未確認，重試會沿用同一操作編號，避免重複增減庫存。請保留此頁。</p>
    <form v-if="canAdjust && balance" @submit.prevent="submit"><fieldset :disabled="busy || !!pending"><label for="inventory-delta">調整數量（正數入庫，負數扣減）</label><input id="inventory-delta" v-model.number="delta" class="form-control" type="number" min="-1000000" max="1000000" step="1" required><label for="inventory-reason">異動原因</label><select id="inventory-reason" v-model="reason" class="form-select"><option value="RESTOCK">入庫</option><option value="CORRECTION">盤點修正</option><option value="DAMAGE">損耗</option></select><label for="inventory-note">調整說明</label><textarea id="inventory-note" v-model="note" class="form-control" rows="2" maxlength="500" required /></fieldset><button class="btn btn-primary mt-3" type="submit" :disabled="busy">{{ pending ? '重試此調整' : '確認調整庫存' }}</button></form>
    <p v-else>{{ archived ? '商品已封存，僅能查看庫存與紀錄。' : '目前帳號沒有庫存調整權限。' }}</p>
    <template v-if="has('inventory.audit')"><h4>庫存異動紀錄</h4><p v-if="history?.total === 0">尚無庫存異動。</p><ol class="inventory-history"><li v-for="entry in history?.items" :key="entry.requestId"><strong>{{ reasonLabel(entry.reason) }} {{ entry.delta > 0 ? '+' : '' }}{{ entry.delta }} 件</strong><span>{{ entry.beforeQuantity }} → {{ entry.afterQuantity }} 件 · {{ entry.actorUsername }}</span><p class="inventory-note">{{ entry.note }}</p><small>{{ entry.createdAt.replace('T', ' ') }} · 版本 {{ entry.beforeVersion }} → {{ entry.afterVersion }}</small><small class="request-id">操作編號 {{ entry.requestId }}</small></li></ol><div v-if="history && history.total > history.pageSize" class="inventory-pagination"><button class="btn btn-outline-primary" :disabled="busy || page === 1" @click="reload(page-1)">較新紀錄</button><span>第 {{ page }} 頁</span><button class="btn btn-outline-primary" :disabled="busy || page*history.pageSize >= history.total" @click="reload(page+1)">較舊紀錄</button></div></template>
  </section>
</template>
<style scoped>
.inventory-panel { border-top:1px solid #e3e5ec;margin-top:28px;padding-top:24px; }.inventory-panel h3 { font-size:20px; }.inventory-panel h4 { font-size:18px;margin:28px 0 16px; }.inventory-panel label { display:block;margin:16px 0 8px; }.inventory-balance { margin:24px 0;font-size:18px; }.inventory-balance strong { font-size:26px;margin:0 8px; }.inventory-balance small { font-size:12px;color:#4b5060; }.inventory-history { list-style:none;padding:0; }.inventory-history li { padding:16px 0;border-bottom:1px solid #e3e5ec;overflow-wrap:anywhere; }.inventory-history span,.inventory-history small { display:block;margin-top:6px; }.inventory-note { white-space:pre-wrap;margin:10px 0; }.request-id { color:#4b5060; }.inventory-pagination { display:flex;align-items:center;justify-content:space-between;gap:12px; }
</style>
