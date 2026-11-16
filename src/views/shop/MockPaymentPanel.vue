<script setup lang="ts">
import { onMounted,ref,watch } from 'vue'
import { orderTime,type OrderView } from '@/api/orders'
import { CustomerApiError } from '@/api/customer'
import { money } from '@/api/catalog'
import { getPayments,startPayment,simulatePayment,paymentStatus,type PaymentOptions,type PaymentStart,type PaymentSimulation,type MockPayment } from '@/api/payments'
const props=defineProps<{order:OrderView}>(),emit=defineEmits<{changed:[order:OrderView]}>()
const options=ref<PaymentOptions>(),busy=ref(false),error=ref(''),notice=ref(''),needsReload=ref(false)
const pendingStart=ref<PaymentStart>(),pendingSimulation=ref<{id:string;body:PaymentSimulation}>()
async function load(){if(busy.value)return;busy.value=true;error.value='';try{options.value=await getPayments(props.order.id);needsReload.value=false}catch(e){error.value=e instanceof Error?e.message:'無法核對付款'}finally{busy.value=false}}
function failed(e:unknown){error.value=e instanceof Error?e.message:'操作失敗';const known=e instanceof CustomerApiError&&[400,404,409].includes(e.status);if(known){pendingStart.value=undefined;pendingSimulation.value=undefined;needsReload.value=true}else{error.value='付款回應未確認，請用同一操作重試或核對訂單；不要建立另一筆。'}return known}
async function start(){
 if(busy.value||needsReload.value||pendingSimulation.value)return
 if(!pendingStart.value){if(!options.value?.canStart)return;if(!window.confirm('建立模擬付款？不會實際收款。'))return;pendingStart.value={requestId:crypto.randomUUID(),expectedOrderVersion:props.order.version}}
 busy.value=true;error.value='';notice.value=''
 try{await startPayment(props.order.id,pendingStart.value);options.value=await getPayments(props.order.id);pendingStart.value=undefined;notice.value='模擬付款已建立，請選擇測試結果。'}catch(e){failed(e)}finally{busy.value=false}
}
async function simulate(payment?:MockPayment,outcome?:PaymentSimulation['outcome']){
 if(busy.value||needsReload.value||pendingStart.value)return
 if(!pendingSimulation.value){if(!payment||!outcome)return;if(!window.confirm(`模擬付款${outcome==='SUCCESS'?'成功':'失敗'}（${money(payment.amountTwd)}）？不會實際收款。`))return;pendingSimulation.value={id:payment.id,body:{eventId:crypto.randomUUID(),outcome}}}
 busy.value=true;error.value='';notice.value=''
 try{const result=await simulatePayment(pendingSimulation.value.id,pendingSimulation.value.body);emit('changed',result.order);options.value=await getPayments(props.order.id);pendingSimulation.value=undefined;notice.value=result.disposition==='REVIEW_REQUIRED'?'通知已記錄為待人工核對，沒有恢復訂單或扣庫。':result.payment.status==='SUCCEEDED'?'模擬付款成功，實體庫存已扣減；沒有實際收款。':'模擬付款失敗，可在訂單期限內建立新的模擬付款。'}catch(e){failed(e)}finally{busy.value=false}
}
watch(()=>props.order.version,()=>load());onMounted(load)
</script>
<template><section class="mock-payment-panel" :data-testid="'payment-panel-'+order.id"><h3>付款模擬</h3><p>測試成功與失敗通知，不會實際收款。金額由訂單快照提供。</p>
<p v-if="error" role="alert" class="shop-error">{{ error }}</p><p v-if="notice" role="status" class="shop-success">{{ notice }}</p>
<p v-if="options&&!options.enabled">此環境未啟用付款模擬。</p>
<template v-if="options?.enabled"><button class="shop-button secondary" :disabled="busy" @click="load">核對模擬付款</button>
<button v-if="pendingStart||options.canStart" class="shop-button" :disabled="busy||needsReload||!!pendingSimulation" @click="start">{{ pendingStart?'重試同一筆付款建立':'建立模擬付款' }}</button>
<button v-if="pendingSimulation" class="shop-button" :disabled="busy||needsReload" @click="simulate()">重試同一付款通知</button>
<ul><li v-for="payment in options.items" :key="payment.id" :data-testid="'payment-'+payment.id"><strong>{{ payment.refund?'已模擬退款':paymentStatus(payment.status) }}</strong> · {{ money(payment.amountTwd) }}<small>編號 {{ payment.id }}</small><small v-if="payment.refund">模擬退款 {{ money(payment.refund.amountTwd) }} · {{ orderTime(payment.refund.refundedAt) }}；不會實際轉帳。</small>
<div v-if="payment.status==='INITIATED'&&!pendingStart&&!pendingSimulation&&order.status==='PENDING_PAYMENT'"><button class="shop-button" :disabled="busy||needsReload" @click="simulate(payment,'SUCCESS')">模擬付款成功</button><button class="shop-button secondary" :disabled="busy||needsReload" @click="simulate(payment,'FAILURE')">模擬付款失敗</button></div></li></ul>
<p v-if="options.items.some(p=>p.status==='REVIEW_REQUIRED'&&!p.refund)" class="shop-error">有異常通知待核對，暫停新的付款模擬。請由店長查看原通知並處理模擬核對退款。</p></template></section></template>
<style scoped>.mock-payment-panel{margin-top:24px;padding-top:20px;border-top:1px solid #e3e5ec}.mock-payment-panel h3{font-size:19px}.mock-payment-panel button{margin:6px 12px 6px 0}.mock-payment-panel li{color:#15161a;margin:16px 0;overflow-wrap:anywhere}.mock-payment-panel small{display:block;font-size:12px;margin:6px 0}.secondary{background:#4b5060}</style>
