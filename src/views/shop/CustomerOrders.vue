<script setup lang="ts">
import { onMounted,ref } from 'vue'
import { useRouter } from 'vue-router'
import { CustomerApiError } from '@/api/customer'
import { getOrders,cancelOrder,orderStatus,fulfillmentStatus,type OrderView } from '@/api/orders'
import CustomerReturnPanel from '@/views/shop/CustomerReturnPanel.vue'
import MockPaymentPanel from '@/views/shop/MockPaymentPanel.vue'
import { money,type Page } from '@/api/catalog'
const router=useRouter(),orders=ref<Page<OrderView>>(),page=ref(1),busy=ref(false),error=ref('')
const time=(value:string)=>new Intl.DateTimeFormat('zh-TW',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Taipei'}).format(new Date(value+'+08:00'))
async function failure(e:unknown){error.value=e instanceof Error?e.message:'操作失敗';if(e instanceof CustomerApiError&&e.status===401)await router.replace('/shop/login')}
async function load(next=page.value){if(busy.value)return;busy.value=true;error.value='';try{orders.value=await getOrders(next);page.value=next}catch(e){await failure(e)}finally{busy.value=false}}
async function cancel(order:OrderView){if(busy.value||!window.confirm('取消這筆訂單並釋放保留庫存？'))return;busy.value=true;error.value='';try{const result=await cancelOrder(order.id,order.version);if(orders.value)orders.value.items=orders.value.items.map(o=>o.id===result.id?result:o)}catch(e){await failure(e);if(!(e instanceof CustomerApiError))error.value='取消結果未確認，請重新核對訂單。再次取消同一筆不會重複釋放庫存。'}finally{busy.value=false}}
function updateOrder(order:OrderView){if(orders.value)orders.value.items=orders.value.items.map(o=>o.id===order.id?order:o)}
onMounted(()=>load())
</script>
<template><section><h1>我的訂單</h1><p>價格、商品與收件資料保存下單時的快照。待付款保留 30 分鐘，到期後系統釋放庫存；目前提供付款模擬，不會實際收款。</p>
<p v-if="error" role="alert" class="shop-error">{{ error }}</p><button class="shop-button" :disabled="busy" @click="load()">重新核對訂單</button>
<p v-if="orders&&!orders.items.length" data-testid="orders-empty">目前沒有訂單。</p>
<article v-for="order in orders?.items" :key="order.id" class="order-card" :data-testid="'order-'+order.id"><h2>{{ orderStatus(order.status) }}</h2><p class="order-number">訂單編號：{{ order.id }}</p><p>建立：{{ time(order.createdAt) }}<br>保留期限：{{ time(order.expiresAt) }}（台北時間）</p>
<p v-if="order.paidAt">模擬付款時間：{{ time(order.paidAt) }}（台北時間）</p><ul><li v-for="line in order.items" :key="line.skuId">{{ line.title }} · {{ line.label }} × {{ line.quantity }} · {{ money(line.unitPriceTwd) }}／件 · {{ money(line.lineTotalTwd) }}</li></ul>
<p>收件人：{{ order.shipping.recipientName }} · {{ order.shipping.phone }}<br>{{ order.shipping.postalCode }} {{ order.shipping.city }}{{ order.shipping.district }}{{ order.shipping.street }}</p>
<p>商品小計 {{ money(order.subtotalTwd) }} ＋ 配送費 {{ money(order.shippingTwd) }}<br><strong>總額 {{ money(order.totalTwd) }}</strong></p>
<section v-if="(order.status==='PAID'||order.status==='REFUNDED')" class="fulfillment-progress" :data-testid="'fulfillment-'+order.id"><h3>配送進度</h3><p>{{ fulfillmentStatus(order.fulfillment.status) }}</p><p v-if="order.fulfillment.trackingId">模擬貨件編號 {{ order.fulfillment.trackingId }}</p><p v-if="order.fulfillment.shippedAt">模擬出貨時間：{{ time(order.fulfillment.shippedAt) }}</p><p v-if="order.fulfillment.deliveredAt">模擬送達時間：{{ time(order.fulfillment.deliveredAt) }}</p><p>此為配送演練，不會建立真實物流託運。按「重新核對訂單」更新進度。</p></section>
<section v-if="order.refund" :data-testid="'refund-'+order.id"><h3>模擬退款已完成</h3><p>退款金額 {{ money(order.refund.amountTwd) }} · {{ time(order.refund.refundedAt) }}（台北時間）</p><p>這是退款演練，不會實際轉帳。</p></section>
<button v-if="order.status==='PENDING_PAYMENT'" class="shop-button" :disabled="busy" @click="cancel(order)">取消訂單</button><CustomerReturnPanel v-if="order.fulfillment.status!=='UNFULFILLED'" :order="order" @changed="updateOrder" /><MockPaymentPanel :order="order" @changed="updateOrder" /></article>
<nav v-if="orders&&orders.total>10" aria-label="訂單分頁"><button :disabled="busy||page===1" @click="load(page-1)">上一頁</button><span>第 {{ page }} 頁</span><button :disabled="busy||page*10>=orders.total" @click="load(page+1)">下一頁</button></nav>
<p><router-link to="/shop/cart">回到購物車 →</router-link></p></section></template>
<style scoped>.order-card{margin-top:24px;padding:24px;background:#ffffff;border:1px solid #e3e5ec;border-radius:10px;overflow-wrap:anywhere}.fulfillment-progress{margin-top:24px;border-top:1px solid #e3e5ec;padding-top:20px}.fulfillment-progress h3{font-size:19px}.order-card h2{font-size:22px}.order-card li{margin:12px 0;color:#15161a}.order-number{font-size:13px}nav{display:flex;gap:16px;margin-top:20px}@media(max-width:600px){.order-card{padding:18px}}</style>
