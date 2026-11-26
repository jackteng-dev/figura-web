<script setup lang="ts">
// 到貨／開賣提醒：會員才能設定；只在狀態「轉換」時通知一次（不會重複轟炸）。
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { productAlerts, setProductAlerts, ALERT_LABELS, type AlertKind } from '@/api/engagement'
import { useCustomerStore } from '@/stores/customer'
import { rememberReturn } from './guestCart'
const props = defineProps<{ productId: string }>()
const customer = useCustomerStore(), route = useRoute()
const kinds = ref<AlertKind[]>([]), saved = ref<AlertKind[]>([]), open = ref(false), pending = ref(false), message = ref(''), error = ref('')
const ALL = Object.keys(ALERT_LABELS) as AlertKind[]
async function load() {
  if (!customer.profile) { kinds.value = []; saved.value = []; return }
  try { const a = (await productAlerts()).find(x => x.productId === props.productId); saved.value = a?.kinds ?? []; kinds.value = [...saved.value] } catch { /* 讀不到就以未訂閱顯示 */ }
}
watch(() => [customer.profile?.id, props.productId], load, { immediate: true })
async function save() {
  pending.value = true; error.value = ''; message.value = ''
  try { saved.value = await setProductAlerts(props.productId, kinds.value); kinds.value = [...saved.value]; message.value = saved.value.length ? '已儲存提醒設定。' : '已取消這件商品的提醒。' }
  catch (e) { error.value = e instanceof Error ? e.message : '儲存失敗，請稍後再試' }
  finally { pending.value = false }
}
function toggle(k: AlertKind) { kinds.value = kinds.value.includes(k) ? kinds.value.filter(x => x !== k) : [...kinds.value, k] }
</script>
<template>
  <div class="alert-panel">
    <button type="button" class="alert-toggle" :aria-expanded="open" aria-controls="alert-body" @click="open = !open">
      🔔 到貨／開賣提醒<span v-if="saved.length" class="count">已訂閱 {{ saved.length }} 項</span>
    </button>
    <div v-show="open" id="alert-body" class="alert-body">
      <template v-if="customer.profile">
        <fieldset><legend class="visually-hidden">選擇要接收的提醒</legend>
          <label v-for="k in ALL" :key="k" class="shop-check"><input type="checkbox" :checked="kinds.includes(k)" @change="toggle(k)"> {{ ALERT_LABELS[k] }}</label>
        </fieldset>
        <p class="hint">提醒會出現在「通知」，並可在通知設定開啟 Email。每次狀態改變只通知一次。</p>
        <button type="button" class="shop-button" :disabled="pending" @click="save">{{ pending ? '儲存中…' : '儲存提醒' }}</button>
        <p v-if="message" class="shop-success" role="status">{{ message }}</p>
        <p v-if="error" class="shop-error" role="alert">{{ error }}</p>
      </template>
      <p v-else>請先 <router-link to="/shop/login" @click="rememberReturn(route.fullPath)">登入會員</router-link> 再設定到貨或開賣提醒。</p>
    </div>
  </div>
</template>
<style scoped>
.alert-panel { margin-top: 12px; }
.alert-toggle { background: none; border: 1px dashed #c4c8d4; border-radius: 10px; padding: 8px 12px; font-size: 14px; color: #2b2e38; cursor: pointer; min-height: 40px; }
.alert-toggle:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
.count { margin-left: 8px; font-size: 12px; color: #9a3412; font-weight: 700; }
.alert-body { border: 1px solid #e3e5ec; border-radius: 10px; padding: 12px 14px; margin-top: 8px; background: #fff; }
.alert-body fieldset { border: 0; padding: 0; margin: 0 0 6px; }
.hint { font-size: 13px; color: #4b5060; }
</style>
