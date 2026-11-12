<script setup lang="ts">
import { onMounted,ref,watch } from 'vue'
import { useRouter } from 'vue-router'
import { CustomerApiError } from '@/api/customer'
import { orderTime,type OrderView } from '@/api/orders'
import { getReturn,requestReturn,returnStatus,dispositionName,type ReturnOptions,type ReturnRequest } from '@/api/returns'
const props=defineProps<{order:OrderView}>(),emit=defineEmits<{changed:[order:OrderView]}>(),router=useRouter()
const options=ref<ReturnOptions>(),reason=ref(''),pending=ref<ReturnRequest>(),busy=ref(false),error=ref(''),notice=ref(''),needsReload=ref(false)
async function load(){if(busy.value)return;busy.value=true;error.value='';try{options.value=await getReturn(props.order.id);emit('changed',options.value.order);needsReload.value=false}catch(e){error.value=e instanceof Error?e.message:'無法核對退貨'}finally{busy.value=false}}
async function submit(){
 if(busy.value||needsReload.value)return
 if(!pending.value){if(!options.value?.canRequest||!reason.value.trim())return;if(!window.confirm('提出整筆模擬退貨申請？驗收後才退款，不會安排實際寄送或轉帳。'))return;pending.value={requestId:crypto.randomUUID(),expectedOrderVersion:props.order.version,reason:reason.value.trim()}}
 busy.value=true;error.value='';notice.value='';let acknowledged=false
 try{const r=await requestReturn(props.order.id,pending.value);pending.value=undefined;acknowledged=true;emit('changed',r.order);reason.value='';notice.value=r.replayed?'已確認前次申請，沒有新增另一筆。':'模擬退貨申請已保存，請等待店長驗收。';options.value=await getReturn(props.order.id);emit('changed',options.value.order)}
 catch(e){if(acknowledged){needsReload.value=true;error.value='申請已確認，讀取失敗，請重新核對退貨。'}else if(e instanceof CustomerApiError&&[400,401,403,404,409].includes(e.status)){pending.value=undefined;needsReload.value=true;error.value=e.message;if(e.status===401)await router.replace('/shop/login')}else{error.value='申請回應未確認，請保留此頁，重試同一退貨申請。'}}finally{busy.value=false}
}
watch(()=>props.order.version,()=>load());onMounted(load)
</script>
<template><section class="return-panel" :data-testid="'return-panel-'+order.id"><h3>退貨演練</h3><p>已出貨訂單可申請整筆退貨，每筆訂單限一次申請。店長記錄收貨與驗收後才可全額模擬退款；不安排寄送、不會實際轉帳。</p><p v-if="error" class="shop-error" role="alert">{{ error }}</p><p v-if="notice" class="shop-success" role="status">{{ notice }}</p><button class="shop-button secondary" :disabled="busy" @click="load">核對退貨狀態</button><p v-if="options&&!options.enabled">此環境未啟用退貨演練。</p>
<article v-if="order.returnProgress" data-testid="customer-return-status"><strong>{{ returnStatus(order.returnProgress.status) }}</strong><p>申請原因：{{ order.returnProgress.reason }}</p><p>申請時間：{{ orderTime(order.returnProgress.requestedAt) }}</p><p v-if="order.returnProgress.receivedAt">模擬驗收時間：{{ orderTime(order.returnProgress.receivedAt) }} · {{ dispositionName(order.returnProgress.disposition) }}</p><p v-if="order.returnProgress.refundedAt">模擬退款時間：{{ orderTime(order.returnProgress.refundedAt) }}</p><p v-if="order.returnProgress.rejectedAt">拒絕申請時間：{{ orderTime(order.returnProgress.rejectedAt) }}。此演練不提供重新申請。</p></article>
<div v-if="pending||options?.canRequest"><label :for="'return-reason-'+order.id">整筆退貨原因</label><textarea :id="'return-reason-'+order.id" v-model="reason" maxlength="500" rows="2" :disabled="busy||!!pending||needsReload" /><button class="shop-button" :disabled="busy||needsReload||(!pending&&!reason.trim())" @click="submit">{{ pending?'重試同一退貨申請':'提出模擬退貨申請' }}</button></div></section></template>
<style scoped>.return-panel{margin-top:24px;padding-top:20px;border-top:1px solid #e3e5ec}.return-panel h3{font-size:19px}.return-panel textarea{display:block;width:100%;margin:10px 0}.return-panel button{margin:8px 12px 8px 0}.secondary{background:#4b5060}</style>
