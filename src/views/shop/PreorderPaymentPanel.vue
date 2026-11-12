<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { preorderOrder, type PreorderOrder } from '@/api/preorderOrders'
import { CustomerApiError } from '@/api/customer'
import { money } from '@/api/catalog'
import { taipeiTime } from '@/api/preorders'
import { paymentStatus, type PaymentStart, type PaymentSimulation } from '@/api/payments'
import { getPreorderPayments, startPreorderPayment, simulatePreorderPayment, type Options, type PreorderPayment } from '@/api/preorderMoney'
const props = defineProps<{ order: PreorderOrder; disabled: boolean }>(), emit = defineEmits<{ changed: [order: PreorderOrder]; frozen: [value: boolean] }>()
const options = ref<Options>(), busy = ref(false), error = ref(''), notice = ref(''), ready = ref(false)
const pendingStart = ref<PaymentStart>(), pendingResult = ref<{ id: string; body: PaymentSimulation }>()
watch(() => !!pendingStart.value || !!pendingResult.value , v => emit('frozen', v))
function rejected(e: unknown) {
  if (e instanceof CustomerApiError && e.status >= 400 && e.status < 500) { pendingStart.value = undefined; pendingResult.value = undefined; ready.value = false; error.value = `${e.message} 請核對訂單與付款後，再明確操作。` }
  else error.value = '付款回應尚未確認，請重試原操作。其他寫入已暫時鎖定。'
}
async function read() { const [o, p] = await Promise.all([preorderOrder(props.order.id), getPreorderPayments(props.order.id)]); options.value = p; emit('changed', o); ready.value = true }
async function load() { if (busy.value || pendingStart.value || pendingResult.value || props.disabled) return; busy.value = true; ready.value = false; error.value = ''; try { await read() } catch (e: any) { error.value = e.message || '核對付款失敗，請重試。' } finally { busy.value = false } }
async function start() {
  if (busy.value || props.disabled || pendingResult.value || (!pendingStart.value && (!ready.value || !options.value?.canStart))) return
  if (!pendingStart.value) { if (!window.confirm('建立預購模擬付款？不會實際收款。')) return; pendingStart.value = { requestId: crypto.randomUUID(), expectedOrderVersion: props.order.version } }
  busy.value = true; error.value = ''; notice.value = ''
  try { await startPreorderPayment(props.order.id, pendingStart.value); pendingStart.value = undefined; notice.value = '預購模擬付款已建立，請選擇演練結果。'; try { await read() } catch { ready.value = false; error.value = '建立已確認，但資料讀取失敗。請核對付款，勿重複建立。' } } catch (e) { rejected(e) } finally { busy.value = false }
}
async function simulate(p?: PreorderPayment, outcome?: PaymentSimulation['outcome']) {
  if (busy.value || props.disabled || pendingStart.value || (!pendingResult.value && !ready.value)) return
  if (!pendingResult.value) { if (!p || !outcome || !window.confirm('送出預購模擬付款通知？不會實際收款。')) return; pendingResult.value = { id: p.id, body: { eventId: crypto.randomUUID(), outcome } } }
  busy.value = true; error.value = ''; notice.value = ''
  try { const r = await simulatePreorderPayment(pendingResult.value.id, pendingResult.value.body); pendingResult.value = undefined; emit('changed', r.order); notice.value = r.disposition === 'REVIEW_REQUIRED' ? '成功通知已保留為待核對，訂單與配額沒有恢復；請由店長核對退款。' : r.payment.status === 'SUCCEEDED' ? '預購模擬付款成功，保留配額已移到已付款；未扣現貨，沒有實際收款。' : '預購模擬付款失敗，可在保留期限內重新建立付款。'; try { await read() } catch { ready.value = false; error.value = '付款通知已確認，但讀取失敗。請核對付款。' } } catch (e) { rejected(e) } finally { busy.value = false }
}
watch(() => props.order.version, () => { ready.value = false; if (!busy.value && !pendingStart.value && !pendingResult.value && !props.disabled) load() })
watch(() => props.disabled, v => { if (!v && !ready.value && !busy.value && !pendingStart.value && !pendingResult.value) load() })
onBeforeRouteLeave(() => (!pendingStart.value && !pendingResult.value) || window.confirm('預購付款結果尚未確認。離開會失去原操作，確定離開？'))
onMounted(load)
</script>
<template>
  <section class="preorder-payment-panel"><h3>預購付款模擬</h3><p>整筆付款演練，不會實際收款；付款成功移轉批次配額，不扣現貨庫存。</p>
    <p v-if="error" role="alert" class="shop-error">{{ error }}</p><p v-if="notice" role="status" class="shop-success">{{ notice }}</p><p v-if="options && !options.enabled">此環境未啟用預購付款模擬。</p>
    <button class="shop-button" :disabled="disabled || busy || !!pendingStart || !!pendingResult" @click="load">核對預購付款</button>
    <button v-if="pendingStart || options?.canStart" class="shop-button" :disabled="disabled || busy || !!pendingResult || (!pendingStart && !ready)" @click="start">{{ pendingStart ? '重試原預購付款建立' : '建立預購模擬付款' }}</button>
    <button v-if="pendingResult" class="shop-button" :disabled="disabled || busy" @click="simulate()">重試原預購付款通知</button>
    <ul><li v-for="p in options?.items" :key="p.id" :data-payment-id="p.id"><strong>{{ p.refund ? '已模擬退款' : paymentStatus(p.status) }}</strong> · {{ money(p.amountTwd) }}<small>付款 {{ p.id }}</small><small v-if="p.refund">模擬退款 {{ money(p.refund.amountTwd) }} · {{ taipeiTime(p.refund.refundedAt) }}；沒有實際轉帳。</small>
      <div v-if="p.status === 'INITIATED' && !pendingStart && !pendingResult"><button class="shop-button" :disabled="disabled || busy || !ready" @click="simulate(p, 'SUCCESS')">模擬預購付款成功</button><button class="shop-button" :disabled="disabled || busy || !ready" @click="simulate(p, 'FAILURE')">模擬預購付款失敗</button></div></li></ul>
    <p v-if="order.paymentReviewRequired" class="shop-error">有異常成功通知待核對，暫停新的付款與訂單退款；請由店長查看原證據。</p>
  </section>
</template>
<style scoped>
.preorder-payment-panel{border-top:1px solid #e3e5ec;margin-top:24px;padding-top:20px;overflow-wrap:anywhere}h3{font-size:19px}button{margin:6px 8px 6px 0;max-width:100%;white-space:normal}small{display:block;margin:6px 0;font-size:12px}ul{padding-left:20px}
</style>
