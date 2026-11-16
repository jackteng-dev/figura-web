<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { publicBatch, taipeiTime, type PublicBatch } from '@/api/preorders'
import { getAddresses, type AddressView } from '@/api/shopping'
import { placePreorder, preorderStatus, type PreorderPlace, type PreorderOrder } from '@/api/preorderOrders'
import { CustomerApiError } from '@/api/customer'
import { money } from '@/api/catalog'
const route = useRoute(), batch = ref<PublicBatch>(), addresses = ref<AddressView[]>([]), quantity = ref(1), addressId = ref('')
const busy = ref(false), ready = ref(false), error = ref(''), pending = ref<PreorderPlace>(), placed = ref<PreorderOrder>()
const address = computed(() => addresses.value.find(a => a.id === addressId.value))
const total = computed(() => (batch.value?.priceTwd || 0) * quantity.value)
const valid = computed(() => ready.value && batch.value?.orderingEnabled && address.value && Number.isInteger(quantity.value) && quantity.value >= 1 && quantity.value <= Math.min(100, batch.value.availableQuota))
async function load() {
  if (busy.value || pending.value) return
  busy.value = true; ready.value = false; error.value = ''
  try { const [b, a] = await Promise.all([publicBatch(String(route.params.id)), getAddresses()]); batch.value = b; addresses.value = a; if (!a.some(v => v.id === addressId.value)) addressId.value = a[0]?.id || ''; ready.value = true }
  catch (e: any) { error.value = e.message || '資料讀取失敗，請重新載入。' }
  finally { busy.value = false }
}
async function submit() {
  if (busy.value || placed.value || (!pending.value && !valid.value)) return
  if (!pending.value) pending.value = { requestId: crypto.randomUUID(), batchId: batch.value!.id, quantity: quantity.value, addressId: address.value!.id, addressVersion: address.value!.version, expectedSubtotalTwd: total.value }
  busy.value = true; error.value = ''
  try { const result = await placePreorder(pending.value); pending.value = undefined; placed.value = result.order }
  catch (e: any) {
    if (e instanceof CustomerApiError && e.status >= 400 && e.status < 500) { pending.value = undefined; ready.value = false; error.value = `${e.message} 請重新載入後核對，再明確送出。` }
    else error.value = '尚未確認下單結果，請重試原操作。數量與地址已暫時鎖定，避免重複下單。'
  } finally { busy.value = false }
}
onBeforeRouteLeave(() => !pending.value || window.confirm('下單結果尚未確認。離開會失去原操作，請先重試或至我的預購核對。確定離開？'))
onMounted(load)
</script>
<template>
  <section class="preorder-checkout"><h1>預購下單</h1>
    <p>每筆訂單對應一個批次。配額保留至下單後 30 分鐘或批次截止時間，取較早者；預購付款僅提供模擬，逾時會自動釋放。</p>
    <p v-if="error" role="alert" class="shop-error">{{ error }}</p><p v-if="busy" role="status">處理中…</p>
    <article v-if="placed" class="summary"><h2>預購訂單已建立</h2><p>{{ preorderStatus[placed.status] }} · 訂單 {{ placed.id }}</p><p>{{ placed.productTitle }} · {{ placed.skuLabel }} × {{ placed.quantity }}</p><p>總額 {{ money(placed.totalTwd) }}</p><p>保留期限（台北）：{{ taipeiTime(placed.expiresAt) }}</p><router-link class="shop-button" to="/shop/preorder-orders">查看我的預購</router-link></article>
    <template v-else>
      <button class="shop-button" :disabled="busy || !!pending" @click="load">重新載入並核對</button>
      <form v-if="batch" @submit.prevent="submit"><h2>{{ batch.name }}</h2><p>{{ batch.productTitle }} · {{ batch.skuLabel }}</p><p>單價 {{ money(batch.priceTwd) }} · 剩餘配額 {{ batch.availableQuota }} 件</p><p>截止（台北）：{{ taipeiTime(batch.deadlineAt) }}</p><p>預計到貨：{{ batch.arrivalFrom }} ～ {{ batch.arrivalTo }}（預估）</p>
        <fieldset :disabled="busy || !!pending || !ready"><label for="preorder-quantity">預購數量</label><input id="preorder-quantity" v-model.number="quantity" type="number" min="1" :max="Math.min(100, batch.availableQuota)" required>
          <label for="preorder-address">收件地址</label><select id="preorder-address" v-model="addressId" aria-label="收件地址" required><option value="" disabled>請選擇地址</option><option v-for="a in addresses" :key="a.id" :value="a.id">{{ a.recipientName }} · {{ a.city }}{{ a.district }}{{ a.street }}</option></select>
        </fieldset><p v-if="ready && !addresses.length">請先<router-link to="/shop/addresses">新增收件地址</router-link>，再回來重新載入。</p>
        <p v-if="ready && !batch.orderingEnabled">此批次目前無法下單，可能已截單、到期或配額已滿。</p><p>小計 {{ money(total) }} · 展示運費 {{ money(0) }} · 總額 {{ money(total) }}</p>
        <button class="shop-button" :disabled="busy || (!pending && !valid)" type="submit">{{ pending ? '重試原下單操作' : '確認預購並保留配額' }}</button>
      </form>
    </template>
  </section>
</template>
<style scoped>
.preorder-checkout{max-width:700px;overflow-wrap:anywhere}form,.summary{margin-top:24px;padding:24px;background:#ffffff;border:1px solid #e3e5ec;border-radius:12px}fieldset{border:0;padding:0;min-width:0}select{width:100%;padding:12px;border:1px solid #d5d8e1;border-radius:5px;background:white;color:#15161a}button{max-width:100%;white-space:normal}h2{font-size:22px}
</style>
